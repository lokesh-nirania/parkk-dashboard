import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { OWNER_LABEL, type Task } from '@/lib/types';
import { PageHeader, Meter, Chip, Warn, Empty, Stat, QueryError, fmtDate } from '@/components/ui';
import { StatusSelect } from '@/components/status-select';
import { EditTaskButton } from '@/components/planning';

export const dynamic = 'force-dynamic';

/**
 * Kit and consumables across every project. Note what this is not: it is not
 * warehouse inventory. It tracks what a project needs and whether it turned up
 * — never what sits on a shelf.
 */
export default async function LogisticsPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('tasks_effective')
    .select('*')
    .eq('substage_key', 'logistics')
    .order('due_date', { nullsFirst: false });

  const rows = (data ?? []) as Task[];
  const outstanding = rows.filter((t) => t.is_live && t.status !== 'done' && t.status !== 'n_a').length;
  const blocked = rows.filter((t) => t.is_live && t.status === 'blocked').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Logistics"
        subtitle="What each project needs, and whether it has arrived. Not a warehouse — this only ever tracks demand and receipt."
      />

      <QueryError error={error} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Line items" value={rows.length} />
        <Stat label="Outstanding" value={outstanding} tone={outstanding ? 'warn' : 'ok'} />
        <Stat label="Blocked" value={blocked} tone={blocked ? 'danger' : 'ok'} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[900px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-line text-left">
              {['Project', 'Item', 'Progress', 'Status', 'Chase', 'Needed by', 'Note', ''].map((h) => (
                <th key={h} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8}><Empty>
                Nothing declared yet. Logistics fills up from a project&rsquo;s planning page.
              </Empty></td></tr>
            )}

            {rows.map((t) => {
              const req = t.qty_required ?? 0;
              const done = t.qty_done ?? 0;
              return (
                <tr key={t.id} className="border-b border-line align-top last:border-0 hover:bg-surface-2">
                  <td className="px-4 py-2.5">
                    <Link href={`/projects/${t.project_id}`} className="text-muted hover:text-ink">
                      <span className="font-mono text-[11px] text-faint">{t.project_code}</span> {t.project_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-ink">
                    {t.title}
                    {t.subject && <div className="mt-0.5 text-[11px] text-faint">{t.subject}</div>}
                  </td>
                  <td className="px-4 py-2.5">
                    {req > 0 ? (
                      <div className="min-w-[110px]">
                        <div className="tabular mb-1 text-[11px] text-muted">{done}/{req}</div>
                        <Meter done={done} total={req} status={t.status} />
                      </div>
                    ) : <span className="text-faint">—</span>}
                  </td>
                  <td className="px-4 py-2.5"><StatusSelect itemId={t.id} status={t.status} /></td>
                  <td className="px-4 py-2.5"><Chip>{OWNER_LABEL[t.owner_party]}</Chip></td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted">
                    {fmtDate(t.due_date)}
                    {t.is_overdue && <div className="mt-0.5"><Warn>overdue</Warn></div>}
                  </td>
                  <td className="max-w-[300px] px-4 py-2.5 text-[12px] leading-relaxed text-faint">{t.note ?? ''}</td>
                  <td className="px-4 py-2.5 text-right"><EditTaskButton task={t} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
