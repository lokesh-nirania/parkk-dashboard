'use client';

import { useState, useTransition } from 'react';
import { setSubstageStatus, setTaskStatus } from '@/lib/actions';
import { ITEM_STATUSES, STATUS_LABEL, type ItemStatus } from '@/lib/types';
import { StatusPill } from './ui';

/**
 * Click the pill, pick a status. The same control drives a task and a workstream
 * — a workstream only offers it while nothing is beneath it, because after that
 * its status is derived and typing over it would be a lie.
 */
export function StatusSelect({
  itemId, status, kind = 'task',
}: { itemId: string; status: ItemStatus; kind?: 'task' | 'substage' }) {
  const [open, setOpen] = useState(false);
  const [optimistic, setOptimistic] = useState(status);
  const [pending, startTransition] = useTransition();

  function pick(next: ItemStatus) {
    setOpen(false);
    if (next === optimistic) return;
    const previous = optimistic;
    setOptimistic(next);
    startTransition(async () => {
      const res = kind === 'substage'
        ? await setSubstageStatus(itemId, next)
        : await setTaskStatus(itemId, next);
      if (res?.error) setOptimistic(previous);
    });
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        className={`cursor-pointer transition-opacity hover:opacity-75 ${pending ? 'opacity-50' : ''}`}
        title="Change status"
      >
        <StatusPill status={optimistic} compact />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-[170px] overflow-hidden rounded-md border border-line bg-surface py-1 shadow-lg">
          {ITEM_STATUSES.map((s) => (
            <button
              key={s}
              onMouseDown={(e) => { e.preventDefault(); pick(s); }}
              className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] transition-colors hover:bg-surface-2 ${
                s === optimistic ? 'font-medium text-ink' : 'text-muted'
              }`}
            >
              <StatusPill status={s} compact />
              <span className="sr-only">{STATUS_LABEL[s]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
