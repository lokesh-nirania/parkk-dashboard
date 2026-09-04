import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/session';

// Runs on every matched request: refreshes the Supabase session cookie and
// bounces anonymous traffic to /login before any page renders.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
