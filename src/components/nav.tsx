'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Item = { href: string; label: string; stub?: boolean };

const SECTIONS: { title: string; note?: string; items: Item[] }[] = [
  {
    title: 'Pipeline',
    items: [
      { href: '/quotation', label: 'Quotation' },
      { href: '/projects',  label: 'Projects' },
      { href: '/board',     label: 'Board' },
    ],
  },
  {
    title: 'Planning',
    items: [
      { href: '/crew',      label: 'Crew' },
      { href: '/logistics', label: 'Logistics' },
      { href: '/expiry',    label: 'Expiry radar' },
    ],
  },
  {
    title: 'Execution',
    note: 'Next cut',
    items: [
      { href: '/execution', label: 'Project start', stub: true },
      { href: '/blockers',  label: 'Bottlenecks',   stub: true },
      { href: '/invoicing', label: 'Invoicing',     stub: true },
    ],
  },
  {
    title: 'System',
    items: [
      { href: '/managers', label: 'People' },
      { href: '/activity', label: 'Activity log' },
    ],
  },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-6">
      {SECTIONS.map((section) => (
        <div key={section.title}>
          <div className="mb-1.5 flex items-baseline justify-between px-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.09em] text-faint">
              {section.title}
            </span>
            {section.note && (
              <span className="text-[10px] font-medium text-faint">{section.note}</span>
            )}
          </div>
          <ul className="space-y-px">
            {section.items.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center justify-between rounded-md px-2 py-[7px] text-[13px] transition-colors ${
                      active
                        ? 'bg-surface-2 font-medium text-ink'
                        : item.stub
                          ? 'text-faint hover:bg-surface-2 hover:text-muted'
                          : 'text-muted hover:bg-surface-2 hover:text-ink'
                    }`}
                  >
                    {item.label}
                    {item.stub && (
                      <span
                        className="size-[5px] rounded-full border"
                        style={{ borderColor: 'var(--border-strong)' }}
                        title="Not built yet — placeholder"
                      />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
