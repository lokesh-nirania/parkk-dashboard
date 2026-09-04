import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  PROJECT_TYPE_LABEL, TERMINAL,
  type BoardRow, type ChangeEvent, type NamedRef, type Person, type ScheduleEvent,
  type Seat, type StagePeriod, type Substage, type Task, type Worker,
} from '@/lib/types';
import {
  PageHeader, TMinus, Stat, Chip, Warn, Empty,
  ProjectStatusChip, QueryError,
} from '@/components/ui';
import { EventDetail, EventVerb } from '@/components/trail';
import { SchedulePanel } from '@/components/schedule-panel';
import { StageRail } from '@/components/stage-rail';
import { GateButton, CancelButton } from '@/components/gate-button';
import { EditProjectButton } from '@/components/project-details';
import { ManagerPicker, RemoveManagerButton } from '@/components/managers';
import { AddSubstageButton } from '@/components/planning';
import { AddSeatsButton } from '@/components/crew';
import { PlanningPanel } from '@/components/planning-panel';
import { CrewPanel } from '@/components/crew-panel';
import { TaskTable } from '@/components/task-table';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sub?: string }>;
};

type ManagerRow = {
  person_id: string;
  assigned_at: string;
  removed_at: string | null;
  people: { id: string; full_name: string; short_name: string } | null;
};

function stamp(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export default async function ProjectPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { sub } = await searchParams;

  const supabase = await createClient();

  const [
    { data: project },
    { data: substages, error: subErr },
    { data: taskRows },
    { data: seatRows },
    { data: managerRows, error: mgrErr },
    { data: peopleRows },
    { data: workerRows },
    { data: scheduleRows },
    { data: periodRows },
    { data: trailRows },
    { data: clientRows },
    { data: shipyardRows },
  ] = await Promise.all([
    supabase.from('project_board').select('*').eq('id', id).maybeSingle(),
    supabase.from('project_substage_effective').select('*').eq('project_id', id).order('seq'),
    supabase.from('tasks_effective').select('*').eq('project_id', id)
      .order('is_live', { ascending: false }).order('subject').order('title'),
    supabase.from('seats_effective').select('*').eq('project_id', id).order('seat_no'),
    // people is named explicitly: three columns here point at it, and an
    // ambiguous embed comes back as an error rather than a row.
    supabase.from('project_managers')
      .select('person_id, assigned_at, removed_at, people!project_managers_person_id_fkey(id, full_name, short_name)')
      .eq('project_id', id).order('assigned_at'),
    supabase.from('people').select('*').eq('is_active', true).order('full_name'),
    supabase.from('workers').select('*').order('full_name'),
    supabase.from('project_schedule_events').select('*').eq('project_id', id)
      .order('created_at', { ascending: false }),
    supabase.from('project_stage_periods').select('*').eq('project_id', id).order('entered_at'),
    supabase.from('activity_log').select('*').eq('project_id', id)
      .order('created_at', { ascending: false }).limit(60),
    supabase.from('clients').select('id, name').order('name'),
    supabase.from('shipyards').select('id, name').order('name'),
  ]);

  if (!project) notFound();

  const p = project as BoardRow;
  const subs = (substages ?? []) as Substage[];
  const tasks = (taskRows ?? []) as Task[];
  const seats = (seatRows ?? []) as Seat[];
  const people = (peopleRows ?? []) as Person[];
  const workers = (workerRows ?? []) as Worker[];
  const schedule = (scheduleRows ?? []) as ScheduleEvent[];
  const periods = (periodRows ?? []) as StagePeriod[];
  const trail = (trailRows ?? []) as ChangeEvent[];
  const clients = (clientRows ?? []) as NamedRef[];
  const shipyards = (shipyardRows ?? []) as NamedRef[];

  const managers = ((managerRows ?? []) as unknown as ManagerRow[]).filter((m) => m.people);
  const activeManagers = managers.filter((m) => m.removed_at === null);
  const pastManagers = managers.filter((m) => m.removed_at !== null);

  const liveSeats = seats.filter((s) => s.is_live);
  // Managers are assignable to a seat like anybody else — a manager who goes
  // out needs the same permit, bed and pass as the blaster beside them.
  const goers = people.filter((pp) => pp.role === 'manager' || pp.role === 'admin');

  const live = tasks.filter((t) => t.is_live);
  const blocked = live.filter((t) => t.status === 'blocked').length;
  const gaps = live.filter((t) => t.has_expiry_gap).length;

  // Seats a task can be pinned to, labelled the way somebody would say it.
  const seatOptions = liveSeats.map((s) => ({
    id: s.id,
    label: s.occupant_name
      ? `${s.occupant_name} — seat ${s.seat_no}`
      : `Seat ${s.seat_no} (unfilled)`,
  }));

  const planningOpen = subs.length > 0;
  const closed = TERMINAL.includes(p.status);

  return (
    <div className="space-y-6">
      <PageHeader
        title={p.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono text-[12px]">{p.code}</span>
            {p.client_name && <><span className="text-faint">·</span><span>{p.client_name}</span></>}
            {p.vessel_name && <><span className="text-faint">·</span><span>{p.vessel_name}</span></>}
            <span className="text-faint">·</span>
            <span>{p.shipyard_name ?? p.location}</span>
          </span>
        }
        right={
          <>
            <ProjectStatusChip status={p.status} />
            {p.type === 'supervision' && <Chip>Supervision</Chip>}
            <GateButton projectId={p.id} status={p.status} size="sm" />
          </>
        }
      />

      <QueryError error={subErr ?? mgrErr} />

      <StageRail project={p} periods={periods} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Start" value={<TMinus days={p.days_to_start} />} />
        <Stat label="Crew" value={p.seats_total === 0 ? '—' : `${p.seats_filled}/${p.seats_total}`}
              tone={p.seats_filled < p.seats_total ? 'warn' : 'ok'} />
        <Stat label="Open tasks" value={p.open_task_count} tone={p.open_task_count ? 'warn' : 'ok'} />
        <Stat label="Blocked" value={blocked} tone={blocked ? 'danger' : 'ok'} />
      </div>

      {/*
        The scope is the paragraph the whole job is priced on, so it goes on the
        page rather than into the database and out of sight. Everything here is
        editable at any stage, and every edit is in the history below.
      */}
      <section className="rounded-lg border border-line bg-surface">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <h2 className="text-[13px] font-semibold text-ink">The job</h2>
            <p className="mt-0.5 text-[12px] text-muted">What was quoted, and who it is for.</p>
          </div>
          <div className="flex shrink-0 items-start gap-1.5">
            <EditProjectButton project={p} clients={clients} shipyards={shipyards} />
            {!closed && <CancelButton projectId={p.id} />}
          </div>
        </div>

        <div className="px-4 py-3">
          {p.scope_note ? (
            <p className="max-w-[70ch] whitespace-pre-line text-[13px] leading-relaxed text-ink">
              {p.scope_note}
            </p>
          ) : (
            <p className="text-[13px] text-faint">
              No scope written down. It is the first thing anybody asks about a quote.
            </p>
          )}

          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-[12px]">
            {[
              ['Client', p.client_name],
              ['Vessel', p.vessel_name],
              ['Shipyard', p.shipyard_name],
              ['Location', p.location],
              ['Type', PROJECT_TYPE_LABEL[p.type]],
              ['Value', p.quote_value === null ? null
                : `${p.currency ?? 'USD'} ${Math.round(p.quote_value).toLocaleString('en-GB')}`],
            ].map(([label, value]) => (
              <div key={label as string}>
                <dt className="text-[10px] font-medium uppercase tracking-[0.06em] text-faint">{label}</dt>
                <dd className="text-muted">{value ?? '—'}</dd>
              </div>
            ))}
          </dl>

          {p.status === 'cancelled' && (
            <p className="mt-3 text-[12px] text-faint">
              Cancelled{p.cancel_reason ? ` — ${p.cancel_reason}` : '. No reason recorded.'}
            </p>
          )}
        </div>
      </section>

      <SchedulePanel project={p} events={schedule} />

      {/* ---------------------------------------------------------- managers */}
      <section className="rounded-lg border border-line bg-surface">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <h2 className="text-[13px] font-semibold text-ink">Managers</h2>
            <p className="mt-0.5 text-[12px] text-muted">
              {p.status === 'confirmed' && activeManagers.length === 0
                ? 'Planning opens the moment somebody is answerable for this job.'
                : 'Who is running it. More than one is normal on a big job.'}
            </p>
          </div>
          <ManagerPicker project={p} people={people} />
        </div>

        <div className="px-4 py-3">
          {activeManagers.length === 0 ? (
            <p className="text-[13px] text-faint">Nobody assigned yet.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {activeManagers.map((m) => (
                <li key={m.person_id}
                    className="flex items-center gap-2 rounded-md border border-line bg-surface-2 px-2.5 py-1.5">
                  <span className="text-[13px] font-medium text-ink">{m.people!.full_name}</span>
                  <span className="text-[11px] text-faint">since {stamp(m.assigned_at)}</span>
                  <RemoveManagerButton projectId={p.id} person={m.people!} />
                </li>
              ))}
            </ul>
          )}

          {pastManagers.length > 0 && (
            <p className="mt-2.5 text-[11px] text-faint">
              Previously:{' '}
              {pastManagers.map((m) => `${m.people!.short_name} (to ${stamp(m.removed_at!)})`).join(', ')}
            </p>
          )}
        </div>
      </section>

      {/* -------------------------------------------------------- workstreams */}
      {planningOpen ? (
        <section>
          <div className="mb-2.5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[13px] font-semibold text-ink">
                Planning
                <span className="ml-1.5 tabular font-normal text-faint">
                  {p.planning_done}/{p.planning_total}
                </span>
              </h2>
              <p className="mt-0.5 text-[12px] text-muted">
                Six workstreams running at once. Each one takes the worst status of what is beneath it.
              </p>
            </div>
            <AddSubstageButton projectId={p.id} people={people} />
          </div>

          <PlanningPanel
            projectId={p.id}
            subs={subs}
            tasks={tasks}
            seats={seats}
            people={people}
            workers={workers}
            managers={goers}
            seatOptions={seatOptions}
            projectEndDate={p.end_date}
            initialSub={sub}
          />
        </section>
      ) : (
        <section className="rounded-lg border border-dashed border-line-strong bg-surface px-6 py-10 text-center">
          <p className="text-[13px] font-medium text-ink">Planning has not opened.</p>
          <p className="mx-auto mt-1.5 max-w-[460px] text-[13px] leading-relaxed text-muted">
            {p.status === 'quoted'
              ? 'This is still a quote. Confirming the dates and crew size is the next step.'
              : 'Assign a manager and the six workstreams open, along with one seat per person in the confirmed crew size.'}
          </p>
        </section>
      )}

      {/* --------------------------------------------------------------- crew */}
      {seats.length > 0 && (
        <section>
          <div className="mb-2.5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[13px] font-semibold text-ink">
                Crew
                <span className="ml-1.5 tabular font-normal text-faint">
                  {p.seats_filled}/{p.seats_total}
                </span>
              </h2>
              <p className="mt-0.5 text-[12px] text-muted">
                A seat is a row, not a headcount. Filling one writes that person&rsquo;s obligations;
                releasing one keeps the record and stops the work counting.
                {p.team_size !== null && p.team_size !== p.seats_total && (
                  <> Confirmed at {p.team_size}.</>
                )}
                {p.seats_manager > 0 && (
                  <> {p.seats_manager === 1 ? 'One of ours is' : `${p.seats_manager} of ours are`} going out.</>
                )}
              </p>
            </div>
            <AddSeatsButton projectId={p.id} />
          </div>

          <CrewPanel
            seats={seats}
            tasks={tasks}
            workers={workers}
            managers={goers}
            projectEndDate={p.end_date}
          />
        </section>
      )}

      {/* -------------------------------------------------------------- tasks */}
      {planningOpen && (
        <section>
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold text-ink">
              All tasks
              <span className="ml-1.5 tabular font-normal text-faint">{tasks.length}</span>
            </h2>
            <p className="text-[12px] text-faint">
              Everything on the job at once. A workstream on its own is a click above.
            </p>
          </div>

          <div className="rounded-lg border border-line bg-surface">
            <TaskTable
              tasks={tasks}
              projectEndDate={p.end_date}
              empty="Nothing here yet. Open a workstream above to add a task, or fill a seat — a new crew member arrives with their own obligations."
            />
          </div>

          {gaps > 0 && (
            <p className="mt-2 text-[12px] text-muted">
              <Warn>{gaps} clearance{gaps > 1 ? 's' : ''} expire before the job ends</Warn>
            </p>
          )}
        </section>
      )}

      {/* ------------------------------------------------------------ history */}
      <section className="rounded-lg border border-line bg-surface">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-[13px] font-semibold text-ink">History</h2>
          <p className="mt-0.5 text-[12px] text-muted">
            Everything that has happened to this project, newest first. A workstream that is
            pending today can still show the day it was finished.
          </p>
        </div>

        {trail.length === 0 ? (
          <Empty>Nothing logged yet.</Empty>
        ) : (
          <ul>
            {trail.map((e) => (
              <li key={e.id}
                  className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-line px-4 py-2.5 text-[13px] last:border-0">
                <span className="tabular w-[52px] shrink-0 text-[11px] text-faint">{stamp(e.created_at)}</span>
                <EventDetail event={e} />
                <span className="ml-auto flex items-center gap-2">
                  <EventVerb action={e.action} />
                  <span className="text-[11px] text-faint">{e.actor}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
