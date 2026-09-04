import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { BoardRow } from '@/lib/types';
import { PageHeader, TMinus, Stat, Btn, QueryError, fmtDate } from '@/components/ui';
import { StageChip } from '@/components/stage-chip';
import { CancelButton } from '@/components/gate-button';
import { ConfirmButton, RescheduleButton } from '@/components/schedule';

export const dynamic = 'force-dynamic';

function money(v: number | null, ccy: string | null) {
  if (v === null) return '—';
  return `${ccy ?? 'USD'} ${Math.round(v).toLocaleString('en-GB')}`;
}

/**
 * The pipeline, and the front door of the app.
 *
 * A quote is a real project row from the moment it is raised — it just has
 * nothing beneath it. That is the point: planning does not open until somebody
 * confirms the work, and the gap between those two facts is what this screen is.
 */
export default async function QuotationPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('project_board')
    .select('*')
    .in('status', ['quoted', 'cancelled'])
    .order('created_at', { ascending: false });

  const rows = (data ?? []) as BoardRow[];
  const open = rows.filter((p) => p.status === 'quoted');
  const cancelled = rows.filter((p) => p.status === 'cancelled');

  const value = open.reduce((n, p) => n + (p.quote_value ?? 0), 0);
  const seats = open.reduce((n, p) => n + (p.team_size ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotation"
        subtitle="Work that is quoted but not yet won. Every date here is an estimate — confirming one is what turns it into a commitment, and opens planning."
        right={<Btn href="/projects/new" variant="primary">New project</Btn>}
      />

      <QueryError error={error} />

      {open.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Open quotes" value={open.length} />
          <Stat label="Crew if all won" value={seats} />
          <Stat label="Value" value={value ? Math.round(value).toLocaleString('en-GB') : '—'} />
          <Stat label="Cancelled" value={cancelled.length} />
        </div>
      )}

      {open.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
          <p className="text-[14px] font-medium text-ink">Nothing quoted yet.</p>
          <p className="mx-auto mt-1.5 max-w-[440px] text-[13px] leading-relaxed text-muted">
            There is no demo data in this system. Every project, every seat and every
            visa on the board was put there by somebody — starting here.
          </p>
          <div className="mt-4 flex justify-center">
            <Btn href="/projects/new" variant="primary">Create the first quote</Btn>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[940px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line text-left">
                {['Project', 'Stage', 'Est. start', 'Team', 'Value', ''].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {open.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0 align-middle hover:bg-surface-2">
                  <td className="px-4 py-3">
                    <Link href={`/projects/${p.id}`} className="group block min-w-[240px]">
                      <div className="font-medium text-ink underline-offset-2 group-hover:underline">{p.name}</div>
                      <div className="mt-0.5 text-[11px] text-faint">
                        <span className="font-mono">{p.code}</span>
                        {p.client_name && <> · {p.client_name}</>}
                        {p.location && <> · {p.location}</>}
                      </div>
                      {p.scope_note && (
                        <p className="mt-1 line-clamp-2 max-w-[380px] text-[12px] leading-relaxed text-muted">
                          {p.scope_note}
                        </p>
                      )}
                    </Link>
                  </td>
                  <td className="px-4 py-3"><StageChip status={p.status} size="sm" /></td>
                  {/* An estimate, and labelled as one. Nothing on this screen
                      has been agreed to by anybody yet. */}
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="text-ink">{fmtDate(p.est_start_date)}</div>
                    <div className="mt-0.5 text-[11px]"><TMinus days={p.days_to_start} /></div>
                  </td>
                  <td className="tabular whitespace-nowrap px-4 py-3 text-muted">
                    {p.team_size ?? '—'}
                  </td>
                  <td className="tabular whitespace-nowrap px-4 py-3 text-muted">
                    {money(p.quote_value, p.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <ConfirmButton project={p} size="sm" />
                      <RescheduleButton project={p} />
                      <CancelButton projectId={p.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {cancelled.length > 0 && (
        <div>
          <h2 className="mb-2 text-[13px] font-semibold text-ink">
            Cancelled <span className="ml-1 tabular font-normal text-faint">{cancelled.length}</span>
          </h2>
          <div className="overflow-hidden rounded-lg border border-line bg-surface">
            <table className="w-full border-collapse text-[13px]">
              <tbody>
                {cancelled.map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5">
                      <Link href={`/projects/${p.id}`} className="text-muted hover:text-ink">
                        <span className="font-mono text-[11px] text-faint">{p.code}</span> {p.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-faint">
                      {p.cancel_reason ?? 'No reason recorded'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
