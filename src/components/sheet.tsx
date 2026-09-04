'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/* ============================================================================
 * A panel that opens on top of the page.
 *
 * The thing it replaces was a filter: clicking a workstream re-rendered the
 * whole project page and changed one table six hundred pixels further down, so
 * the page looked identical and nobody could tell what had happened. A panel
 * says what a filter cannot — this opened, that is still there underneath, and
 * closing it puts you back exactly where you were.
 *
 * It is deliberately not a route. Everything it shows is already on the page,
 * so opening one costs no request and no re-render of anything behind it.
 * ========================================================================== */

export function Sheet({
  open, onClose, title, eyebrow, actions, children, width = 940,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  eyebrow?: ReactNode;
  /** Controls that belong to the whole panel — add a task, fill a seat. */
  actions?: ReactNode;
  children: ReactNode;
  width?: number;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  // Held in a ref so the effect below depends on `open` alone. A caller passing
  // an inline arrow — which is every caller — would otherwise re-run it on each
  // render, and the cleanup would throw focus back to the trigger while the
  // panel is still open. Actions revalidate the page constantly, so that is not
  // an edge case, it is every click.
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });

  // Escape closes, the page behind stops scrolling, and focus goes into the
  // panel and comes back to whatever opened it. Without the last part, closing
  // leaves a keyboard user at the top of the document.
  useEffect(() => {
    if (!open) return;

    returnTo.current = document.activeElement as HTMLElement | null;
    panel.current?.focus();

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); close.current(); return; }
      if (e.key !== 'Tab' || !panel.current) return;

      // Keep Tab inside the panel: a dialog you can tab out of behind is worse
      // than no dialog, because the focus ring disappears somewhere unreadable.
      const focusable = panel.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    };

    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = overflow;
      returnTo.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:p-6">
      {/* The page is still there, and still legible through the scrim — the
          panel is on top of the work, not instead of it. */}
      <button
        type="button" aria-label="Close" tabIndex={-1} onClick={onClose}
        className="fixed inset-0 cursor-default bg-black/45 backdrop-blur-[1px]"
      />

      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        style={{ maxWidth: width }}
        className="relative z-10 my-auto w-full rounded-xl border border-line bg-surface shadow-2xl outline-none"
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="min-w-0">
            {eyebrow && (
              <div className="mb-0.5 text-[11px] uppercase tracking-[0.06em] text-faint">{eyebrow}</div>
            )}
            <div className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-ink">{title}</div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {actions}
            <button
              type="button" onClick={onClose} aria-label="Close"
              className="rounded border border-line px-2 py-1 text-[12px] leading-none text-muted transition hover:border-line-strong hover:text-ink"
            >
              Esc
            </button>
          </div>
        </header>

        <div className="max-h-[calc(100dvh-9rem)] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
