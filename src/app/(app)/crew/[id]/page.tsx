import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OWNER_LABEL, type Seat, type Task, type Worker } from '@/lib/types';
import {
  PageHeader, Chip, Empty, Warn, Stat, QueryError, fmtDate, daysUntil,
} from '@/components/ui';
import { StatusSelect } from '@/components/status-select';
import { EditWorkerButton } from '@/components/workers';
import { EditTaskButton } from '@/components/planning';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

/**
 * One person, every seat they have held and everything owed against each. The
 * page a coordinator opens when the consulate finally calls back.
 */
export default async function CrewMemberPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: worker }, { data: seatRows }, { data: taskRows, error }, { data: projectRows }] =
    await Promise.all([
      supabase.from('workers').select('*').eq('id', id).maybeSingle(),
      supabase.from('seats_effective').select('*').eq('worker_id', id).order('created_at'),
      supabase.from('tasks_effective').select('*').order('substage_title'),
      supabase.from('projects').select('id, code, name'),
    ]);

  if (!worker) notFound();
  const w = worker as Worker;
  const seats = (seatRows ?? []) as Seat[];
  const seatIds = new Set(seats.map((s) => s.id));
  const tasks = ((taskRows ?? []) as Task[]).filter((t) => t.assignment_id && seatIds.has(t.assignment_id));
  const projects = new Map(((projectRows ?? []) as { id: string; code: string; name: string }[])
    .map((p) => [p.id, p]));

  const live = seats.filter((s) => !s.released_at);
  const open = tasks.filter((t) => t.is_live && t.status !== 'done' && t.status !== 'n_a');
  const gaps = tasks.filter((t) => t.is_live && t.has_expiry_gap);
  const passportDays = daysUntil(w.passport_expiry);

  return (
    <div className="space-y-6">
      <PageHeader
        title={w.full_name}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{w.trade}</span>
            {w.nationality && <><span className="text-faint">·</span><span>{w.nationality}</span></>}
            {w.phone && <><span className="text-faint">·</span><span>{w.phone}</span></>}
          </span>
        }
        right={
          <>
            <EditWorkerButton worker={w} />
            <Link href="/crew" className="text-[13px] text-muted hover:text-ink">All crew</Link>
          </>
        }
      />

      <QueryError error={error} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="On a job" value={live.length} />
        <Stat label="Outstanding" value={open.length} tone={open.length ? 'warn' : 'ok'} />
        <Stat label="Expiring" value={gaps.length} tone={gaps.length ? 'danger' : 'ok'} />
        <Stat label="Passport"
              value={<span className="text-[15px]">{fmtDate(w.passport_expiry)}</span>}
              tone={passportDays !== null && passportDays < 180 ? 'warn' : undefined} />
      </div>

      <section>
        <h2 className="mb-2.5 text-[13px] font-semibold text-ink">Seats</h2>
        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          <table className="w-full border-collapse text-[13px]">
            <tbody>
              {seats.length === 0 && <tr><td><Empty>No seats yet.</Empty></td></tr>}
              {seats.map((s) => {
                const p = projects.get(s.project_id);
                return (
                  <tr key={s.id} className={`border-b border-line last:border-0 ${s.released_at ? 'opacity-55' : ''}`}>
                    <td className="px-4 py-2.5">
                      <Link href={`/projects/${s.project_id}`} className="text-ink hover:underline">
                        <span className="font-mono text-[11px] text-faint">{p?.code}</span> {p?.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-muted">Seat {s.seat_no} · {s.trade}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-muted">
                      {fmtDate(s.mobilize_on)} → {fmtDate(s.demobilize_on)}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-faint">
                      {s.released_at ? `off — ${s.release_reason}` : 'on the job'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2.5 text-[13px] font-semibold text-ink">
          Obligations
          <span className="ml-1.5 tabular font-normal text-faint">{tasks.length}</span>
        </h2>
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[760px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line text-left">
                {['Project', 'Workstream', 'Task', 'Status', 'Chase', 'Valid to', ''].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 && <tr><td colSpan={7}><Empty>Nothing owed.</Empty></td></tr>}
              {tasks.map((t) => (
                <tr key={t.id} className={`border-b border-line last:border-0 ${t.is_live ? '' : 'opacity-55'}`}>
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-[11px] text-faint">{t.project_code}</span>
                  </td>
                  <td className="px-4 py-2.5 text-muted">{t.substage_title}</td>
                  <td className="px-4 py-2.5 text-ink">{t.title}</td>
                  <td className="px-4 py-2.5"><StatusSelect itemId={t.id} status={t.status} /></td>
                  <td className="px-4 py-2.5"><Chip>{OWNER_LABEL[t.owner_party]}</Chip></td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted">
                    {fmtDate(t.valid_to)}
                    {t.has_expiry_gap && <div className="mt-0.5"><Warn>short of the job end</Warn></div>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {t.is_live && <EditTaskButton task={t} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
