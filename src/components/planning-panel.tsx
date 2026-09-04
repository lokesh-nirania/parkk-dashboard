'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  STATUS_LABEL,
  type Person, type Seat, type Substage, type Task, type Worker,
} from '@/lib/types';
import { Meter, StatusDot, Warn } from '@/components/ui';
import { StatusSelect } from '@/components/status-select';
import { Sheet } from '@/components/sheet';
import { TaskTable } from '@/components/task-table';
import { CrewTable } from '@/components/crew-panel';
import { AddTaskButton, SubstageOwnerSelect } from '@/components/planning';
import { AddSeatsButton } from '@/components/crew';

/* ============================================================================
 * The planning workstreams, and one of them opened up.
 *
 * Clicking a card used to filter a table far below the fold, which looked like
 * nothing had happened. It now opens a panel over the page: the work is in
 * front of you, the project is still behind it, and closing puts you back.
 *
 * Everything the panel shows was already fetched for the page, so opening one
 * costs no request. Actions inside it revalidate as usual, React keeps the
 * panel open across the refresh, and the card underneath updates at the same
 * moment — which is why nothing here has to reload anything by hand.
 * ========================================================================== */

export function PlanningPanel({
  projectId, subs, tasks, seats, people, workers, managers, seatOptions,
  projectEndDate, initialSub,
}: {
  projectId: string;
  subs: Substage[];
  tasks: Task[];
  seats: Seat[];
  people: Person[];
  workers: Worker[];
  managers: Person[];
  seatOptions: { id: string; label: string }[];
  projectEndDate: string | null;
  /** ?sub=<id>, so an old link still opens the workstream it names. */
  initialSub?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(initialSub ?? null);
  const open = subs.find((s) => s.id === openId) ?? null;

  // The URL follows the panel, so a workstream stays linkable and Back closes
  // it. pushState rather than a router push: the data is already here, and a
  // navigation would re-fetch the whole page to show what is on screen.
  const show = useCallback((id: string | null) => {
    setOpenId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('sub', id); else url.searchParams.delete('sub');
    window.history.pushState(null, '', url);
  }, []);

  useEffect(() => {
    const onPop = () => setOpenId(new URLSearchParams(window.location.search).get('sub'));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const beneath = open
    ? tasks.filter((t) => t.substage_id === open.id)
    : [];

  return (
    <>
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {subs.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => show(s.id)}
            className="group rounded-lg border border-line bg-surface p-3 text-left transition hover:border-line-strong hover:bg-surface-2"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[12px] font-medium text-ink">
                <StatusDot status={s.effective_status} />
                <span className="underline-offset-2 group-hover:underline">{s.title}</span>
              </span>
              <span className="tabular shrink-0 text-[11px] text-muted">
                {s.total === 0 ? 'empty' : `${s.done}/${s.total}`}
              </span>
            </div>

            <div className="mt-2.5"><Meter done={s.done} total={s.total} status={s.effective_status} /></div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-faint">
              <span>{STATUS_LABEL[s.effective_status]}</span>
              {s.owner_short && <span>· {s.owner_short}</span>}
              {s.expiry_gaps > 0 && <Warn>{s.expiry_gaps} expiring</Warn>}
              {s.overdue > 0 && <Warn>{s.overdue} overdue</Warn>}
            </div>
          </button>
        ))}
      </div>

      <Sheet
        open={open !== null}
        onClose={() => show(null)}
        eyebrow="Workstream"
        title={open ? (
          <>
            <StatusDot status={open.effective_status} />
            {open.title}
            <span className="tabular text-[12px] font-normal text-muted">
              {open.total === 0 ? 'nothing beneath it yet' : `${open.done}/${open.total}`}
            </span>
          </>
        ) : ''}
        actions={open && (open.unit === 'seats'
          ? <AddSeatsButton projectId={projectId} />
          : <AddTaskButton substage={open} seats={seatOptions} />)}
      >
        {open && (
          <>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line px-5 py-3 text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="uppercase tracking-[0.06em] text-faint">Status</span>
                {open.is_derived ? (
                  // Something is beneath it, so the status is the worst of that
                  // and nobody gets to type over it.
                  <span className="text-muted">{STATUS_LABEL[open.effective_status]} — from what is beneath it</span>
                ) : (
                  <StatusSelect itemId={open.id} status={open.status} kind="substage" />
                )}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="uppercase tracking-[0.06em] text-faint">Owner</span>
                <SubstageOwnerSelect substage={open} people={people} />
              </span>
              {open.expiry_gaps > 0 && <Warn>{open.expiry_gaps} expiring before the job ends</Warn>}
              {open.overdue > 0 && <Warn>{open.overdue} overdue</Warn>}
            </div>

            {open.help && (
              <p className="border-b border-line px-5 py-2.5 text-[12px] leading-relaxed text-muted">
                {open.help}
              </p>
            )}

            {open.unit === 'seats' ? (
              <CrewTable seats={seats} tasks={tasks} workers={workers} managers={managers} />
            ) : (
              <TaskTable
                tasks={beneath}
                projectEndDate={projectEndDate}
                showWorkstream={false}
                empty="Nothing here yet. Add a task, or fill a seat — a new crew member arrives with their own obligations."
              />
            )}
          </>
        )}
      </Sheet>
    </>
  );
}
