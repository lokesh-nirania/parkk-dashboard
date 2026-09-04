'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const { error } = await createClient().auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    router.push(params.get('next') || '/board');
    router.refresh();
  }

  const field =
    'w-full rounded-md border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none transition-colors placeholder:text-faint focus:border-line-strong';

  return (
    <form onSubmit={submit} className="w-full max-w-[320px]">
      <div className="mb-7">
        <span
          className="mb-4 grid size-7 place-items-center rounded text-[12px] font-bold text-bg"
          style={{ background: 'var(--text)' }}
        >
          P
        </span>
        <h1 className="text-[17px] font-semibold tracking-[-0.01em] text-ink">
          Parkk Readiness
        </h1>
        <p className="mt-1 text-[13px] text-muted">
          Tomorrow is a start date. What is still not ready?
        </p>
      </div>

      <div className="space-y-2.5">
        <input
          type="email" required autoFocus autoComplete="username"
          value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="you@parkk.example" className={field}
        />
        <input
          type="password" required autoComplete="current-password"
          value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="Password" className={field}
        />
      </div>

      {error && (
        <p className="st-blocked mt-3 rounded-md px-2.5 py-2 text-[12px]"
           style={{ color: 'var(--c)', background: 'var(--c-bg)' }}>
          {error}
        </p>
      )}

      <button
        type="submit" disabled={busy}
        className="mt-4 w-full rounded-md bg-ink px-3 py-2 text-[13px] font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy ? 'Signing in…' : 'Sign in'}
      </button>

      <p className="mt-6 text-[11px] leading-relaxed text-faint">
        Single admin role. Accounts are created in the Supabase dashboard —
        see <span className="font-mono">setup.md</span>.
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="grid min-h-screen place-items-center px-6">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
