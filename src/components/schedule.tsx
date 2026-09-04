'use client';

import { confirmProject, rescheduleProject } from '@/lib/actions';
import type { BoardRow } from '@/lib/types';
import { InlineForm, Mini, INPUT } from '@/components/inline-form';

/* ============================================================================
 * The two writes that move a project's dates.
 *
 * Confirming is not "tick a box" — it is the client agreeing to a window and a
 * headcount, so the gate asks for all three and defaults them to what was
 * quoted. Rescheduling afterwards asks why, because the reason is the part
 * anybody still needs in three weeks.
 * ========================================================================== */

export function ConfirmButton({
  project, size = 'md',
}: { project: BoardRow; size?: 'sm' | 'md' }) {
  if (project.status !== 'quoted') return null;

  return (
    <InlineForm
      trigger="Confirm" size={size} primary
      title="Confirm the job"
      note="What the client agreed to. These become the baseline every later change is measured against."
      submit="Confirm"
      run={(fd) => confirmProject(project.id, fd)}
    >
      {(fe) => (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Mini label="Start" error={fe.start_date}>
              <input type="date" name="start_date" defaultValue={project.est_start_date ?? ''} className={INPUT} />
            </Mini>
            <Mini label="End" error={fe.end_date}>
              <input type="date" name="end_date" defaultValue={project.est_end_date ?? ''} className={INPUT} />
            </Mini>
          </div>
          <Mini label="Crew size" error={fe.team_size}>
            <input
              type="number" name="team_size" min={1} max={500} step={1}
              defaultValue={project.team_size ?? ''} className={INPUT}
            />
          </Mini>
          <Mini label="Note (optional)">
            <input name="reason" placeholder="Client moved it a week" className={INPUT} />
          </Mini>
        </>
      )}
    </InlineForm>
  );
}

/**
 * Moving the dates after they exist.
 *
 * While the quote is open the whole estimate is in play — the client came back
 * wanting a different window, a different crew and different work, usually all
 * three at once — and the reason is optional because nothing is committed yet.
 * Once confirmed only the dates move, the reason is required, and it is measured
 * against a baseline that does not.
 */
export function RescheduleButton({
  project, label,
}: { project: BoardRow; label?: string }) {
  const quoting = project.status === 'quoted';
  const start = quoting ? project.est_start_date : project.start_date;
  const end = quoting ? project.est_end_date : project.end_date;

  return (
    <InlineForm
      trigger={label ?? (quoting ? 'Revise estimate' : 'Change dates')}
      title={quoting ? 'Revise the estimate' : 'Move the dates'}
      note={quoting
        ? 'Nothing is committed yet — this just updates what the quote says.'
        : 'The confirmed baseline does not move. This records how far the job has drifted from it, and why.'}
      submit={quoting ? 'Update estimate' : 'Record the change'}
      run={(fd) => rescheduleProject(project.id, fd)}
    >
      {(fe) => (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Mini label="Start" error={fe.start_date}>
              <input type="date" name="start_date" defaultValue={start ?? ''} className={INPUT} />
            </Mini>
            <Mini label="End" error={fe.end_date}>
              <input type="date" name="end_date" defaultValue={end ?? ''} className={INPUT} />
            </Mini>
          </div>
          {quoting && (
            <>
              <Mini label="Estimated crew" error={fe.team_size}>
                <input
                  type="number" name="team_size" min={1} max={500} step={1}
                  defaultValue={project.team_size ?? ''} className={INPUT}
                />
              </Mini>
              <Mini label="Scope">
                <textarea
                  name="scope_note" rows={3} defaultValue={project.scope_note ?? ''}
                  className={INPUT} placeholder="What is actually being quoted"
                />
              </Mini>
            </>
          )}

          <Mini label={quoting ? 'Note (optional)' : 'Why'} error={fe.reason}>
            <input
              name="reason"
              placeholder={quoting ? 'Client asked for later' : 'Yard slipped the docking window'}
              className={INPUT}
            />
          </Mini>
        </>
      )}
    </InlineForm>
  );
}
