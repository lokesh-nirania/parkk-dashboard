-- ============================================================================
-- Parkk — schema
--
-- The spine is the lifecycle:
--
--   Quote → Confirmation → Planning → Execution → Invoicing
--
-- A stage is a place in that line. Planning is the one with depth: it holds
-- SUBSTAGES that all run at once — manpower, travel, immigration, yard passes,
-- insurance, logistics — and each substage holds TASKS. Substages are rows, not
-- an enum, so a project that needs a seventh workstream gets one without a
-- migration.
--
-- Two facts the schema is built around:
--
--   1. Crew changes mid-flight. People are added in week three and taken off in
--      week five. So a seat is a row with a beginning and an end, never a
--      headcount, and a substage that was finished can go back to unfinished
--      when somebody new arrives with no visa.
--
--   2. The current state is not the whole story. Every write appends to
--      activity_log with the field it moved and the values either side, so
--      "travel is pending" can sit next to "travel was complete on 3 August"
--      without either one being a lie.
--
-- There is no demo data in this repo. Every row on every screen is created
-- through the UI.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- vocabulary

create type project_type as enum ('hull_job', 'supervision', 'repair');

-- Where a project is. Each non-terminal status names the stage it is IN; the UI
-- renders it as "<stage> · pending <next>".
create type project_status as enum (
  'quoted',       -- quote out, pending confirmation
  'confirmed',    -- dates and crew size agreed, pending a manager
  'planning',     -- a manager is on it and the substages are open
  'in_progress',  -- crew at the yard
  'invoicing',
  'completed',
  -- One terminal status for every way a job does not happen: the quote goes
  -- quiet, the client reorganises, the yard slot vanishes. "Lost" would claim
  -- to know which, and this system never actually learns that.
  'cancelled'
);

create type project_stage as enum (
  'quote', 'confirmation', 'planning', 'execution', 'invoicing'
);

-- One status vocabulary for every trackable thing: substages and tasks alike.
-- awaiting_external is deliberately separate from in_progress — "we have not
-- filed the visa" and "we filed it five weeks ago and the consulate is silent"
-- need different phone calls.
create type item_status as enum (
  'n_a', 'not_started', 'in_progress', 'awaiting_external', 'blocked', 'done'
);

-- Who you chase. The task exists and still goes red when it is not ours.
create type owner_party as enum ('us', 'client', 'agency');

-- Parkk's own staff. Admins sign in; managers are people an admin can put on a
-- project. A manager becomes a login the day they accept an invite, and nothing
-- about the model changes when they do.
create type person_role as enum ('admin', 'manager');

-- What a substage counts. 'seats' is the crew list itself; 'tasks' is anything
-- with a checklist beneath it.
create type substage_unit as enum ('tasks', 'seats');

-- ------------------------------------------------------------------- people
-- Staff, not crew. A person is assignable and can own work whether or not they
-- can log in — user_id stays null until there is an account to attach.

create table people (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid unique references auth.users(id) on delete set null,
  role        person_role not null default 'manager',
  full_name   text not null,
  short_name  text not null,       -- 'Abhi' — what the UI shows in a table cell
  email       text unique,         -- where the invite will go
  phone       text,
  is_active   boolean not null default true,
  note        text,
  created_by  uuid references people(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index on people (role) where is_active;

-- Signing up is not a thing here: an auth user exists because somebody with the
-- database made it. If a person row already carries that email — the invite
-- case — the account attaches to it instead of creating a second one.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.people
     set user_id = new.id, is_active = true
   where lower(email) = lower(new.email) and user_id is null;

  if not found then
    insert into public.people (user_id, role, full_name, short_name, email)
    values (
      new.id,
      'admin',
      coalesce(nullif(new.raw_user_meta_data->>'full_name', ''),
               split_part(new.email, '@', 1)),
      coalesce(nullif(new.raw_user_meta_data->>'short_name', ''),
               initcap(split_part(split_part(new.email, '@', 1), '.', 1))),
      new.email
    );
  end if;

  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ------------------------------------------------------------ reference data
-- All four start empty and fill from the UI — the project form creates a client
-- or a shipyard inline when the name typed is not one it already knows.

create table clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  country     text,
  created_at  timestamptz not null default now()
);

create table vessels (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  imo         text,
  vessel_type text,
  client_id   uuid references clients(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table shipyards (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  city        text,
  country     text,
  created_at  timestamptz not null default now()
);

-- Crew. Distinct from people: a worker holds a seat on a job, a person runs one.
create table workers (
  id              uuid primary key default gen_random_uuid(),
  full_name       text not null,
  nationality     text,
  trade           text not null,
  passport_no     text,          -- see implementation/05-decisions.md on PII
  passport_expiry date,
  phone           text,
  created_at      timestamptz not null default now()
);

create index on workers (full_name);

-- ---------------------------------------------------------------- projects

-- Project codes are generated, never typed. A sequence rather than a per-year
-- max() so two admins creating projects at once cannot collide.
create sequence project_code_seq start 1;

create or replace function next_project_code() returns text
language sql volatile as $$
  select 'PK-' || to_char(current_date, 'YY')
              || lpad(nextval('project_code_seq')::text, 3, '0')
$$;

-- A project carries its window three times over, and which one you are reading
-- is the point:
--
--   est_*        what the quote proposed  — a guess, revisable while quoted
--   confirmed_*  what the client agreed   — the baseline, written once
--   start/end    where the job sits today — what every clock in the app reads
--
-- Slip is then a subtraction rather than an argument.
create table projects (
  id                   uuid primary key default gen_random_uuid(),
  code                 text not null unique default next_project_code(),
  name                 text not null,
  client_id            uuid references clients(id) on delete set null,
  vessel_id            uuid references vessels(id) on delete set null,
  shipyard_id          uuid references shipyards(id) on delete set null,
  location             text,          -- free text at quote time, before a shipyard row exists
  type                 project_type not null default 'hull_job',
  status               project_status not null default 'quoted',

  est_start_date       date,
  est_end_date         date,
  confirmed_start_date date,
  confirmed_end_date   date,
  start_date           date,
  end_date             date,

  -- What was agreed. The crew list is what is actually true; this is the number
  -- the job was sized and priced on, and the gap between them is worth seeing.
  team_size            integer check (team_size is null or team_size >= 0),

  quote_value          numeric(14,2),
  currency             text default 'USD',
  -- The paragraph the whole job is priced on. It goes on the project page and
  -- is editable at any stage; every edit lands in the trail.
  scope_note           text,

  -- Gates are facts, not statuses: who moved this project forward, and when.
  created_by           uuid references people(id) on delete set null,
  confirmed_by         uuid references people(id) on delete set null,
  confirmed_at         timestamptz,
  planning_started_by  uuid references people(id) on delete set null,
  planning_started_at  timestamptz,
  commenced_at         timestamptz,
  cancel_reason        text,          -- optional; why it did not go ahead, when anybody knows

  created_at           timestamptz not null default now(),

  constraint projects_dates_ordered
    check (start_date is null or end_date is null or end_date >= start_date),
  constraint projects_est_dates_ordered
    check (est_start_date is null or est_end_date is null or est_end_date >= est_start_date),
  constraint projects_confirmed_dates_ordered
    check (confirmed_start_date is null or confirmed_end_date is null
           or confirmed_end_date >= confirmed_start_date)
);

create index on projects (status);
create index on projects (start_date);

-- Who is running it. Plural, because a big job has two, and kept as rows with
-- an end date rather than a column that gets overwritten — "who was on this in
-- March" is a question somebody eventually asks.
create table project_managers (
  project_id   uuid not null references projects(id) on delete cascade,
  person_id    uuid not null references people(id) on delete cascade,
  assigned_at  timestamptz not null default now(),
  assigned_by  uuid references people(id) on delete set null,
  removed_at   timestamptz,
  removed_by   uuid references people(id) on delete set null,
  primary key (project_id, person_id)
);

create index on project_managers (person_id) where removed_at is null;

-- ------------------------------------------------------------------- seats
-- A seat on the project. worker_id null = declared but unfilled, which is what
-- makes crew a trackable thing rather than a number in a field.
--
-- Seats are added and released while the job runs. Nothing is ever deleted:
-- released_at is what makes "we were twelve, then fourteen, then eleven" a
-- record instead of a memory.
create table assignments (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id) on delete cascade,
  seat_no         integer not null,
  worker_id       uuid references workers(id) on delete set null,
  trade           text not null default 'Unassigned',
  mobilize_on     date,
  demobilize_on   date,
  filled_at       timestamptz,     -- when a name went into the seat
  released_at     timestamptz,     -- when they came off the job
  release_reason  text,
  added_by        uuid references people(id) on delete set null,
  released_by     uuid references people(id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (project_id, seat_no)
);

create index on assignments (project_id) where released_at is null;
create index on assignments (worker_id);

-- ------------------------------------------------------------- the substages

-- Reference data: the workstreams a planning stage opens with. Changing this
-- list is a migration; adding one to a single project is a row in the next
-- table. person_tasks is the obligation kit a new crew member arrives with —
-- it is why onboarding somebody in week three reopens travel and immigration
-- without anyone remembering to.
create table substage_templates (
  key           text primary key,
  stage         project_stage not null default 'planning',
  seq           integer not null,
  title         text not null,
  help          text,
  unit          substage_unit not null default 'tasks',
  person_tasks  text[] not null default '{}'
);

insert into substage_templates (key, stage, seq, title, unit, person_tasks, help) values
  ('manpower',    'planning', 1, 'Manpower',                  'seats', '{}',
   'Every seat filled with a named worker. Derived from the seats themselves, never ticked by hand.'),

  ('immigration', 'planning', 2, 'Immigration & work permits', 'tasks',
   '{Work permit / visa}',
   'Visas and permits, per person, per destination.'),

  ('travel',      'planning', 3, 'Travel arrangements',        'tasks',
   '{Inbound flight,Outbound flight}',
   'Flights and transfers per person. Some clients book their own — the task still goes red, only who you chase changes.'),

  ('yard_pass',   'planning', 4, 'Shipyard entry',             'tasks',
   '{Yard pass & induction}',
   'Passes and inductions. Watch the validity date against the job end date.'),

  ('insurance',   'planning', 5, 'Insurance',                  'tasks',
   '{Cover in place}',
   'Cover for every person on the job.'),

  ('logistics',   'planning', 6, 'Logistics',                  'tasks', '{}',
   'Kit and consumables to the yard. Long lead times — which is why it is a planning workstream and not a start-day one.');

-- One project's live copy. Rows here can also be typed in by hand: a substage
-- with no template_key is one somebody added because this job needed it.
create table project_substages (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references projects(id) on delete cascade,
  template_key     text references substage_templates(key) on delete set null,
  stage            project_stage not null default 'planning',
  seq              integer not null default 100,
  title            text not null,
  help             text,
  unit             substage_unit not null default 'tasks',
  -- Only consulted while nothing is beneath it. Once there are tasks the
  -- status is derived, and this column stops being the answer.
  status           item_status not null default 'not_started',
  owner_person_id  uuid references people(id) on delete set null,
  note             text,
  created_by       uuid references people(id) on delete set null,
  updated_at       timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

create index on project_substages (project_id, stage);
create unique index project_substages_template_uniq
  on project_substages (project_id, template_key) where template_key is not null;

-- ------------------------------------------------------------------ the work
-- Everything trackable is a task: a visa, a flight, sixty drums of primer, or
-- something somebody typed in this morning. assignment_id set means it belongs
-- to a person; null means it is a thing.
create table tasks (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references projects(id) on delete cascade,
  substage_id      uuid not null references project_substages(id) on delete cascade,
  assignment_id    uuid references assignments(id) on delete cascade,
  title            text not null,
  subject_label    text,                 -- who or what, when there is no seat
  status           item_status not null default 'not_started',
  owner_party      owner_party not null default 'us',
  owner_person_id  uuid references people(id) on delete set null,
  due_date         date,
  valid_from       date,
  valid_to         date,                 -- drives the expiry radar
  qty_required     integer,
  qty_done         integer,
  note             text,
  created_by       uuid references people(id) on delete set null,
  completed_at     timestamptz,
  updated_at       timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

create index on tasks (project_id);
create index on tasks (substage_id);
create index on tasks (assignment_id);
create index on tasks (status);
create index on tasks (valid_to);

-- The obligation kit is created once per person per substage.
create unique index tasks_person_kit_uniq
  on tasks (assignment_id, substage_id, title) where assignment_id is not null;

create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger tasks_touch
  before update on tasks
  for each row execute function touch_updated_at();

create trigger project_substages_touch
  before update on project_substages
  for each row execute function touch_updated_at();

-- ------------------------------------------------------------------- the trail
-- Append-only. Every server action writes here, and every row carries two
-- halves: a sentence for the feed to read, and the field it moved with the
-- values either side so the same row can be counted, filtered and replayed.
--
-- This is what lets a substage be pending today and still show that it was
-- complete on 3 August, which is the difference between a dashboard and a
-- record.
create table activity_log (
  id          bigserial primary key,
  project_id  uuid references projects(id) on delete cascade,
  entity      text,        -- 'project' | 'substage' | 'task' | 'seat' | 'manager' | 'person'
  item_id     uuid,
  actor_id    uuid references people(id) on delete set null,
  actor       text,
  action      text not null,
  detail      text,
  field       text,
  old_value   text,
  new_value   text,
  reason      text,
  created_at  timestamptz not null default now()
);

create index on activity_log (project_id, created_at desc);
create index on activity_log (created_at desc);
create index on activity_log (entity, item_id, created_at desc);
create index on activity_log (project_id, field, created_at desc);

-- --------------------------------------------------------------- the engine

-- One definition of "worst", used identically by every rollup on every screen.
create or replace function status_severity(s item_status) returns integer
language sql immutable as $$
  select case s
    when 'blocked'           then 5
    when 'not_started'       then 4
    when 'awaiting_external' then 3
    when 'in_progress'       then 2
    when 'done'              then 1
    when 'n_a'               then 0
  end
$$;

-- Open the planning workstreams. Idempotent — the unique index on
-- (project_id, template_key) is what makes calling it twice a no-op.
create or replace function open_planning(p_project uuid) returns integer
language plpgsql as $$
declare inserted integer;
begin
  insert into project_substages
    (project_id, template_key, stage, seq, title, help, unit)
  select p_project, t.key, t.stage, t.seq, t.title, t.help, t.unit
  from substage_templates t
  where t.stage = 'planning'
  on conflict (project_id, template_key) where template_key is not null do nothing;

  get diagnostics inserted = row_count;
  return inserted;
end $$;

-- The obligation kit for one seat: a visa, two flights, a pass, a cover note.
-- Called when a worker goes into a seat — including in week three, which is
-- how travel goes back to pending without anybody deciding it should.
create or replace function open_person_tasks(p_assignment uuid) returns integer
language plpgsql as $$
declare inserted integer;
begin
  insert into tasks (project_id, substage_id, assignment_id, title, subject_label)
  select a.project_id, s.id, a.id, t.title, w.full_name
  from assignments a
  join workers w on w.id = a.worker_id
  join project_substages s on s.project_id = a.project_id
  join substage_templates st on st.key = s.template_key
  cross join lateral unnest(st.person_tasks) as t(title)
  where a.id = p_assignment
    and a.released_at is null
  on conflict (assignment_id, substage_id, title) where assignment_id is not null
  do nothing;

  get diagnostics inserted = row_count;
  return inserted;
end $$;

-- ------------------------------------------------------------------- views

-- A task, plus the two things nobody catches by eye.
create or replace view tasks_effective
with (security_invoker = on) as
select
  t.*,
  p.end_date                                    as project_end_date,
  p.code                                        as project_code,
  p.name                                        as project_name,
  s.title                                       as substage_title,
  s.template_key                                as substage_key,
  w.full_name                                   as worker_name,
  a.seat_no,
  a.released_at                                 as seat_released_at,
  -- A task belonging to somebody who has left the job is neither outstanding
  -- work nor an achievement to count. It stays readable; it stops counting.
  (a.released_at is null)                       as is_live,
  coalesce(w.full_name, t.subject_label)        as subject,
  own.short_name                                as owner_short,
  -- A yard pass valid to 20 March on a job running to 4 April is not green,
  -- whatever anybody ticked.
  (t.valid_to is not null
     and p.end_date is not null
     and t.valid_to < p.end_date)               as has_expiry_gap,
  (t.due_date is not null
     and t.due_date < current_date
     and t.status not in ('done','n_a'))        as is_overdue,
  status_severity(t.status)                     as severity
from tasks t
join projects p on p.id = t.project_id
join project_substages s on s.id = t.substage_id
left join assignments a on a.id = t.assignment_id
left join workers w on w.id = a.worker_id
left join people own on own.id = t.owner_person_id;

-- A substage and what is beneath it. Manpower counts seats; everything else
-- counts tasks; a substage with nothing beneath it keeps the status somebody
-- set by hand, which is how a workstream that does not apply gets closed as n/a.
create or replace view project_substage_effective
with (security_invoker = on) as
select
  s.id, s.project_id, s.template_key, s.stage, s.seq, s.title, s.help, s.unit,
  s.status, s.owner_person_id, s.note, s.updated_at, s.created_at,
  own.short_name                                          as owner_short,
  own.full_name                                           as owner_name,
  case when s.unit = 'seats' then seats.total else t.total end   as total,
  case when s.unit = 'seats' then seats.filled else t.done end   as done,
  coalesce(t.blocked, 0)                                  as blocked,
  coalesce(t.awaiting, 0)                                 as awaiting,
  coalesce(t.expiry_gaps, 0)                              as expiry_gaps,
  coalesce(t.overdue, 0)                                  as overdue,
  coalesce(t.qty_required, 0)                             as qty_required,
  coalesce(t.qty_done, 0)                                 as qty_done,
  (case when s.unit = 'seats' then seats.total else t.total end) > 0  as is_derived,
  case
    when s.unit = 'seats' then
      case
        when seats.total = 0            then s.status
        when seats.filled = 0           then 'not_started'::item_status
        when seats.filled < seats.total then 'in_progress'::item_status
        else 'done'::item_status
      end
    when t.total = 0            then s.status
    when t.expiry_gaps > 0      then 'blocked'::item_status
    else t.worst
  end                                                     as effective_status
from project_substages s
left join people own on own.id = s.owner_person_id
left join lateral (
  select
    count(*)::int                                                as total,
    count(*) filter (where te.status = 'done')::int              as done,
    count(*) filter (where te.status = 'blocked')::int           as blocked,
    count(*) filter (where te.status = 'awaiting_external')::int as awaiting,
    count(*) filter (where te.has_expiry_gap)::int               as expiry_gaps,
    count(*) filter (where te.is_overdue)::int                   as overdue,
    coalesce(sum(te.qty_required), 0)::int                       as qty_required,
    coalesce(sum(te.qty_done), 0)::int                           as qty_done,
    (select te2.status from tasks_effective te2
      where te2.substage_id = s.id and te2.is_live
      order by status_severity(te2.status) desc limit 1)         as worst
  from tasks_effective te
  where te.substage_id = s.id and te.is_live
) t on true
left join lateral (
  -- Released seats are history, not outstanding work.
  select
    count(*)::int                                        as total,
    count(*) filter (where a.worker_id is not null)::int as filled
  from assignments a
  where a.project_id = s.project_id and a.released_at is null
) seats on true;

-- The board row: one line per project with its clock, its people and its flags.
create or replace view project_board
with (security_invoker = on) as
select
  p.id, p.code, p.name, p.type, p.status,
  p.est_start_date, p.est_end_date,
  p.confirmed_start_date, p.confirmed_end_date,
  p.start_date, p.end_date,
  p.team_size, p.location, p.scope_note, p.quote_value, p.currency,
  p.confirmed_at, p.planning_started_at, p.commenced_at, p.cancel_reason,
  p.created_at,
  cb.full_name  as created_by_name,
  cf.full_name  as confirmed_by_name,
  cl.name       as client_name,
  v.name        as vessel_name,
  sy.name       as shipyard_name,
  sy.city       as shipyard_city,
  sy.country    as shipyard_country,

  (p.start_date - current_date)                as days_to_start,
  (p.confirmed_start_date - p.est_start_date)  as quote_shift_days,
  (p.start_date - p.confirmed_start_date)      as schedule_shift_days,
  (select count(*) from activity_log l
     where l.project_id = p.id and l.entity = 'project'
       and l.action = 'dates_shifted' and l.field = 'start_date')   as reschedule_count,

  (select string_agg(pe.short_name, ', ' order by pm.assigned_at)
     from project_managers pm join people pe on pe.id = pm.person_id
    where pm.project_id = p.id and pm.removed_at is null)           as manager_names,
  (select count(*) from project_managers pm
    where pm.project_id = p.id and pm.removed_at is null)           as manager_count,

  (select count(*) from assignments a
    where a.project_id = p.id and a.released_at is null)            as seats_total,
  (select count(*) from assignments a
    where a.project_id = p.id and a.released_at is null
      and a.worker_id is not null)                                  as seats_filled,
  (select count(*) from assignments a
    where a.project_id = p.id and a.released_at is not null)        as seats_released,

  (select count(*) from project_substages s
    where s.project_id = p.id and s.stage = 'planning')             as planning_total,
  (select count(*) from project_substage_effective se
    where se.project_id = p.id and se.stage = 'planning'
      and se.effective_status in ('done','n_a'))                    as planning_done,

  (select count(*) from tasks_effective te
    where te.project_id = p.id and te.is_live and te.status = 'blocked')           as blocked_count,
  (select count(*) from tasks_effective te
    where te.project_id = p.id and te.is_live and te.has_expiry_gap)               as expiry_gap_count,
  (select count(*) from tasks_effective te
    where te.project_id = p.id and te.is_live and te.is_overdue)                   as overdue_count,
  (select count(*) from tasks_effective te
    where te.project_id = p.id and te.is_live and te.status not in ('done','n_a')) as open_task_count
from projects p
left join people    cb on cb.id = p.created_by
left join people    cf on cf.id = p.confirmed_by
left join clients   cl on cl.id = p.client_id
left join vessels   v  on v.id  = p.vessel_id
left join shipyards sy on sy.id = p.shipyard_id;

-- Every move of every date, with the size of the move worked out.
create or replace view project_schedule_events
with (security_invoker = on) as
select
  l.id, l.project_id, l.created_at, l.actor_id, l.actor, l.action,
  l.field, l.old_value, l.new_value, l.reason, l.detail,
  case
    when l.old_value is not null and l.new_value is not null
      then (l.new_value::date - l.old_value::date)
  end as shift_days
from activity_log l
where l.entity = 'project'
  and l.field in ('est_start_date', 'est_end_date',
                  'confirmed_start_date', 'confirmed_end_date',
                  'start_date', 'end_date');

-- What stage a project was in, and for how long. Built from the trail rather
-- than a second table, so it cannot disagree with the log the feed shows.
create or replace view project_stage_periods
with (security_invoker = on) as
with steps as (
  select p.id as project_id, 'quoted'::project_status as status, p.created_at as at, 0 as ord
  from projects p
  union all
  select l.project_id, l.new_value::project_status, l.created_at, 1
  from activity_log l
  where l.entity = 'project' and l.field = 'status' and l.new_value is not null
    and l.project_id is not null
)
select
  project_id,
  status,
  at as entered_at,
  lead(at) over (partition by project_id order by at, ord) as left_at,
  round(extract(epoch from (
    coalesce(lead(at) over (partition by project_id order by at, ord), now()) - at
  )) / 86400.0)::int as days
from steps;

-- ------------------------------------------------------------------- security
-- One role signs in today: the admin, who can do everything. Managers are
-- people rows without accounts, so there is nothing to scope yet. When invites
-- arrive, these policies are the only thing that changes.

alter table people             enable row level security;
alter table clients            enable row level security;
alter table vessels            enable row level security;
alter table shipyards          enable row level security;
alter table workers            enable row level security;
alter table projects           enable row level security;
alter table project_managers   enable row level security;
alter table assignments        enable row level security;
alter table project_substages  enable row level security;
alter table substage_templates enable row level security;
alter table tasks              enable row level security;
alter table activity_log       enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'people','clients','vessels','shipyards','workers','projects',
    'project_managers','assignments','project_substages','tasks','activity_log'
  ] loop
    execute format(
      'create policy %I on %I for all to authenticated using (true) with check (true)',
      'admin_all_' || t, t
    );
  end loop;
end $$;

-- Templates are reference data. Readable by the app, changed only by migration.
create policy templates_read on substage_templates
  for select to authenticated using (true);

-- Privileges and RLS are two separate gates and both must be open. Because the
-- views are security_invoker, the caller's own rights are what get checked
-- against the base tables — so granting on the views alone is not enough.
-- anon is deliberately granted nothing at all.
grant usage on schema public to authenticated;

grant select, insert, update, delete on
  people, clients, vessels, shipyards, workers, projects,
  project_managers, assignments, project_substages, tasks, activity_log
  to authenticated;

grant select on substage_templates to authenticated;

grant select on
  tasks_effective, project_substage_effective, project_board,
  project_schedule_events, project_stage_periods
  to authenticated;

grant execute on function open_planning(uuid) to authenticated;
grant execute on function open_person_tasks(uuid) to authenticated;
grant execute on function next_project_code() to authenticated;
grant execute on function status_severity(item_status) to authenticated;

grant usage, select on all sequences in schema public to authenticated;
