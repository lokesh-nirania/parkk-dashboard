import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import {
  STATUS_LABEL, SUBSTAGE_KEYS, SUBSTAGE_LABEL,
  type BoardRow, type SubstageKey, type Substage,
} from '@/lib/types';
import { PageHeader, StatusDot, TMinus, Stat, Warn, Empty, QueryError } from '@/components/ui';

export const dynamic = 'force-dynamic';

// Not every project is in the readiness race. A quote has no plan yet and a
// finished job has no future, so neither belongs on a board about tomorrow.
const LIVE = ['planning', 'in_progress'];

/**
 * What a single cell says, in one line, without opening it.
 *
 * Always counts of things, never summed quantities — a logistics workstream
 * holds drums, tonnes and machines, and adding them gives a number that means
 * nothing. Quantities belong on the task, where the title names the unit.
 */
function cellSummary(s: Substage | undefined): string {
  if (!s) return '—';
  if (s.total === 0) return s.effective_status === 'n_a' ? 'n/a' : '—';
  if (s.effective_status === 'n_a') return 'n/a';
  if (s.done === s.total) return 'done';
  if (s.done === 0) {
    return s.effective_status === 'awaiting_external'
      ? 'awaiting' : STATUS_LABEL[s.effective_status].toLowerCase();
  }
  return `${s.done}/${s.total}`;
}

export default async function BoardPage() {
  const supabase = await createClient();

  const [{ data: projects, error }, { data: substages }] = await Promise.all([
    supabase.from('project_board').select('*').in('status', LIVE).order('start_date'),
    supabase.from('project_substage_effective').select('*'),
  ]);

  const rows = (projects ?? []) as BoardRow[];
  const byProject = new Map<string, Map<string, Substage>>();
  const extras = new Map<string, Substage[]>();

  for (const s of (substages ?? []) as Substage[]) {
    if (s.template_key) {
      if (!byProject.has(s.project_id)) byProject.set(s.project_id, new Map());
      byProject.get(s.project_id)!.set(s.template_key, s);
    } else {
      // Workstreams somebody added by hand have no column of their own. They
      // still count toward the project's flags — they just live on its page.
      extras.set(s.project_id, [...(extras.get(s.project_id) ?? []), s]);
    }
  }

  const startingSoon = rows.filter((r) => r.days_to_start !== null && r.days_to_start >= 0 && r.days_to_start <= 14);
  const blocked = rows.reduce((n, r) => n + r.blocked_count, 0);
  const gaps = rows.reduce((n, r) => n + r.expiry_gap_count, 0);
  const openSeats = rows.reduce((n, r) => n + (r.seats_total - r.seats_filled), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Readiness board"
        subtitle="Every live project, worst status per workstream. Click a cell to open what is behind it."
      />

      <QueryError error={error} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Live projects" value={rows.length} />
        <Stat label="Starting ≤ 14 days" value={startingSoon.length} tone={startingSoon.length ? 'warn' : undefined} />
        <Stat label="Blocked tasks" value={blocked} tone={blocked ? 'danger' : 'ok'} />
        <Stat label="Unfilled seats" value={openSeats} tone={openSeats ? 'warn' : 'ok'} />
      </div>

      {gaps > 0 && (
        <div className="st-blocked flex items-center gap-2 rounded-lg border px-3 py-2.5 text-[13px]"
             style={{ borderColor: 'color-mix(in oklab, var(--c) 28%, transparent)', background: 'var(--c-bg)' }}>
          <span style={{ color: 'var(--c)' }}>▲</span>
          <span className="text-ink">
            <strong className="font-semibold">{gaps}</strong>{' '}
            {gaps === 1 ? 'clearance expires' : 'clearances expire'} before its project ends — ticked done, still a gap.
          </span>
          <Link href="/expiry" className="ml-auto text-[12px] font-medium underline underline-offset-2" style={{ color: 'var(--c)' }}>
            Expiry radar
          </Link>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[980px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">Project</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">Start</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">Manager</th>
              {SUBSTAGE_KEYS.map((k) => (
                <th key={k} className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">
                  {SUBSTAGE_LABEL[k]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={9}><Empty>
                No live projects. Won work shows up here once a manager is named and planning opens.
              </Empty></td></tr>
            )}

            {rows.map((p) => {
              const cells = byProject.get(p.id);
              const extra = extras.get(p.id) ?? [];
              return (
                <tr key={p.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                  <td className="px-4 py-3">
                    <Link href={`/projects/${p.id}`} className="group block min-w-[220px]">
                      <div className="font-medium text-ink underline-offset-2 group-hover:underline">{p.name}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-faint">
                        <span className="font-mono">{p.code}</span>
                        <span>·</span>
                        <span>{p.shipyard_name ?? p.location}</span>
                        {extra.length > 0 && <><span>·</span><span>+{extra.length} more</span></>}
                      </div>
                    </Link>
                  </td>

                  <td className="whitespace-nowrap px-3 py-3"><TMinus days={p.days_to_start} /></td>

                  <td className="whitespace-nowrap px-3 py-3 text-muted">
                    {p.manager_names ?? <span className="text-faint">—</span>}
                  </td>

                  {SUBSTAGE_KEYS.map((k: SubstageKey) => {
                    const s = cells?.get(k);
                    const status = s?.effective_status ?? 'n_a';
                    return (
                      <td key={k} className="px-3 py-3">
                        <Link
                          href={s ? `/projects/${p.id}?sub=${s.id}` : `/projects/${p.id}`}
                          className="-mx-1.5 inline-flex items-center gap-1.5 rounded px-1.5 py-1 transition-colors hover:bg-surface"
                          title={`${SUBSTAGE_LABEL[k]} — ${STATUS_LABEL[status]}`}
                        >
                          <StatusDot status={status} />
                          <span className={`tabular whitespace-nowrap ${status === 'n_a' ? 'text-faint' : 'text-muted'}`}>
                            {cellSummary(s)}
                          </span>
                          {(s?.expiry_gaps ?? 0) > 0 && <Warn>exp</Warn>}
                        </Link>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-faint">
        {(['done', 'in_progress', 'awaiting_external', 'not_started', 'blocked', 'n_a'] as const).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <StatusDot status={s} size={7} />
            {STATUS_LABEL[s]}
          </span>
        ))}
        <span className="ml-auto">A cell takes the worst status of everything beneath it.</span>
      </div>
    </div>
  );
}
