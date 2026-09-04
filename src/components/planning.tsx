'use client';

import { useId, useTransition, useState } from 'react';
import { addSubstage, addTask, setSubstageOwner, updateTask } from '@/lib/actions';
import { OWNER_LABEL, type OwnerParty, type Person, type Substage, type Task } from '@/lib/types';
import { InlineForm, Mini, INPUT } from '@/components/inline-form';

/* ============================================================================
 * Planning is the stage with depth: six workstreams that all run at once, each
 * holding whatever it needs to hold. Both of those are editable here — a task
 * nobody anticipated, and a workstream the template never knew about.
 * ========================================================================== */

const PARTIES: OwnerParty[] = ['us', 'client', 'agency'];

export function AddTaskButton({
  substage, seats,
}: {
  substage: Pick<Substage, 'id' | 'title'>;
  /** Open seats, so a task can be pinned to the person it belongs to. */
  seats: { id: string; label: string }[];
}) {
  return (
    <InlineForm
      trigger="Add task"
      title={`New task in ${substage.title}`}
      note="Anything that has to be true before the crew flies. It goes red on its own."
      submit="Add task"
      run={(fd) => addTask(substage.id, fd)}
      width={320}
    >
      {(fe) => (
        <>
          <Mini label="Task" error={fe.title}>
            <input name="title" className={INPUT} placeholder="Schengen work visa" autoFocus />
          </Mini>

          {seats.length > 0 && (
            <Mini label="For">
              <select name="assignment_id" className={INPUT} defaultValue="">
                <option value="">Not a person — kit, paperwork, the job itself</option>
                {seats.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </Mini>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Mini label="Chase who" error={fe.owner_party}>
              <select name="owner_party" defaultValue="us" className={INPUT}>
                {PARTIES.map((o) => <option key={o} value={o}>{OWNER_LABEL[o]}</option>)}
              </select>
            </Mini>
            <Mini label="Needed by">
              <input type="date" name="due_date" className={INPUT} />
            </Mini>
          </div>

          <Mini label="Valid to (optional)">
            <input type="date" name="valid_to" className={INPUT} />
          </Mini>
          <p className="text-[10px] leading-relaxed text-faint">
            A pass or visa that expires before the job ends turns the whole workstream red,
            whatever anybody ticked.
          </p>
        </>
      )}
    </InlineForm>
  );
}

export function AddSubstageButton({
  projectId, people,
}: { projectId: string; people: Person[] }) {
  return (
    <InlineForm
      trigger="Add workstream"
      title="New workstream"
      note="For work this job needs that the standard six do not cover. It sits beside them and is tracked the same way."
      submit="Add workstream"
      run={(fd) => addSubstage(projectId, fd)}
    >
      {(fe) => (
        <>
          <Mini label="Name" error={fe.title}>
            <input name="title" className={INPUT} placeholder="Class surveyor attendance" autoFocus />
          </Mini>
          <Mini label="Owner">
            <select name="owner_person_id" className={INPUT} defaultValue="">
              <option value="">Nobody yet</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </Mini>
          <Mini label="Note">
            <input name="note" className={INPUT} placeholder="Why this job needs it" />
          </Mini>
        </>
      )}
    </InlineForm>
  );
}

/** Who is on point for a workstream. Not a permission — anybody can edit anything. */
export function SubstageOwnerSelect({
  substage, people,
}: { substage: Pick<Substage, 'id' | 'owner_person_id'>; people: Person[] }) {
  const id = useId();
  const [pending, start] = useTransition();
  const [value, setValue] = useState(substage.owner_person_id ?? '');

  return (
    <select
      id={id}
      value={value}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        const previous = value;
        setValue(next);
        start(async () => {
          const res = await setSubstageOwner(substage.id, next || null);
          if (res?.error) setValue(previous);
        });
      }}
      className={`rounded border border-line bg-surface px-1.5 py-0.5 text-[11px] text-muted outline-none focus:border-line-strong ${
        pending ? 'opacity-50' : ''
      }`}
      title="Who is on point"
    >
      <option value="">Owner —</option>
      {people.map((p) => <option key={p.id} value={p.id}>{p.short_name}</option>)}
    </select>
  );
}

/**
 * The rest of a task, after somebody wrote it down in a hurry.
 *
 * Dates and quantities arrive later than the task does: the consulate gives an
 * appointment next week, the drums turn up eighteen at a time. Editing a
 * validity date here can turn the workstream red on its own, which is the point.
 */
export function EditTaskButton({ task }: { task: Task }) {
  return (
    <InlineForm
      trigger="Edit"
      title={task.title}
      note={task.subject ? `For ${task.subject}.` : 'Dates, quantities and the note.'}
      submit="Save"
      run={(fd) => updateTask(task.id, fd)}
      width={320}
    >
      {(fe) => (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Mini label="Needed by" error={fe.due_date}>
              <input type="date" name="due_date" defaultValue={task.due_date ?? ''} className={INPUT} />
            </Mini>
            <Mini label="Valid to" error={fe.valid_to}>
              <input type="date" name="valid_to" defaultValue={task.valid_to ?? ''} className={INPUT} />
            </Mini>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Mini label="Needed" error={fe.qty_required}>
              <input type="number" name="qty_required" min={0} defaultValue={task.qty_required ?? ''} className={INPUT} />
            </Mini>
            <Mini label="Received" error={fe.qty_done}>
              <input type="number" name="qty_done" min={0} defaultValue={task.qty_done ?? ''} className={INPUT} />
            </Mini>
          </div>

          <Mini label="Chase who" error={fe.owner_party}>
            <select name="owner_party" defaultValue={task.owner_party} className={INPUT}>
              {PARTIES.map((o) => <option key={o} value={o}>{OWNER_LABEL[o]}</option>)}
            </select>
          </Mini>

          <Mini label="Note">
            <input name="note" defaultValue={task.note ?? ''} className={INPUT}
                   placeholder="Why it is where it is" />
          </Mini>
        </>
      )}
    </InlineForm>
  );
}
