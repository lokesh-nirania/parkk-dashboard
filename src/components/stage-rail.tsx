import { PROJECT_STATUS_LABEL, STAGE_INDEX, TERMINAL, type BoardRow, type StagePeriod } from '@/lib/types';

/* ============================================================================
 * Where the project has been, and for how long.
 *
 * The chip says where it is now. This says how it got here — which is the
 * question somebody asks when a job is late and nobody can remember whether it
 * sat unconfirmed for five weeks or planning ran long.
 * ========================================================================== */

const RAIL: { status: 'quoted' | 'confirmed' | 'planning' | 'in_progress' | 'invoicing'; label: string }[] = [
  { status: 'quoted',      label: 'Quote' },
  { status: 'confirmed',   label: 'Confirmed' },
  { status: 'planning',    label: 'Planning' },
  { status: 'in_progress', label: 'Execution' },
  { status: 'invoicing',   label: 'Invoicing' },
];

function days(n: number) {
  return n === 0 ? 'today' : n === 1 ? '1 day' : `${n} days`;
}

export function StageRail({
  project, periods,
}: { project: BoardRow; periods: StagePeriod[] }) {
  const spent = new Map<string, { days: number; open: boolean }>();
  for (const p of periods) {
    const prev = spent.get(p.status)?.days ?? 0;
    spent.set(p.status, { days: prev + p.days, open: p.left_at === null });
  }

  const here = STAGE_INDEX[project.status];
  const closed = TERMINAL.includes(project.status);

  return (
    <div className="flex flex-wrap items-stretch gap-1">
      {RAIL.map((s, i) => {
        const seen = spent.get(s.status);
        const passed = i < here;
        const current = i === here && !closed;

        return (
          <div
            key={s.status}
            className="min-w-[104px] flex-1 rounded-md border px-2.5 py-1.5"
            style={{
              borderColor: current ? 'var(--border-strong)' : 'var(--border)',
              background: current ? 'var(--surface)' : passed ? 'var(--surface-2)' : 'transparent',
            }}
          >
            <div
              className="text-[11px] font-medium"
              style={{ color: current ? 'var(--text)' : passed ? 'var(--text-muted)' : 'var(--text-faint)' }}
            >
              {s.label}
            </div>
            <div className="mt-0.5 text-[10px] text-faint">
              {seen
                ? seen.open ? `${days(seen.days)} so far` : days(seen.days)
                : passed ? '—' : 'not yet'}
            </div>
          </div>
        );
      })}

      {closed && (
        <div className="min-w-[104px] flex-1 rounded-md border border-line px-2.5 py-1.5">
          <div className="text-[11px] font-medium text-ink">{PROJECT_STATUS_LABEL[project.status]}</div>
          <div className="mt-0.5 text-[10px] text-faint">closed</div>
        </div>
      )}
    </div>
  );
}
