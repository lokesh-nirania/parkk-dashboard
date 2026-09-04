'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function SignOut() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      onClick={async () => {
        setBusy(true);
        await createClient().auth.signOut();
        router.push('/login');
        router.refresh();
      }}
      disabled={busy}
      className="w-full rounded-md px-2 py-1.5 text-left text-[13px] text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-50"
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
