'use client';

import { useState, useTransition } from 'react';
import { cancelProject, commenceProject } from '@/lib/actions';
import type { ActionResult } from '@/lib/actions';
import { GATE, type ProjectStatus } from '@/lib/types';
import { InlineForm, Mini, INPUT } from '@/components/inline-form';

// Only one gate is a plain button. Confirmation takes the agreed dates and crew
// size (ConfirmButton, in components/schedule), and planning opens because a
// manager was named rather than because anybody pressed "open planning"
// (ManagerPicker, in components/managers).
const RUNNERS: Partial<Record<ProjectStatus, (id: string) => Promise<ActionResult>>> = {
  planning: commenceProject,
};

/**
 * The one thing a project can do next.
 *
 * There is no free status dropdown anywhere in the app: a project moves forward
 * one gate at a time so that "confirmed" always means somebody confirmed it, on
 * a date, and the stage chip is never a guess. Failures come back from the
 * server as a sentence, because the reason a gate will not open is the useful
 * part — "planning is not finished: immigration & work permit".
 */
export function GateButton({
  projectId, status, size = 'md',
}: { projectId: string; status: ProjectStatus; size?: 'sm' | 'md' }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const gate = GATE[status];
  const run = RUNNERS[status];
  if (!gate || !run) return null;

  const pad = size === 'sm' ? 'px-2.5 py-1 text-[12px]' : 'px-3.5 py-2 text-[13px]';

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        title={gate.requires}
        onClick={() => {
          setError(null);
          start(async () => {
            const res = await run(projectId);
            if (res?.error) setError(res.error);
          });
        }}
        className={`inline-flex items-center rounded-md bg-ink font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-50 ${pad}`}
      >
        {pending ? 'Working…' : gate.label}
      </button>
      {error && (
        <span className="max-w-[420px] text-[11px] leading-relaxed" style={{ color: 'var(--st-blocked)' }}>
          {error}
        </span>
      )}
    </div>
  );
}

/**
 * The other way out, at any stage.
 *
 * The reason is optional on purpose. Most of the time nobody knows more than
 * "it did not happen", and a required box teaches people to type something
 * plausible instead of nothing.
 */
export function CancelButton({ projectId }: { projectId: string }) {
  return (
    <InlineForm
      trigger="Cancel"
      title="Cancel this project"
      note="It stops here and keeps everything it has. Nothing beneath it is deleted."
      submit="Cancel the project"
      run={(fd) => cancelProject(projectId, fd)}
      width={280}
    >
      {() => (
        <Mini label="Why (optional)">
          <input name="reason" className={INPUT} placeholder="Client put the docking back to next year" />
        </Mini>
      )}
    </InlineForm>
  );
}
