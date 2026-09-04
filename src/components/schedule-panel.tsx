import {
  ACTION_LABEL, DATE_FIELD_LABEL, TERMINAL,
  type BoardRow, type DateField, type ScheduleEvent,
} from '@/lib/types';
import { DayShift, fmtDate } from '@/components/ui';
import { ConfirmButton, RescheduleButton } from '@/components/schedule';

/* ============================================================================
 * When is this job, and what has it been?
 *
 * Three rows, because a project's dates have three different kinds of truth:
 * what we quoted, what the client agreed to, and where the job actually sits
 * this morning. Collapsing them into one field is how a business ends up
 * arguing about whether a job "slipped" — everyone remembers a different one of
 * the three. Underneath, every move on the record, with who moved it and why.
 * ========================================================================== */

function stamp(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

/** Days between two yyyy-mm-dd dates, or null if either is missing. */
function gap(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  return Math.round(
    (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000,
  );
}

/**
 * One window, with each end carrying its own drift. Both dates get a delta,
 * because a job that starts on time and runs two weeks long is a different
 * problem from one that starts late — and one number cannot say which.
 */
function Row({
  label, note, start, end, against, strong = false, muted = false,
}: {
  label: string; note?: string;
  start: string | null; end: string | null;
  /** The window this one is measured against, if any. */
  against?: { start: string | null; end: string | null; what: string };
  strong?: boolean; muted?: boolean;
}) {
  const tone = strong ? 'font-medium text-ink' : muted ? 'text-faint' : 'text-muted';
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-line py-2 last:border-0">
      <span className="w-[86px] shrink-0 text-[11px] font-medium uppercase tracking-[0.06em] text-faint">
        {label}
      </span>
      {start ? (
        <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
          <span className={`tabular text-[13px] ${tone}`}>{fmtDate(start)}</span>
          {against && (
            <DayShift days={gap(against.start, start)} title={`Start, against ${against.what}`} />
          )}
          <span className="text-[13px] text-faint">→</span>
          <span className={`tabular text-[13px] ${tone}`}>{fmtDate(end)}</span>
          {against && (
            <DayShift days={gap(against.end, end)} title={`End, against ${against.what}`} />
          )}
        </span>
      ) : (
        <span className="text-[13px] text-faint">—</span>
      )}
      {note && <span className="ml-1 text-[11px] text-faint">{note}</span>}
    </div>
  );
}

export function SchedulePanel({
  project: p, events,
}: { project: BoardRow; events: ScheduleEvent[] }) {
  const quoting = p.status === 'quoted';
  const closed = TERMINAL.includes(p.status);
  const confirmed = p.confirmed_start_date !== null;
  // Either end of the window moving counts as a move: a job that still starts
  // on the confirmed day but now runs a fortnight longer has moved.
  const moved =
    p.start_date !== p.confirmed_start_date || p.end_date !== p.confirmed_end_date;

  return (
    <section className="rounded-lg border border-line bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 className="text-[13px] font-semibold text-ink">Schedule</h2>
          <p className="mt-0.5 text-[12px] text-muted">
            {confirmed
              ? 'Confirmed dates are the baseline. Every move since is on the record below.'
              : 'Estimated only. Nothing here is agreed until the confirm gate.'}
          </p>
        </div>
        <div className="flex shrink-0 items-start gap-1.5">
          {quoting && <ConfirmButton project={p} size="sm" />}
          {!closed && <RescheduleButton project={p} />}
        </div>
      </div>

      <div className="px-4 py-1">
        <Row
          label="Quoted"
          start={p.est_start_date}
          end={p.est_end_date}
          muted={confirmed}
          strong={!confirmed}
          note={confirmed ? undefined : 'not agreed yet'}
        />
        <Row
          label="Confirmed"
          start={p.confirmed_start_date}
          end={p.confirmed_end_date}
          muted={!confirmed}
          against={{ start: p.est_start_date, end: p.est_end_date, what: 'the quote' }}
          note={confirmed ? 'the baseline' : 'pending confirmation'}
        />
        {confirmed && (
          <Row
            label="Now"
            start={p.start_date}
            end={p.end_date}
            strong
            against={{
              start: p.confirmed_start_date, end: p.confirmed_end_date,
              what: 'the confirmed dates',
            }}
            note={
              moved
                ? `moved ${p.reschedule_count === 1 ? 'once' : `${p.reschedule_count} times`} since confirmation`
                : 'running to the confirmed dates'
            }
          />
        )}
      </div>

      {/*
        The history is the point of the whole panel. A date that changed and
        left nothing behind is the failure this replaces — somebody rebooks
        fourteen flights in March and by May nobody can say who asked for it.
      */}
      <div className="border-t border-line px-4 py-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">
          History
          {events.length > 0 && <span className="ml-1.5 tabular font-normal">{events.length}</span>}
        </h3>

        {events.length === 0 ? (
          <p className="mt-2 text-[12px] text-faint">
            Nothing has moved yet. Every change to these dates is recorded here, with who and why.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {events.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[12px]">
                <span className="tabular w-[46px] shrink-0 text-[11px] text-faint">
                  {stamp(e.created_at)}
                </span>
                <span className="text-muted">
                  {DATE_FIELD_LABEL[e.field as DateField] ?? e.field}
                </span>
                <span className="tabular text-ink">
                  {e.old_value ? `${fmtDate(e.old_value)} → ` : 'set '}
                  {fmtDate(e.new_value)}
                </span>
                <DayShift days={e.shift_days} />
                {e.reason && <span className="text-faint">“{e.reason}”</span>}
                <span className="ml-auto flex items-center gap-2 text-[11px] text-faint">
                  <span>{ACTION_LABEL[e.action] ?? e.action.replace(/_/g, ' ')}</span>
                  <span>{e.actor}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
