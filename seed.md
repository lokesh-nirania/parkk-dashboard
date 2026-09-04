# Demo data

There is no seed file for business data and no fixture SQL. The demo is built by
driving the app's own server actions — the same POST the browser sends when
somebody clicks the button — so every row in it went through the same
validation, the same gates and the same activity trail as anything typed in by
hand.

That is the point. A dashboard that looks alive because somebody wrote INSERT
statements proves nothing about the app; this proves the whole path works,
because it is the path.

```bash
supabase db reset                 # empty database, schema and the two logins
npm run build && npm run start    # action ids come from the build that is running
node seed/demo.mjs                # ~180 actions, about a minute
docker exec -i supabase_db_parkk-dashboard psql -U postgres -f - < seed/backdate.sql
```

| File | What it is |
|---|---|
| [seed/drive.mjs](seed/drive.mjs) | The harness — signs in, finds the action ids, posts them |
| [seed/demo.mjs](seed/demo.mjs) | The scenario, in the order a person would do it |
| [seed/backdate.sql](seed/backdate.sql) | Ageing the result, so the history is not all one afternoon |

---

## What it builds

Five projects, one at each interesting point of the lifecycle, plus nine crew
and three staff.

### PK-26001 · MV Silver Dawn — Rotterdam · *planning*
The one to demo. Everything that can be true at once, is:

- Quoted for six on the 8th; the client came back **four days later** — so the
  confirmed baseline sits four days off the quote, visible on the schedule panel.
- Two managers on it, because a big job has two.
- Five seats filled, one still empty. **Piotr's visa was refused** and the agency
  is appealing, so immigration is red with a note on the task.
- **Rui's yard pass was issued as a 30-day pass**, nine days short of the job end.
  It is ticked *done* and the workstream is still red — the rule nobody can
  enforce by eye.
- Travel was **finished**, and then **Lena joined in week three** and it went back
  to unfinished on its own. Both crossings are in the history with the reason.
- **Anders came off** for a family emergency: the seat keeps its record, his
  finished work stops counting.
- The yard then **slipped the window six days**, with the reason recorded.

### PK-26002 · Coral Sentinel — Singapore · *confirmed*
Confirmed for ten and waiting on a manager, so the gate out of `confirmed` is
sitting there unused. The vessel was named after the quote went out and the
scope was tightened afterwards — both through the edit form, both in the trail.

### PK-26003 · Northern Lyra — Gdańsk · *quoted*
A live quote, revised once. The client added two tanks and a cargo hold, which
moved the dates, the crew size (4 → 6) **and** the scope in a single revision —
which is how it actually happens, and why those three fields are one form.

### PK-26004 · Sea Harrier — Piraeus · *cancelled*
It did not go ahead. One terminal status, one optional note.

### PK-26005 · Andaman Pride — Dubai · *planning, T−12*
Starting in twelve days with everything through except the kit: three crew fully
cleared, and logistics carrying a blocked drum of thinners stuck at customs and
spray units the client has not sent. The board's urgent row.

---

## How the harness works

**Actions are addressed by an id the build generates.** `drive.mjs` reads them
from `.next/server/server-reference-manifest.json`, so the ids always match the
server that is running. Rebuild the app and they change — which is why the
script reads the manifest instead of hard-coding anything.

**The session is real.** It signs in as the development login from
`supabase/seed.sql` and sends the resulting cookie, so the actions see a genuine
`auth.users` row and write a genuine actor into the trail.

**Reads use psql; writes never do.** The browser gets row ids from the page it is
looking at. A script has to ask the database — so `one()` and `rows()` run
`select` through the container. Every write is an action.

---

## Editing the database directly

Two rules.

**Never write business data by hand.** If a row can be created through a screen,
create it through the screen. Anything else and the demo stops being evidence
that the app works — and the trail, which is the point of the system, ends up
with rows nobody performed.

**Timestamps are the exception**, and only for presentation. Everything in
`demo.mjs` happens in one sitting, so without help the stage rail reads *"Quote
today, Confirmed today, Planning today"* and the feed says *2m ago* forty times.
`seed/backdate.sql` spreads each project's trail across the weeks it would really
have taken, then **derives every stamp a screen shows from the trail itself** —
`confirmed_at`, `planning_started_at`, when a manager was assigned, when a seat
was released — so nothing can end up disagreeing with the history it came from.

Adjust the spans at the top of that file to move the story around:

```sql
insert into span values
  ('PK-26001', 24, 1),   -- quoted 24 days ago, last touched yesterday
  ('PK-26005', 41, 2);
```

It is written to be safe to run twice, but it is easier to reason about after a
fresh `demo.mjs` run.

---

## Adding to it

Append to `demo.mjs` and keep the sections in lifecycle order. Two things to hold
to:

- **Only actions.** If the app cannot do it yet, that is a missing feature, not a
  reason to reach for SQL. Build the action and the control, then use it here —
  which is how task editing and the crew records came about.
- **Say why a project is shaped the way it is.** Every project above earns its
  place by demonstrating something specific. A sixth that shows nothing new is
  noise on the board.

Then update the table in this file, so the document and the script stay the same
story.

---

## When it does not work

**`server action not found`** — the running server is not the build the manifest
came from. `npm run build && npm run start`, then run the script again.

**Everything returns without an error and nothing is created** — the session
expired (an hour) or the request was redirected to `/login`. Re-run; `drive.mjs`
signs in fresh every time.

**`Could not sign in`, or the app 500s on auth** — Kong sometimes holds a stale
connection to the auth container after `supabase db reset`:

```bash
docker restart supabase_kong_parkk-dashboard
```

**Duplicate projects** — `demo.mjs` expects an empty database and addresses
projects by the codes the sequence generates (`PK-26001`…). Run it after
`supabase db reset`, not on top of an existing set.
