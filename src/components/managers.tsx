'use client';

import { useActionState } from 'react';
import {
  addPerson, assignManager, removeManager, setPersonActive,
} from '@/lib/actions';
import type { ActionResult } from '@/lib/actions';
import type { BoardRow, Person } from '@/lib/types';
import { ROLE_LABEL } from '@/lib/types';
import { ActionButton, InlineForm, Mini, INPUT } from '@/components/inline-form';

/* ============================================================================
 * Who runs the job.
 *
 * A manager is a person record before they are a login: assignable today,
 * invited later, and the same row either way. Naming the first one on a
 * confirmed project is what opens planning — the stage does not begin because
 * somebody pressed a button called "begin", it begins because a person is now
 * answerable for it.
 * ========================================================================== */

const FIELD =
  'w-full rounded-md border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none transition-colors placeholder:text-faint focus:border-line-strong';

export function AddPersonForm() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    addPerson, null,
  );
  const fe = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <label className="block">
        <span className="mb-1 block text-[12px] font-medium text-ink">Full name *</span>
        <input name="full_name" className={FIELD} placeholder="Varsha Menon" />
        {fe.full_name && (
          <span className="mt-1 block text-[11px]" style={{ color: 'var(--st-blocked)' }}>{fe.full_name}</span>
        )}
      </label>

      <label className="block">
        <span className="mb-1 block text-[12px] font-medium text-ink">Email</span>
        <input name="email" type="email" className={FIELD} placeholder="varsha@parkk.example" />
        <span className="mt-1 block text-[11px] text-faint">
          {fe.email ?? 'Where the invite goes when logins are switched on.'}
        </span>
      </label>

      <label className="block">
        <span className="mb-1 block text-[12px] font-medium text-ink">Phone</span>
        <input name="phone" className={FIELD} placeholder="+91 98••• •••••" />
      </label>

      <label className="block">
        <span className="mb-1 block text-[12px] font-medium text-ink">Role</span>
        <select name="role" defaultValue="manager" className={FIELD}>
          <option value="manager">{ROLE_LABEL.manager}</option>
          <option value="admin">{ROLE_LABEL.admin}</option>
        </select>
        <span className="mt-1 block text-[11px] text-faint">
          A manager runs projects. An admin does everything, including this page.
        </span>
      </label>

      <div className="flex items-center gap-3 sm:col-span-2">
        <button
          type="submit" disabled={pending}
          className="inline-flex items-center rounded-md bg-ink px-3.5 py-2 text-[13px] font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? 'Adding…' : 'Add person'}
        </button>
        {state?.error && (
          <span className="text-[12px]" style={{ color: 'var(--st-blocked)' }}>{state.error}</span>
        )}
        {state?.ok && <span className="text-[12px] text-faint">Added.</span>}
      </div>
    </form>
  );
}

export function PersonActiveButton({ person }: { person: Person }) {
  return (
    <ActionButton
      label={person.is_active ? 'Deactivate' : 'Reactivate'}
      run={() => setPersonActive(person.id, !person.is_active)}
      confirmLabel={person.is_active ? 'Confirm' : undefined}
      danger={person.is_active}
    />
  );
}

/**
 * The gate out of confirmed, and the ordinary "put another manager on it"
 * control afterwards. It is the same write either way — the first one just
 * happens to open planning.
 */
export function ManagerPicker({
  project, people,
}: { project: BoardRow; people: Person[] }) {
  const first = project.manager_count === 0;
  const opensPlanning = first && project.status === 'confirmed';

  if (people.length === 0) {
    return (
      <span className="text-[12px] text-faint">
        No managers on file yet — add one first.
      </span>
    );
  }

  return (
    <InlineForm
      trigger={first ? 'Assign a manager' : 'Add another'}
      primary={opensPlanning}
      title={opensPlanning ? 'Assign a manager' : 'Add a manager'}
      note={opensPlanning
        ? 'Naming a manager opens planning: six workstreams, and one empty seat per person in the confirmed crew size.'
        : 'A big job has more than one. Everybody assigned can be chased for it.'}
      submit={opensPlanning ? 'Assign and open planning' : 'Assign'}
      run={(fd) => assignManager(project.id, (fd.get('person_id') ?? '').toString())}
    >
      {() => (
        <Mini label="Manager">
          <select name="person_id" className={INPUT} defaultValue={people[0]?.id}>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}{p.role === 'admin' ? ' (admin)' : ''}
              </option>
            ))}
          </select>
        </Mini>
      )}
    </InlineForm>
  );
}

export function RemoveManagerButton({
  projectId, person,
}: { projectId: string; person: { id: string; full_name: string } }) {
  return (
    <ActionButton
      label="Remove"
      confirmLabel="Confirm"
      run={() => removeManager(projectId, person.id)}
    />
  );
}
