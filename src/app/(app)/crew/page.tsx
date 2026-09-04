import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { Seat, Task, Worker } from '@/lib/types';
import { PageHeader, Card, Chip, Empty, Warn, StatusDot, Stat, QueryError, fmtDate, daysUntil } from '@/components/ui';
import { AddWorkerForm, EditWorkerButton } from '@/components/workers';

export const dynamic = 'force-dynamic';

/**
 * The trades, across every project. A worker is a person who holds seats — and
 * a seat that ended is still a seat they held, which is why nothing here is
 * counted by looking only at today.
 */
export default async function CrewPage() {
  const supabase = await createClient();

  const [{ data: workerRows, error }, { data: seatRows }, { data: taskRows }, { data: projectRows }] =
    await Promise.all([
      supabase.from('workers').select('*').order('full_name'),
      supabase.from('assignments').select('*'),
      supabase.from('tasks_effective').select('id, assignment_id, status, has_expiry_gap, is_live'),
      supabase.from('projects').select('id, code'),
    ]);

  const workers = (workerRows ?? []) as Worker[];
  const seats = (seatRows ?? []) as Seat[];
  const tasks = (taskRows ?? []) as Pick<Task, 'id' | 'assignment_id' | 'status' | 'has_expiry_gap' | 'is_live'>[];
  const codeOf = new Map(((projectRows ?? []) as { id: string; code: string }[]).map((p) => [p.id, p.code]));

  const seatsByWorker = new Map<string, Seat[]>();
  const workerOfSeat = new Map<string, string>();
  for (const s of seats) {
    if (!s.worker_id) continue;
    workerOfSeat.set(s.id, s.worker_id);
    seatsByWorker.set(s.worker_id, [...(seatsByWorker.get(s.worker_id) ?? []), s]);
  }

  const tally = new Map<string, { open: number; gaps: number }>();
  for (const t of tasks) {
    if (!t.assignment_id || !t.is_live) continue;
    const wid = workerOfSeat.get(t.assignment_id);
    if (!wid) continue;
    const row = tally.get(wid) ?? { open: 0, gaps: 0 };
    if (t.status !== 'done' && t.status !== 'n_a') row.open += 1;
    if (t.has_expiry_gap) row.gaps += 1;
    tally.set(wid, row);
  }

  const onAJob = workers.filter((w) => (seatsByWorker.get(w.id) ?? []).some((s) => !s.released_at));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Crew"
        subtitle="Everyone who has held a seat. Records are created by filling a seat on a project — there is no separate onboarding form."
      />

      <QueryError error={error} />

      <Card>
        <h2 className="text-[13px] font-semibold text-ink">Add somebody to the bench</h2>
        <p className="mb-3 mt-0.5 text-[12px] text-muted">
          Filling a seat creates the record too. This is for the people you know about before
          there is a seat to put them in.
        </p>
        <AddWorkerForm />
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="On file" value={workers.length} />
        <Stat label="On a job now" value={onAJob.length} />
        <Stat label="Outstanding obligations"
              value={[...tally.values()].reduce((n, t) => n + t.open, 0)} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[820px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-line text-left">
              {['Name', 'Trade', 'Seats', 'Outstanding', 'Passport', ''].map((h) => (
                <th key={h} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {workers.length === 0 && (
              <tr><td colSpan={6}><Empty>
                Nobody yet. Fill a seat on a project and the crew record is created there.
              </Empty></td></tr>
            )}

            {workers.map((w) => {
              const mine = seatsByWorker.get(w.id) ?? [];
              const live = mine.filter((s) => !s.released_at);
              const t = tally.get(w.id) ?? { open: 0, gaps: 0 };
              const passportDays = daysUntil(w.passport_expiry);

              return (
                <tr key={w.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                  <td className="px-4 py-3">
                    <Link href={`/crew/${w.id}`} className="font-medium text-ink underline-offset-2 hover:underline">
                      {w.full_name}
                    </Link>
                    {w.nationality && <div className="mt-0.5 text-[11px] text-faint">{w.nationality}</div>}
                  </td>
                  <td className="px-4 py-3 text-muted">{w.trade}</td>
                  <td className="px-4 py-3">
                    {mine.length === 0 ? (
                      <span className="text-faint">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {live.map((s) => (
                          <Link key={s.id} href={`/projects/${s.project_id}`}>
                            <Chip>{codeOf.get(s.project_id) ?? '—'}</Chip>
                          </Link>
                        ))}
                        {mine.length > live.length && (
                          <span className="text-[11px] text-faint">+{mine.length - live.length} past</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-muted">
                      <StatusDot status={t.open === 0 ? 'done' : 'not_started'} size={7} />
                      <span className="tabular">{t.open}</span>
                    </span>
                    {t.gaps > 0 && <span className="ml-2"><Warn>{t.gaps} expiring</Warn></span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">
                    {fmtDate(w.passport_expiry)}
                    {passportDays !== null && passportDays < 180 && (
                      <div className="mt-0.5"><Warn>{passportDays}d</Warn></div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {w.phone && <span className="text-[12px] text-faint">{w.phone}</span>}
                      <EditWorkerButton worker={w} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
