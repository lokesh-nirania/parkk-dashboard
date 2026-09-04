'use client';

import { useActionState, useState, type ReactNode } from 'react';
import type { ActionResult } from '@/lib/actions';

/* ============================================================================
 * The one interaction this app uses for every write that needs more than a
 * click: a small button that opens a small form, in place, next to the thing it
 * changes. No modals, no separate edit pages — the row you are looking at is
 * the row you are changing, and the error comes back as a sentence under the
 * field that caused it.
 * ========================================================================== */

export const INPUT =
  'w-full rounded-md border border-line bg-surface px-2 py-1 text-[12px] text-ink outline-none placeholder:text-faint focus:border-line-strong';

export function Mini({
  label, children, error,
}: { label: string; children: ReactNode; error?: string }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-[0.06em] text-faint">
        {label}
      </span>
      {children}
      {error && (
        <span className="mt-0.5 block text-[11px]" style={{ color: 'var(--st-blocked)' }}>{error}</span>
      )}
    </label>
  );
}

export function Trigger({
  label, size = 'md', primary = false, onClick, title,
}: {
  label: string; size?: 'sm' | 'md'; primary?: boolean;
  onClick: () => void; title?: string;
}) {
  const pad = size === 'sm' ? 'px-2.5 py-1 text-[12px]' : 'px-3.5 py-2 text-[13px]';
  const look = primary
    ? 'bg-ink text-bg hover:opacity-90'
    : 'border border-line bg-surface text-muted hover:bg-surface-2 hover:text-ink';
  return (
    <button
      type="button" onClick={onClick} title={title}
      className={`inline-flex items-center whitespace-nowrap rounded-md font-medium transition-colors ${pad} ${look}`}
    >
      {label}
    </button>
  );
}

/**
 * A button that becomes a form.
 *
 * The action closes the panel itself when the write succeeds, rather than an
 * effect noticing later — the panel shuts because the thing happened.
 */
export function InlineForm({
  trigger, title, note, submit, run, children, size = 'sm', primary = false, width = 300,
}: {
  trigger: string;
  title: string;
  note?: string;
  submit: string;
  run: (fd: FormData) => Promise<ActionResult>;
  /** Rendered with the field errors from the last attempt. */
  children: (fe: Record<string, string>) => ReactNode;
  size?: 'sm' | 'md';
  primary?: boolean;
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async (_prev, fd) => {
      const res = await run(fd);
      if (res?.ok) setOpen(false);
      return res;
    }, null,
  );

  if (!open) {
    return <Trigger label={trigger} size={size} primary={primary} onClick={() => setOpen(true)} />;
  }

  return (
    <div
      className="rounded-lg border border-line-strong bg-surface p-3 shadow-sm"
      style={{ width }}
    >
      <div className="mb-2.5">
        <div className="text-[12px] font-semibold text-ink">{title}</div>
        {note && <p className="mt-0.5 text-[11px] leading-relaxed text-faint">{note}</p>}
      </div>

      <form action={formAction} className="space-y-2">
        {children(state?.fieldErrors ?? {})}

        {state?.error && (
          <p className="text-[11px]" style={{ color: 'var(--st-blocked)' }}>{state.error}</p>
        )}

        <button
          type="submit" disabled={pending}
          className="w-full rounded-md bg-ink px-3 py-1.5 text-[12px] font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? 'Saving…' : submit}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setOpen(false)}
        className="mt-2 w-full text-center text-[11px] text-faint hover:text-muted"
      >
        Cancel
      </button>
    </div>
  );
}

/** A one-click write with its failure shown next to it. */
export function ActionButton({
  label, busyLabel, run, danger = false, confirmLabel,
}: {
  label: string; busyLabel?: string;
  run: () => Promise<ActionResult>;
  danger?: boolean;
  /** When set, the first click swaps the label for this one and only the second commits. */
  confirmLabel?: string;
}) {
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async () => {
      const res = await run();
      setError(res?.error ?? null);
      setArmed(false);
      return res;
    }, null,
  );
  void state;

  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <form action={formAction}>
        <button
          type={confirmLabel && !armed ? 'button' : 'submit'}
          disabled={pending}
          onClick={confirmLabel && !armed ? () => setArmed(true) : undefined}
          className="rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors hover:bg-surface-2 disabled:opacity-50"
          style={{ color: danger || armed ? 'var(--st-blocked)' : 'var(--text-muted)' }}
        >
          {pending ? (busyLabel ?? '…') : armed ? confirmLabel : label}
        </button>
      </form>
      {error && (
        <span className="max-w-[240px] text-[10px] leading-tight" style={{ color: 'var(--st-blocked)' }}>
          {error}
        </span>
      )}
    </span>
  );
}
