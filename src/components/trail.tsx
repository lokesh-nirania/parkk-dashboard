import {
  ACTION_LABEL, DATE_FIELDS, DATE_FIELD_LABEL,
  type ChangeEvent, type DateField,
} from '@/lib/types';
import { Chip, DayShift, fmtDate } from '@/components/ui';

/* ============================================================================
 * One line of the record, rendered the same way wherever it appears.
 *
 * A date move is drawn from its structured half rather than its sentence:
 * formatted dates, the size of the move, and the reason in the writer's own
 * words. Everything else draws the sentence its action wrote.
 * ========================================================================== */

const isDateField = (f: string | null): f is DateField =>
  f !== null && (DATE_FIELDS as readonly string[]).includes(f);

const dayGap = (from: string | null, to: string | null) =>
  from && to
    ? Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000)
    : null;

export function EventDetail({ event: e }: { event: ChangeEvent }) {
  if (!isDateField(e.field)) {
    return (
      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-ink">{e.detail}</span>
        {e.reason && !e.detail?.includes(e.reason) && (
          <span className="text-faint">“{e.reason}”</span>
        )}
      </span>
    );
  }

  return (
    <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className="text-muted">{DATE_FIELD_LABEL[e.field]}</span>
      <span className="tabular text-ink">
        {e.old_value ? `${fmtDate(e.old_value)} → ` : 'set '}
        {fmtDate(e.new_value)}
      </span>
      <DayShift days={dayGap(e.old_value, e.new_value)} />
      {e.reason && <span className="text-faint">“{e.reason}”</span>}
    </span>
  );
}

export function EventVerb({ action }: { action: string }) {
  return <Chip>{ACTION_LABEL[action] ?? action.replace(/_/g, ' ')}</Chip>;
}
