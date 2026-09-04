# Setup

First time through, top to bottom. About fifteen minutes, most of it waiting for
Supabase to provision.

There are two ways to run this. **Local** needs Docker and nothing else — no
account, no network, no deploy. **Hosted** is what you push to Vercel.

- [Run it locally](#run-it-locally) — start here to just look at it
- [Hosted Supabase + Vercel](#hosted-supabase) — for a shared URL

**You need:** Node 20+ and the Supabase CLI
(`brew install supabase/tap/supabase`). Docker Desktop for the local route, with
WSL integration enabled on Windows. A Supabase and Vercel account for the hosted one.

---

# Run it locally

```bash
npm install
supabase start      # first run pulls ~2GB of images; later runs take ~40s
```

`supabase start` applies `supabase/migrations/` and runs `supabase/seed.sql`,
which creates two sign-ins and nothing else. There is no demo data anywhere in
this repo — the first project is one you create.

Point the app at the local stack:

```bash
supabase status -o env        # API_URL and ANON_KEY
```

```bash
cat > .env.local <<'EOF'
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY from supabase status>
EOF
```

Then:

```bash
npm run dev
```

- App — <http://localhost:3000>
- Supabase Studio, to poke at the data — <http://127.0.0.1:54323>

**The two local sign-ins**, created by the seed:

| Email | Password |
|---|---|
| `abhishek.parkk@example.com` | `abhi123` |
| `varsha.parkk@example.com` | `varsha123` |

Signing in for the first time creates the matching row in `people` with the admin
role — a trigger on `auth.users` does it, which is how the seed stays free of
business data even for the users themselves.

**Useful while working:**

```bash
supabase db reset   # rebuild from migrations and reseed — wipes everything you created
supabase stop       # shut the stack down
supabase stop --no-backup   # ...and discard the local database
```

---

# Hosted Supabase

Everything below is for the shared or Vercel deployment.

## 1 · Install

```bash
npm install
```

## 2 · Create the Supabase project

1. <https://supabase.com/dashboard> → **New project**
2. Name it `parkk-dashboard`, pick a region near the people who will use it
   (`eu-central` or `ap-south`), and **save the database password somewhere** —
   the CLI asks for it in step 4 and there is no recovering it later.
3. Wait for it to finish provisioning.

## 3 · Environment variables

Project Settings → **Data API** for the URL, **API Keys** for the anon key.

```bash
cp .env.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

Both are meant to be public — the anon key only ever returns what row-level
security allows, and every table here requires an authenticated session. Do
**not** put the `service_role` key in this file; nothing in the app uses it.

## 4 · Schema

```bash
supabase login
supabase link                 # pick the project, paste the DB password from step 2
supabase db push --linked     # creates the schema
```

Do **not** pass `--include-seed` against a hosted project: the seed creates
local development logins with known passwords. Make the hosted account by hand in
step 5 instead.

<details>
<summary>No CLI? Do it by hand instead</summary>

Supabase dashboard → **SQL Editor** → paste and run
`supabase/migrations/20260101000000_init.sql`.

</details>

## 5 · Create the first login

There is no signup screen — anyone who can sign in is an admin, so accounts are
made deliberately.

Dashboard → **Authentication** → **Users** → **Add user** → *Create new user*:

- Email: your own
- Password: whatever you like
- **Tick "Auto Confirm User"** — without it the account cannot sign in until it
  confirms an email that will not arrive.

The trigger creates the matching `people` row on first insert. Everybody else
gets added from the **People** screen inside the app.

## 6 · Run it

```bash
npm run dev
```

<http://localhost:3000> → sign in → create the first quote.

---

## Deploying to Vercel

1. Push this repo to GitHub.
2. Vercel → **Add New** → **Project** → import it. The framework preset is
   detected; no build settings to change.
3. Add both environment variables from step 3 under **Settings → Environment
   Variables**, for *Production*, *Preview* and *Development*.
4. Deploy.
5. Supabase → **Authentication → URL Configuration**: set **Site URL** to your
   Vercel domain and add `https://your-app.vercel.app/**` to **Redirect URLs**.
   Email/password sign-in works without this, but anything you add later that
   sends a link will bounce.

Redeploy after adding env vars — Vercel bakes `NEXT_PUBLIC_*` in at build time,
so the first deploy will not pick them up.

---

## Commands

**npm is strictly the frontend toolchain.** Anything touching the database goes
through the `supabase` CLI, so the two never get mistaken for each other.

### Frontend — npm

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production build — run before pushing, it typechecks |
| `npm run typecheck` | Types only, faster |
| `npm run lint` | ESLint |

### Database — supabase CLI

| Command | What it does |
|---|---|
| `supabase start` | Bring the local stack up (applies migrations, runs the seed) |
| `supabase stop` | Shut the local stack down |
| `supabase status` | URLs and keys for the local stack |
| `supabase db reset` | Rebuild locally from migrations — **wipes everything you created** |
| `supabase db push --linked` | Apply migrations to the linked cloud project |
| `supabase migration new <name>` | Create a timestamped migration file |
| `supabase migration list --linked` | What is applied locally vs on the cloud project |

### Changing the schema

```bash
supabase migration new whatever_changed    # creates a timestamped file
# edit supabase/migrations/<timestamp>_whatever_changed.sql

supabase db reset                          # test it locally first — replays from empty
supabase db push --linked                  # then apply to the cloud project
```

Never edit a migration that has already been pushed — add a new one. `db reset`
replays every migration from empty, which is the cheapest way to catch a
migration that only works against your current database.

---

## If something breaks

**Sign-in says "Invalid login credentials"** — the user exists but was not
confirmed. Delete it and recreate with *Auto Confirm User* ticked.

**Signed in, but the People screen is empty** — the `auth.users` trigger did not
run, so there is no `people` row. Check `handle_new_user()` exists in the SQL
editor; re-running the migration recreates it.

**Empty tables and no error at all** — this is what RLS looks like from the
outside. Confirm you are signed in, and that the policy block at the bottom of
the migration actually ran.

**A screen shows "Could not load this"** — that is a real query error rather than
an empty state, and the message under it is the database's own. The two are
deliberately never allowed to look the same.
