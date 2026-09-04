import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { BoardRow } from '@/lib/types';
import { PageHeader, TMinus, Empty, fmtDate, Warn, Btn, DayShift } from '@/components/ui';
import { StageChip } from '@/components/stage-chip';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('project_board')
    .select('*')
    .order('start_date', { nullsFirst: false });

  const rows = (data ?? []) as BoardRow[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        subtitle="Every project, at every stage — including the ones planning has not opened on yet."
        right={<Btn href="/projects/new" variant="primary">New project</Btn>}
      />

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[860px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-line text-left">
              {['Project', 'Stage', 'Start', 'End', 'Manager', 'Crew', 'Flags'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7}><Empty>
                Nothing here yet — projects start life as a quote.{' '}
                <Link href="/projects/new" className="underline underline-offset-2 hover:text-muted">
                  Create one
                </Link>.
              </Empty></td></tr>
            )}
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                <td className="px-4 py-3">
                  <Link href={`/projects/${p.id}`} className="group block min-w-[240px]">
                    <div className="font-medium text-ink group-hover:underline underline-offset-2">{p.name}</div>
                    <div className="mt-0.5 text-[11px] text-faint">
                      <span className="font-mono">{p.code}</span>
                      {p.client_name && <> · {p.client_name}</>}
                      {p.vessel_name && <> · {p.vessel_name}</>}
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3"><StageChip status={p.status} size="sm" /></td>
                {/* An unconfirmed date says so. A confirmed one that has moved
                    says how far, because that is the number nobody remembers. */}
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-ink">{fmtDate(p.start_date)}</span>
                    {p.confirmed_start_date === null ? (
                      <span className="text-[11px] text-faint">est.</span>
                    ) : (
                      <DayShift days={p.schedule_shift_days} title="Moved since it was confirmed" />
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px]"><TMinus days={p.days_to_start} /></div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-muted">{fmtDate(p.end_date)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-muted">
                  {p.manager_names ?? <span className="text-faint">—</span>}
                </td>
                <td className="tabular whitespace-nowrap px-4 py-3 text-muted">
                  {p.seats_total === 0
                    ? (p.team_size ? <span className="text-faint">{p.team_size} planned</span> : '—')
                    : `${p.seats_filled}/${p.seats_total}`}
                  {p.seats_released > 0 && (
                    <span className="ml-1 text-[11px] text-faint">+{p.seats_released} off</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {p.blocked_count > 0 && <Warn>{p.blocked_count} blocked</Warn>}
                    {p.expiry_gap_count > 0 && <Warn>{p.expiry_gap_count} expiring</Warn>}
                    {p.overdue_count > 0 && <Warn>{p.overdue_count} overdue</Warn>}
                    {p.blocked_count + p.expiry_gap_count + p.overdue_count === 0 && (
                      <span className="text-[11px] text-faint">clear</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
