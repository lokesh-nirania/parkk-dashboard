-- Age the demo. Everything above was created through the app in one sitting, so
-- every row carries the same timestamp; this spreads each project's trail across
-- the weeks it would really have taken, then derives every stamp that is shown
-- on a screen from the trail itself, so nothing can disagree.
begin;

create temp table span (code text primary key, from_days int, to_days int) on commit drop;
insert into span values
  ('PK-26001', 24, 1),   -- Silver Dawn: quoted three weeks ago, still moving
  ('PK-26002',  9, 2),   -- Coral Sentinel: quoted last week, confirmed on Tuesday
  ('PK-26003',  6, 1),   -- Northern Lyra: fresh quote, revised yesterday
  ('PK-26004', 15, 7),   -- Sea Harrier: quoted a fortnight ago, cancelled last week
  ('PK-26005', 41, 2);   -- Andaman Pride: won last month, starts in twelve days

-- Spread each project's rows evenly between the two ends of its span, keeping
-- the order they happened in.
update activity_log l set created_at = t.at
from (
  select l2.id,
         now() - make_interval(days => s.from_days)
           + ((row_number() over (partition by l2.project_id order by l2.id) - 1)::float
              / greatest(count(*) over (partition by l2.project_id) - 1, 1))
             * make_interval(days => s.from_days - s.to_days) as at
  from activity_log l2
  join projects p on p.id = l2.project_id
  join span s on s.code = p.code
) t
where t.id = l.id;

-- Rows that belong to nobody's project — people and crew records — sit across
-- the same window rather than all landing this morning.
update activity_log set created_at = now() - make_interval(days => 20)
  + (id % 17) * interval '1 day' + (id % 7) * interval '1 hour'
where project_id is null;

-- Every stamp a screen shows comes from the event that set it.
update projects p set created_at = e.at
from (select project_id, min(created_at) as at from activity_log group by project_id) e
where e.project_id = p.id;

update projects p set confirmed_at = l.created_at
from activity_log l where l.project_id = p.id and l.action = 'project_confirmed';

update projects p set planning_started_at = l.created_at
from activity_log l where l.project_id = p.id and l.action = 'planning_opened';

update project_managers m set assigned_at = l.created_at
from activity_log l
where l.project_id = m.project_id and l.action = 'manager_assigned' and l.item_id = m.person_id;

update assignments a set released_at = l.created_at
from activity_log l where l.item_id = a.id and l.action = 'seat_released';

-- Not shown anywhere, but a seat created after the job it belongs to reads wrong
-- in the database too.
update assignments a set created_at = coalesce(p.planning_started_at, p.created_at), filled_at =
  case when a.worker_id is null and a.person_id is null then null
       else coalesce(p.planning_started_at, p.created_at) end
from projects p where p.id = a.project_id and a.created_at > coalesce(p.planning_started_at, p.created_at);

update tasks t set created_at = coalesce(p.planning_started_at, p.created_at)
from projects p where p.id = t.project_id;

commit;
