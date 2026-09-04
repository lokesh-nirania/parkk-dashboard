# Decisions

What was chosen, and what would reverse it.

---

### A project's dates are stored three times
`est_*` (quoted), `confirmed_*` (agreed, written once at the gate) and
`start_date` / `end_date` (live).

**Why** — "has this job slipped" is unanswerable against a single mutable date
field: the number it used to hold is gone. Keeping the baseline separate from the
live dates makes slip a subtraction; keeping the estimate separate from the
baseline says how good the quoting is. Everything downstream still reads the live
pair, so nothing else in the system has to know about any of this.

**Cost** — three pairs to keep straight, and a confirm gate that is a form rather
than a button.

**Reverses if** — nobody ever moves a date after confirmation, which would make
the baseline and the live pair permanently identical.

---

### Moving a confirmed date requires a reason
`rescheduleProject` refuses without one, after confirmation only.

**Why** — the reason is the part somebody needs in May, when fourteen flights
were rebooked in March and nobody can say who asked. Before confirmation nothing
is committed, so asking there would only teach people to type "x".

**Reverses if** — the reasons come back as "x". Then the field is wrong and the
answer is a short list of causes to pick from, not free text.

---

### Planning opens by assigning a manager
There is no "open planning" button.

**Why** — a stage that begins because somebody pressed a button records nothing.
A stage that begins because a person became answerable for it records who, and
when, and the gate is the same fact the business already recognises.

**Cost** — a project cannot be planned by a nameless team, which is deliberate.

**Reverses if** — planning genuinely starts before anyone is named. Then the
manager becomes an ordinary field and the gate becomes a button.

---

### A seat is a row with an end date
Seats are added, filled and released. Nothing is deleted, and `team_size` does
not move with them.

**Why** — crew changes mid-flight, and both the change and what preceded it
matter. A headcount field can only ever be right about today.

**Cost** — "confirmed at 12, 14 on the job" is a gap somebody has to read rather
than a single number.

**Reverses if** — that gap turns out to be commercial, in which case it becomes a
variation record rather than a difference between two columns.

---

### A seat holds a worker or one of ours
`assignments.worker_id` or `assignments.person_id`, at most one, resolved by
`seats_effective`.

**Why** — a manager who flies out to run the job from the dock needs the same
permit, the same bed and the same yard pass as the blaster in the next seat. If
they are not manpower, every one of those obligations has to be remembered by
hand for exactly the person nobody thinks to check.

**Cost** — two nullable columns instead of one, and a view to read them through.

**Reverses if** — never for managers, but a third kind of occupant (a client's
own inspector, a subcontractor) would turn the pair into an occupant table.

---

### Assigning a manager does not seat them
Running a job and going to it are separate facts, and the manager screen shows
them in separate columns.

**Why** — most managers never leave the office, so a seat created automatically
would be a seat somebody has to remember to release, and manpower would read
1/12 on a job with nobody on it.

**Reverses if** — the manager always goes, at which point the seat is part of
what the confirm gate opens.

---

### Filling a seat writes that person's obligations
`open_person_tasks()` materialises the kit from `substage_templates.person_tasks`.

**Why** — it is the mechanism that makes onboarding in week three reopen travel
and immigration without anybody remembering to. Left to hand entry, the newest
person is exactly the one whose visa nobody chases.

**Cost** — the kit is the same for everybody who is not excused one of its
parts. Per-country and per-client kits are [question 3](06-open-questions.md).

---

### Travel is not optional; a permit is
`substage_templates.person_optional` says which kits a seat may be excused;
`assignments.waived_substages` says which ones this seat was.

**Why** — anybody who goes to the yard needs a flight, a bed, a way to the dock,
cover and a pass through the gate, so asking would be a checkbox nobody ever
unticks. Only a work permit genuinely varies, and it varies by *job and person together*: a Polish painter needs none
in Rotterdam and one in Dubai. A flag on the worker would be wrong on the next
job; a flag on the project would be wrong for half the crew. It belongs on the
seat, which is the only row that knows both.

**Cost** — one more thing to get right when a seat is filled, mitigated by there
being exactly one of them and by defaulting to *required* — the failure that costs a flight is the permit nobody
asked about, not the one asked about unnecessarily.

---

### Waiving sets tasks to `n_a` rather than deleting them
`set_person_kit()` closes them; turning the kit back on reopens exactly those.

**Why** — "we got him a visa and then found out he did not need one" is worth
being able to read, and a deleted row cannot say it. `n_a` already means
*not applicable to this scope* and already scores zero on worst-wins, so the
status vocabulary answered this before the feature existed.

**Cost** — the ratio counts `n_a` as settled, which means 6/6 can include work
nobody did. The alternative — excluding them from the total — makes a fully
waived workstream look untouched instead of closed.

---

### Substages are rows, not an enum
`substage_templates` seeds them; `project_substages` holds one project's copy,
including hand-added ones.

**Why** — the six are what a job usually needs, not what it can only have. A
seventh workstream should be a row somebody types, not a migration and a deploy.

**Cost** — the board's six columns are the template keys, so a hand-added
workstream shows on the project page and in the flags rather than as its own column.

---

### Rollups are views, never columns
Nothing derived is stored.

**Why** — a stored rollup is a rollup that goes stale. The board and the project
page read the same view, so they cannot disagree.

**Reverses if** — the board gets slow. It will not at this size; the numbers here
are dozens of projects and thousands of tasks. If it ever does, a materialized
view refreshed on write is the fix, not hand-maintained columns.

---

### The trail carries structure, not just prose
`entity`, `field`, `old_value`, `new_value`, `reason` alongside the sentence.

**Why** — an audit trail you can only read is a diary. The structured half is
what lets `project_schedule_events` and `project_stage_periods` be views rather
than parsers, and what any future "average slip by client" is built on.

**Cost** — one row per changed field, so a batch write is several inserts. At
this size that is free.

---

### Workstream crossings are logged by the actions
Nothing writes a derived status, so `substage_reopened` and `substage_completed`
are logged by the actions that disturb them.

**Why** — the single most useful sentence this system produces is "travel was
finished on the 3rd and reopened on the 15th", and it cannot be recovered from a
table of current values.

**Cost** — every task and crew write reads the workstream statuses twice. Two
small selects against a view, on writes that are already round trips.

---

### Managers are records before they are logins
`people.user_id` is null until there is an account.

**Why** — the useful half of a manager — being assignable, owning a workstream,
being on the record — needs no authentication at all. Building the invite flow
first would have delayed everything it enables.

**Reverses if** — never, but it grows: the sign-up trigger already attaches a new
account to an existing person row by email, so the invite flow is policy work,
not a migration.

---

### Single role, RLS on anyway
One policy per table: authenticated can do anything.

**Why** — nobody but the admins signs in yet. Turning RLS on now means the
security model is a policy edit later rather than a retrofit, and the app never
learns to work without it.

**Reverses if** — never. Scoping managers to their own projects is eleven policy
edits and a lookup through `project_managers`.

---

### `security_invoker = on` on every view
Views default to running with their owner's rights, which would read straight
past the RLS policies on the base tables.

**Why** — without it, RLS would be on and doing nothing, which is worse than off
because it looks safe.

---

### Passport numbers are in the database
`workers.passport_no` and `passport_expiry`.

**Why** — clients ask for passport lists to issue yard passes, and the expiry
radar is useless without the date. Leaving them out means the spreadsheet
survives, and the spreadsheet is the thing being replaced.

**This is the riskiest decision here.** It makes this a system with real PII
obligations: hosting location, access logging, retention, and who can export.
Currently mitigated only by RLS and a single trusted role, which is enough for a
demo and not enough for production. See [question 7](06-open-questions.md).

---

### No seed data
`supabase/seed.sql` creates two sign-ins and nothing else.

**Why** — every row on every screen has to be creatable through the UI, and the
fastest way to guarantee that is to have no other way of getting one. A board
that looks alive because somebody typed the story into a seed file demonstrates
nothing.

**Cost** — a demo starts from an empty screen, so the empty states have to be as
considered as the full ones.

---

### Next.js App Router + Supabase, no API layer
Server components read Supabase directly; every write is a server action.

**Why** — one deployable, one auth model, RLS enforced at the database rather
than in application code. For a dashboard this size an API layer would be a tier
that only forwards.

**Reverses if** — a mobile client or a third-party integration appears. Then
PostgREST is already the API; it does not need building.

---

### Colour is never the only signal
Every status carries a dot shape, a label and a tint.

**Why** — this screen's job is to be scanned quickly, often on a projector or a
shared screen. Red-versus-green alone fails for roughly one in twelve men, and
this is a workforce dashboard.
