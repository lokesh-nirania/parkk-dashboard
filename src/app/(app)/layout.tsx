import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Nav } from '@/components/nav';
import { SignOut } from '@/components/sign-out';

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[208px] shrink-0 flex-col border-r border-line bg-surface px-3 py-4 lg:flex">
        <Link href="/board" className="mb-6 flex items-center gap-2 px-2">
          <span
            className="grid size-6 place-items-center rounded text-[11px] font-bold text-bg"
            style={{ background: 'var(--text)' }}
          >
            P
          </span>
          <span className="text-[13px] font-semibold tracking-[-0.01em] text-ink">
            Parkk Readiness
          </span>
        </Link>

        <Nav />

        <div className="mt-auto border-t border-line pt-3">
          <div className="truncate px-2 pb-2 text-[11px] text-faint" title={user.email ?? ''}>
            {user.email}
          </div>
          <SignOut />
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1400px] px-5 py-6 sm:px-8 sm:py-8">{children}</div>
      </main>
    </div>
  );
}
