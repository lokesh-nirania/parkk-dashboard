import { PENDING_LABEL, PROJECT_STATUS_LABEL, TERMINAL, type ProjectStatus } from '@/lib/types';

/**
 * "Quoted · pending confirmation".
 *
 * The stage a project is in is only half the story — what it is waiting for is
 * the half somebody can act on. Terminal states are pending nothing and say so
 * by staying quiet.
 */
export function StageChip({
  status, size = 'md',
}: { status: ProjectStatus; size?: 'sm' | 'md' }) {
  const pending = PENDING_LABEL[status];
  const terminal = TERMINAL.includes(status);
  const text = size === 'sm' ? 'text-[11px]' : 'text-[12px]';

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span
        className={`inline-flex items-center rounded border px-1.5 py-0.5 font-medium ${text}`}
        style={{
          color: terminal ? 'var(--text-faint)' : 'var(--text)',
          borderColor: 'var(--border-strong)',
          background: 'var(--surface-2)',
        }}
      >
        {PROJECT_STATUS_LABEL[status]}
      </span>
      {pending && (
        <span className={`${text} whitespace-nowrap text-faint`}>
          pending {pending}
        </span>
      )}
    </span>
  );
}
