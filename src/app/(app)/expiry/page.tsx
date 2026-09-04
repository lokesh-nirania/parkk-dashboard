import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { Task, Worker } from '@/lib/types';
import { PageHeader, StatusPill, Warn, Empty, Stat, Card, QueryError, fmtDate, daysUntil } from '@/components/ui';

export const dynamic = 'force-dynamic';

/**
 * A yard pass valid to 20 March on a job running to 4 April is not green, even
 * though somebody ticked it done. Nobody catches that by eye across forty
 * workers, and it is the single rule in this system that justifies the model.
 */
export default async function ExpiryPage() {
  const supabase = await createClient();

  const [{ data: taskRows, error }, { data: workerRows }] = await Promise.all([
    supabase.from('tasks_effective').select('*').not('valid_to', 'is', null).order('valid_to'),
    supabase.from('workers').select('*').not('passport_expiry', 'is', null).order('passport_expiry'),
  ]);

  const tasks = ((taskRows ?? []) as Task[]).filter((t) => t.is_live);
  const workers = (workerRows ?? []) as Worker[];

  const gapped = tasks.filter((t) => t.has_expiry_gap);
  const soon = tasks.filter((t) => {
    const d = daysUntil(t.valid_to);
    return d !== null && d >= 0 && d <= 60;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expiry radar"
        subtitle="Clearances that run out before the job does. A pass with a date on it is only as good as the date."
      />

      <QueryError error={error} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Short of the job end" value={gapped.length} tone={gapped.length ? 'danger' : 'ok'} />
        <Stat label="Expiring ≤ 60 days" value={soon.length} tone={soon.length ? 'warn' : 'ok'} />
        <Stat label="Dated clearances" value={tasks.length} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[900px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-line text-left">
              {['Project', 'Who', 'Clearance', 'Status', 'Valid to', 'Job ends', 'Gap'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 && (
              <tr><td colSpan={7}><Empty>
                Nothing carries a validity date yet. Add one to a visa or a yard pass and it appears here.
              </Empty></td></tr>
            )}

            {tasks.map((t) => {
              const short = (daysUntil(t.project_end_date) ?? 0) - (daysUntil(t.valid_to) ?? 0);
              return (
                <tr key={t.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                  <td className="px-4 py-2.5">
                    <Link href={`/projects/${t.project_id}`} className="text-muted hover:text-ink">
                      <span className="font-mono text-[11px] text-faint">{t.project_code}</span> {t.project_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-ink">{t.subject ?? '—'}</td>
                  <td className="px-4 py-2.5 text-muted">
                    {t.title}
                    <div className="mt-0.5 text-[11px] text-faint">{t.substage_title}</div>
                  </td>
                  <td className="px-4 py-2.5"><StatusPill status={t.status} compact /></td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-ink">{fmtDate(t.valid_to)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted">{fmtDate(t.project_end_date)}</td>
                  <td className="px-4 py-2.5">
                    {t.has_expiry_gap ? <Warn>{short}d short</Warn> : <span className="text-[12px] text-faint">covers it</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {workers.length > 0 && (
        <Card>
          <h2 className="text-[13px] font-semibold text-ink">Passports</h2>
          <p className="mb-3 mt-0.5 text-[12px] text-muted">
            Held because clients ask for passport lists to issue yard passes, and because an expiry
            nobody checked is a flight nobody takes.
          </p>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {workers.map((w) => {
              const d = daysUntil(w.passport_expiry);
              return (
                <li key={w.id} className="flex items-baseline justify-between gap-3 text-[13px]">
                  <Link href={`/crew/${w.id}`} className="text-muted hover:text-ink">{w.full_name}</Link>
                  <span className="tabular text-[12px] text-faint">
                    {fmtDate(w.passport_expiry)}
                    {d !== null && d < 180 && <span className="ml-1.5"><Warn>{d}d</Warn></span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
