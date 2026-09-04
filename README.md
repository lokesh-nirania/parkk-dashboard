# Parkk

A lifecycle system for drydock projects: from the quote that goes out, through
the crew, visas, flights and kit that have to be true before anybody flies, to
the day the job starts.

> **Start here:** [setup.md](setup.md) — first run, about fifteen minutes.
> **Then:** [implementation/](implementation/) — what this build is, and what it is not.

## The spine

```
Quote → Confirmation → Planning → Execution → Invoicing
```

A project moves one gate at a time, and each gate is a fact rather than a
dropdown:

| Gate | What actually happens |
|---|---|
| **Confirm** | The client agrees to dates and a crew size. Both are stamped as a baseline that is never overwritten. |
| **Assign a manager** | Planning opens: six workstreams, and one empty seat per person in the confirmed crew size. Running the job and going to it stay separate — a manager takes a seat only if they are travelling. |
| **Commence** | Refused while any workstream is unfinished, and it says which ones. |

**Planning is the stage with depth.** Six workstreams run at once — manpower,
immigration, travel, yard passes, insurance, logistics — each holding whatever
tasks it needs. They are rows in the database, not an enum, so a job that needs a
seventh gets one from the UI.

## Three things in the model worth defending

**A project's dates are stored three times.** What was quoted, what was agreed,
and where the job sits today. "Has this slipped?" is unanswerable against a
single mutable date field, because the number it used to hold is gone. Keeping
the baseline separate makes slip a subtraction rather than an argument.

**A seat has a beginning, an end, and somebody in it.** Crew changes mid-flight —
somebody joins in week three, somebody comes off in week five. Filling a seat
writes that person's obligations (flights, a bed, a transfer, a pass, cover and a
permit), which sends travel and immigration back to unfinished on their own.
Releasing one ends the seat and stops its work counting, without deleting
anything.

Whoever is in the seat is manpower, including our own: a manager who flies out to
run the job from the dock needs the same permit and the same bed as the blaster
beside them, so they hold a seat rather than being a special case. What that seat
*needs* is a per-seat tag, because a Polish painter in Rotterdam needs no work
permit and the Ukrainian blaster beside him does — while both of them need a
flight, a bed and a way to the yard. Travel is never a question; a permit always
is.

**The trail carries structure, not just prose.** Every write records the field it
moved and the values either side. So the dashboard shows the current state —
travel is pending — and the history underneath still shows that travel was
finished on the 3rd, and reopened on the 15th when Lena joined.

Three smaller ones that matter as much in practice:

- **`awaiting_external` is not `in_progress`.** "We have not filed the visa" and
  "we filed it five weeks ago and the consulate is silent" need different phone calls.
- **`owner_party`** — some clients book their own flights. The task still goes
  red; only who you chase changes.
- **`valid_to`** — a yard pass valid to 20 March on a job running to 4 April is
  not green, whatever anybody ticked. Nobody catches that by eye across forty workers.

## Who signs in

One role today: anyone who can sign in is an admin and can do everything.
Managers are **people records** — assignable to projects, able to own a
workstream, without an account. When invites are switched on, the account
attaches to the same row. See [open question 1](implementation/06-open-questions.md).

## Stack

Next.js 16 (App Router, server components) · Supabase Postgres + Auth ·
Tailwind v4 · Vercel. No API layer — server components read Supabase directly and
row-level security is enforced in the database.

## Running it

`npm` is strictly the frontend toolchain. Anything touching the database goes
through the `supabase` CLI.

```bash
npm install
supabase start          # applies migrations; the seed creates two logins and nothing else
supabase status         # copy API_URL and ANON_KEY into .env.local
npm run dev
```

Full instructions — hosted Supabase, Vercel, the env vars — are in [setup.md](setup.md).

## There is no demo data

The seed creates two sign-ins and nothing else. Every project, every seat, every
visa and every line of history on every screen is created through the UI by
whoever is using it. A dashboard that looks alive because somebody typed the
story into a seed file demonstrates nothing.

For a populated database to demo against, [seed.md](seed.md) drives the app's own
server actions — the same requests the browser sends — so the result is data the
app actually produced rather than data somebody wrote around it.

## Repo

```
implementation/     what this build is — scope, model, screens, decisions, questions
supabase/           migrations, seed
src/app/(app)/      screens behind auth
src/app/login/      the only public route
src/lib/types.ts    the vocabulary — statuses, stages, gates, labels
src/lib/actions.ts  the one write path; every action appends to the trail
src/components/     the shared pieces — status pill, inline forms, schedule panel
seed/               the demo builder — drives the app's own actions, never SQL
docs/               the original design blueprint, kept for reference only
```

`docs/system-design.html` predates the model described here — read
`implementation/` for what the system actually does.

The one-page pitch is [poc.md](poc.md); what comes next is [PLAN.md](PLAN.md);
building a database to demo against is [seed.md](seed.md).
