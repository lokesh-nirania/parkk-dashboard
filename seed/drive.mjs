/* ============================================================================
 * The harness: how a script talks to this app the way a browser does.
 *
 * Nothing here writes to the database. Every call is a POST to a page URL with
 * a Next-Action header — the exact request the browser sends when somebody
 * clicks the button — so the demo data goes through the same validation, the
 * same gates and the same activity trail as anything typed in by hand.
 *
 * Local only, and deliberately: it signs in with the development login that
 * supabase/seed.sql creates.
 * ========================================================================== */

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createServerClient } from '@supabase/ssr';
import { encodeReply } from 'next/dist/compiled/react-server-dom-webpack/client.node.js';

const APP = process.env.APP_URL ?? 'http://localhost:3000';
const EMAIL = process.env.SEED_EMAIL ?? 'abhishek.parkk@example.com';
const PASSWORD = process.env.SEED_PASSWORD ?? 'abhi123';
const DB_CONTAINER = process.env.DB_CONTAINER ?? 'supabase_db_parkk-dashboard';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);

/* A real session, in the cookie format @supabase/ssr expects. */
const jar = [];
{
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => [], setAll: (cs) => jar.push(...cs) } },
  );
  const { error } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (error) {
    console.error(`Could not sign in as ${EMAIL}: ${error.message}`);
    console.error('Is the local stack up? `supabase start`, then `npm run build && npm run start`.');
    process.exit(1);
  }
}
const COOKIE = jar.map((c) => `${c.name}=${c.value}`).join('; ');

/*
 * Server actions are addressed by an id that the build generates, so the map
 * has to come from the build that is actually running. Rebuild the app and the
 * ids change — which is why this reads the manifest rather than hard-coding them.
 */
const manifest = JSON.parse(readFileSync('.next/server/server-reference-manifest.json', 'utf8'));
const IDS = Object.fromEntries(
  Object.entries(manifest.node)
    .filter(([, v]) => (v.filename ?? '').endsWith('actions.ts'))
    .map(([id, v]) => [v.exportedName, id]),
);

/**
 * Call one server action. `page` is the route the click would have come from;
 * it only has to be a page the action is reachable from.
 */
export async function call(name, args, page = '/board') {
  const id = IDS[name];
  if (!id) throw new Error(`No action called ${name} in this build.`);

  const body = await encodeReply(args);
  const headers = { 'Next-Action': id, Cookie: COOKIE, Origin: APP };
  if (typeof body === 'string') headers['Content-Type'] = 'text/plain;charset=UTF-8';

  const res = await fetch(APP + page, { method: 'POST', headers, body });
  const text = await res.text();
  if (res.status === 404) throw new Error(`${name}: server action not found — the running server is not this build.`);

  // An absent field comes back as the string "$undefined", which is not an error.
  const raw = text.match(/"error":"([^"]+)"/)?.[1];
  const error = raw && raw !== '$undefined' ? raw : undefined;
  const fieldErrors = text.match(/"fieldErrors":(\{[^}]+\})/)?.[1];
  if (error || fieldErrors) console.error(`  ✗ ${name}: ${error ?? fieldErrors}`);

  return { ok: /"ok":true/.test(text), error, fieldErrors };
}

/** FormData, skipping anything undefined so optional fields stay optional. */
export function fd(o) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null) f.set(k, String(v));
  return f;
}

/* Reading ids back out. The browser gets these from the rendered page; a script
   has to ask the database. Reads only — every write above goes through an action. */
export const sql = (q) => execFileSync(
  'docker', ['exec', DB_CONTAINER, 'psql', '-U', 'postgres', '-tAF|', '-c', q],
  { encoding: 'utf8' },
).trim();
export const rows = (q) => sql(q).split('\n').filter(Boolean).map((r) => r.split('|'));
export const one = (q) => rows(q)[0]?.[0];

/** A date this many days from today, as yyyy-mm-dd. */
export const iso = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
