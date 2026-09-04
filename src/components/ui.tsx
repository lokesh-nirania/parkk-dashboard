import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  type ItemStatus, type OwnerParty, type ProjectStatus,
  STATUS_LABEL, STATUS_HINT, OWNER_LABEL, PROJECT_STATUS_LABEL,
} from '@/lib/types';

/* ------------------------------------------------------------------ status */

export function StatusDot({ status, size = 8 }: { status: ItemStatus; size?: number }) {
  // Hollow means n/a only. 'Not started' six days out is the loudest grey on
  // the board, not the quietest — it must not read as 'nothing to see'.
  const hollow = status === 'n_a';
  return (
    <span
      className={`st-${status} inline-block shrink-0 rounded-full`}
      style={{
        width: size,
        height: size,
        background: hollow ? 'transparent' : 'var(--c)',
        boxShadow: `inset 0 0 0 ${hollow ? 1.5 : 0}px var(--c)`,
      }}
      aria-hidden
    />
  );
}

export function StatusPill({
  status, label, compact = false,
}: { status: ItemStatus; label?: string; compact?: boolean }) {
  return (
    <span
      className={`st-${status} inline-flex items-center gap-1.5 rounded-md border font-medium whitespace-nowrap ${
        compact ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-1 text-xs'
      }`}
      style={{ color: 'var(--c)', background: 'var(--c-bg)', borderColor: 'color-mix(in oklab, var(--c) 28%, transparent)' }}
      title={STATUS_HINT[status]}
    >
      <StatusDot status={status} size={6} />
      {label ?? STATUS_LABEL[status]}
    </span>
  );
}

/* --------------------------------------------------------------- the clock */

export function TMinus({ days, className = '' }: { days: number | null; className?: string }) {
  if (days === null) return <span className="text-faint">—</span>;

  // Under a week out is the only thing on the board allowed to shout.
  const urgent = days >= 0 && days <= 7;
  const running = days < 0;

  return (
    <span
      className={`tabular font-medium ${className}`}
      style={{ color: urgent ? 'var(--st-blocked)' : running ? 'var(--text-muted)' : 'var(--text)' }}
      title={running ? `Started ${-days} days ago` : `Starts in ${days} days`}
    >
      {running ? `T+${-days}` : `T−${days}`}
    </span>
  );
}

/**
 * A move, in days, signed. Later is the direction that costs money — flights
 * rebooked, visas that now expire mid-job — so it is the only one that takes a
 * colour. Zero renders nothing at all: a date that did not move is not news.
 */
export function DayShift({ days, title }: { days: number | null | undefined; title?: string }) {
  if (days === null || days === undefined || days === 0) return null;
  const later = days > 0;
  return (
    <span
      className="tabular inline-flex items-center rounded px-1 py-0.5 text-[11px] font-medium"
      title={title ?? (later ? `${days} days later` : `${-days} days earlier`)}
      style={
        later
          ? { color: 'var(--st-progress)', background: 'var(--st-progress-bg)' }
          : { color: 'var(--text-muted)', background: 'var(--surface-2)' }
      }
    >
      {later ? `+${days}d` : `${days}d`}
    </span>
  );
}

/* ------------------------------------------------------------------ layout */

export function PageHeader({
  title, subtitle, right,
}: { title: string; subtitle?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
      <div className="min-w-0">
        <h1 className="text-[19px] font-semibold tracking-[-0.01em] text-ink">{title}</h1>
        {subtitle && <div className="mt-1 text-[13px] text-muted">{subtitle}</div>}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  );
}

export function Card({
  children, className = '', pad = true,
}: { children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <div className={`rounded-lg border border-line bg-surface ${pad ? 'p-4' : ''} ${className}`}>
      {children}
    </div>
  );
}

export function Stat({
  label, value, tone,
}: { label: string; value: ReactNode; tone?: 'danger' | 'warn' | 'ok' }) {
  const color =
    tone === 'danger' ? 'var(--st-blocked)'
    : tone === 'warn' ? 'var(--st-progress)'
    : tone === 'ok'   ? 'var(--st-done)'
    : 'var(--text)';
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-faint">{label}</div>
      <div className="tabular mt-1.5 text-[22px] font-semibold leading-none" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ meters */

export function Meter({
  done, total, status,
}: { done: number; total: number; status: ItemStatus }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className={`st-${status} h-1.5 w-full overflow-hidden rounded-full`} style={{ background: 'var(--surface-2)' }}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--c)' }} />
    </div>
  );
}

/* -------------------------------------------------------------------- misc */

export function Chip({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex items-center rounded border border-line bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-muted"
    >
      {children}
    </span>
  );
}

export function OwnerChip({ owner }: { owner: OwnerParty }) {
  // Ownership does not change whether an item is red — only who you ring about it.
  return <Chip title={`Chased with: ${OWNER_LABEL[owner]}`}>{OWNER_LABEL[owner]}</Chip>;
}

export function ProjectStatusChip({ status }: { status: ProjectStatus }) {
  return <Chip>{PROJECT_STATUS_LABEL[status]}</Chip>;
}

export function Warn({ children }: { children: ReactNode }) {
  return (
    <span
      className="st-blocked inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium"
      style={{ color: 'var(--c)', background: 'var(--c-bg)' }}
    >
      ▲ {children}
    </span>
  );
}

/**
 * A failed query must never render as "nothing here". An empty state and a
 * broken view look identical to a viewer, and the difference is the whole
 * difference between "no work yet" and "the app is lying to you".
 */
export function QueryError({ error }: { error: { message: string } | null }) {
  if (!error) return null;
  return (
    <div
      className="st-blocked rounded-lg px-4 py-3 text-[12px]"
      style={{ color: 'var(--c)', background: 'var(--c-bg)' }}
    >
      <strong className="font-semibold">Could not load this.</strong> {error.message}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="px-4 py-10 text-center text-[13px] text-faint">{children}</div>;
}

export function Btn({
  children, href, onClick, variant = 'default', type, disabled,
}: {
  children: ReactNode; href?: string; onClick?: () => void;
  variant?: 'default' | 'primary' | 'ghost'; type?: 'button' | 'submit'; disabled?: boolean;
}) {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors disabled:opacity-50';
  const styles = {
    primary: 'bg-ink text-bg hover:opacity-90',
    default: 'border border-line bg-surface text-ink hover:bg-surface-2',
    ghost:   'text-muted hover:bg-surface-2 hover:text-ink',
  }[variant];

  if (href) return <Link href={href} className={`${base} ${styles}`}>{children}</Link>;
  return (
    <button type={type ?? 'button'} onClick={onClick} disabled={disabled} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------- date fmt */

export function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export function fmtDateShort(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export function daysUntil(d: string | null | undefined): number | null {
  if (!d) return null;
  const t = new Date(d + 'T00:00:00').getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((t - today) / 86_400_000);
}
