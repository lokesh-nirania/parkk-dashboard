'use client';

import { useActionState } from 'react';
import { addWorker, updateWorker } from '@/lib/actions';
import type { ActionResult } from '@/lib/actions';
import type { Worker } from '@/lib/types';
import { InlineForm, Mini, INPUT } from '@/components/inline-form';

/* ============================================================================
 * Crew records.
 *
 * Most are created by filling a seat — you find out somebody is on the job
 * before you find out their passport number. This is the other half: the bench
 * you know about in advance, and the details that arrive afterwards.
 * ========================================================================== */

const FIELD =
  'w-full rounded-md border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none transition-colors placeholder:text-faint focus:border-line-strong';

export function AddWorkerForm() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    addWorker, null,
  );
  const fe = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-3">
      <label className="block">
        <span className="mb-1 block text-[12px] font-medium text-ink">Full name *</span>
        <input name="full_name" className={FIELD} placeholder="Ivan Petrov" />
        {fe.full_name && (
          <span className="mt-1 block text-[11px]" style={{ color: 'var(--st-blocked)' }}>{fe.full_name}</span>
        )}
      </label>

      <label className="block">
        <span className="mb-1 block text-[12px] font-medium text-ink">Trade *</span>
        <input name="trade" className={FIELD} placeholder="Blaster" />
        {fe.trade && (
          <span className="mt-1 block text-[11px]" style={{ color: 'var(--st-blocked)' }}>{fe.trade}</span>
        )}
      </label>

      <label className="block">
        <span className="mb-1 block text-[12px] font-medium text-ink">Nationality</span>
        <input name="nationality" className={FIELD} placeholder="Bulgarian" />
      </label>

      <label className="block">
        <span className="mb-1 block text-[12px] font-medium text-ink">Passport</span>
        <input name="passport_no" className={FIELD} placeholder="X1234567" />
      </label>

      <label className="block">
        <span className="mb-1 block text-[12px] font-medium text-ink">Passport expiry</span>
        <input type="date" name="passport_expiry" className={FIELD} />
      </label>

      <label className="block">
        <span className="mb-1 block text-[12px] font-medium text-ink">Phone</span>
        <input name="phone" className={FIELD} placeholder="+359 ••• •••" />
      </label>

      <div className="flex items-center gap-3 sm:col-span-3">
        <button
          type="submit" disabled={pending}
          className="inline-flex items-center rounded-md bg-ink px-3.5 py-2 text-[13px] font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? 'Adding…' : 'Add crew member'}
        </button>
        {state?.error && (
          <span className="text-[12px]" style={{ color: 'var(--st-blocked)' }}>{state.error}</span>
        )}
        {state?.ok && <span className="text-[12px] text-faint">Added.</span>}
      </div>
    </form>
  );
}

export function EditWorkerButton({ worker }: { worker: Worker }) {
  return (
    <InlineForm
      trigger="Edit"
      title={worker.full_name}
      note="The passport expiry is what the radar watches. Without it there is nothing to warn about."
      submit="Save"
      run={(fd) => updateWorker(worker.id, fd)}
      width={300}
    >
      {(fe) => (
        <>
          <Mini label="Trade" error={fe.trade}>
            <input name="trade" defaultValue={worker.trade} className={INPUT} />
          </Mini>
          <Mini label="Nationality">
            <input name="nationality" defaultValue={worker.nationality ?? ''} className={INPUT} />
          </Mini>
          <div className="grid grid-cols-2 gap-2">
            <Mini label="Passport">
              <input name="passport_no" defaultValue={worker.passport_no ?? ''} className={INPUT} />
            </Mini>
            <Mini label="Expires">
              <input type="date" name="passport_expiry" defaultValue={worker.passport_expiry ?? ''} className={INPUT} />
            </Mini>
          </div>
          <Mini label="Phone">
            <input name="phone" defaultValue={worker.phone ?? ''} className={INPUT} />
          </Mini>
        </>
      )}
    </InlineForm>
  );
}
