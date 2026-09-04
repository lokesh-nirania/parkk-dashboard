'use client';

import type { ReactNode } from 'react';
import { OWNER_LABEL, type Task } from '@/lib/types';
import { Chip, Empty, Warn, fmtDate, daysUntil } from '@/components/ui';
import { StatusSelect } from '@/components/status-select';
import { EditTaskButton } from '@/components/planning';

/* ============================================================================
 * The task rows, in one place.
 *
 * The project page lists every task on the job; a workstream panel lists the
 * ones beneath it. Same rows, same controls, same rules about what turns red —
 * which is only guaranteed while there is one component rather than two that
 * started identical.
 * ========================================================================== */

export function TaskTable({
  tasks, projectEndDate, showWorkstream = true, empty,
}: {
  tasks: Task[];
  projectEndDate: string | null;
  /** Off inside a workstream panel, where every row would repeat the same name. */
  showWorkstream?: boolean;
  empty?: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-line text-left">
            {['Subject', 'Task', 'Status', 'Chase', 'Needed by', 'Valid to', 'Note', ''].map((h) => (
              <th key={h} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tasks.length === 0 && (
            <tr><td colSpan={8}><Empty>
              {empty ?? 'Nothing here yet.'}
            </Empty></td></tr>
          )}

          {tasks.map((t) => (
            <tr key={t.id}
                className={`border-b border-line align-top last:border-0 hover:bg-surface-2 ${
                  t.is_live ? '' : 'opacity-55'
                }`}>
              <td className="px-4 py-2.5">
                <span className={t.subject ? 'font-medium text-ink' : 'text-muted'}>
                  {t.subject ?? '—'}
                </span>
                {showWorkstream && (
                  <div className="mt-0.5 text-[11px] text-faint">{t.substage_title}</div>
                )}
                {!t.is_live && <div className="mt-0.5 text-[11px] text-faint">off the job</div>}
              </td>
              <td className="px-4 py-2.5 text-muted">
                {t.title}
                {t.qty_required !== null && (
                  <span className="tabular ml-1.5 text-faint">{t.qty_done ?? 0}/{t.qty_required}</span>
                )}
              </td>
              <td className="px-4 py-2.5"><StatusSelect itemId={t.id} status={t.status} /></td>
              <td className="px-4 py-2.5"><Chip>{OWNER_LABEL[t.owner_party]}</Chip></td>
              <td className="whitespace-nowrap px-4 py-2.5 text-muted">
                {fmtDate(t.due_date)}
                {t.is_overdue && <div className="mt-0.5"><Warn>overdue</Warn></div>}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-muted">
                {fmtDate(t.valid_to)}
                {t.has_expiry_gap && (
                  <div className="mt-0.5">
                    <Warn>{Math.abs((daysUntil(t.valid_to) ?? 0) - (daysUntil(projectEndDate) ?? 0))}d short</Warn>
                  </div>
                )}
              </td>
              <td className="max-w-[300px] px-4 py-2.5 text-[12px] leading-relaxed text-faint">
                {t.note ?? ''}
              </td>
              <td className="px-4 py-2.5 text-right">
                {t.is_live && <EditTaskButton task={t} />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
