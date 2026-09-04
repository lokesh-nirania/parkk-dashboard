# Data model

Twelve tables. Four are reference data, one is staff, one is the seat, one is the
work, and one is the record.

```
people ──────┬──> project_managers ──┐
             │                       │
clients ──┐  ├──> (owns) ────────┐   │
vessels ──┼──> projects ─────────┴───┴──> project_substages ──> tasks
shipyards ┘        │                              ▲               ▲
                   └──> assignments ──────────────┘───────────────┘
                          │     │               (substage_templates)
                     workers   people               activity_log
                             (a seat holds either)
```

## Three ideas the schema is built around

### 1 · A project's dates are stored three times

| Columns | Means | Written |
|---|---|---|
| `est_start_date`, `est_end_date` | What the quote proposed | At creation; revisable while quoted |
| `confirmed_start_date`, `confirmed_end_date` | What the client agreed | Once, at the confirm gate. Never overwritten. |
| `start_date`, `end_date` | Where the job actually sits | Mirrors the estimate, then the confirmation, then every later move |

Everything downstream — the T−minus clock, the expiry rule, `days_to_start` —
reads the live pair, because "when is this job" is always the live answer. The
other two exist so `quote_shift_days` and `schedule_shift_days` can be
subtractions rather than arguments.

Collapsing them into one field is how a business ends up disagreeing about
whether a job slipped: everybody remembers a different one of the three.

### 2 · A seat has a beginning, an end, and somebody in it

`assignments` is the seat. Empty means declared but unfilled — a tracked, red
thing rather than a missing row. `released_at` means somebody came off the job.

Nothing is ever deleted, which is what makes "we were twelve, then fourteen, then
eleven" a record instead of a memory. A released seat's tasks stop counting
toward what is outstanding (`tasks_effective.is_live`) and stay readable in the
history.

**Who is in it is a worker or one of ours.** `worker_id` points at the bench;
`person_id` points at a manager who is going out as well as running it, and a
check constraint allows at most one. A manager at the dock needs the same permit,
the same bed and the same yard pass as the blaster beside them, so they hold a
seat rather than being a second kind of thing every screen has to remember.
`seats_effective` resolves the two columns into one `occupant_name` and one
`occupant_kind`, once, and everything downstream reads that.

Running a job and going to it stay separate facts: assigning a manager opens
planning and does not put them in a seat, because most of them do not go.

**What that seat needs is a fact about the job, not the person.**
`substage_templates.person_tasks` is the obligation kit, written by
`open_person_tasks()` the moment somebody goes into a seat — which is why
onboarding in week three reopens travel without anybody remembering to.

| Kit | Per person | Waivable |
|---|---|---|
| Travel | Inbound flight, outbound flight, accommodation, airport transfer | No |
| Insurance | Cover in place | No |
| Shipyard entry | Yard pass & induction | No |
| Immigration | Work permit / visa | **Yes** |

Only the permit is a question. Anybody who goes needs a bed, a way to the dock,
cover and a pass through the gate — asking would be a checkbox nobody ever
unticks. A permit is the opposite — a Polish painter in Rotterdam
needs none and the Ukrainian blaster beside him does, and that is true of *this
job*, not of either man. So the waiver lives on the seat, in
`assignments.waived_substages`, and `substage_templates.person_optional` says
which kits may appear there at all.

Waiving never deletes. `set_person_kit()` moves the tasks to `n_a` — a status
the rollups already ignore — and anything already finished stays finished,
because "we got him a visa and then found out he did not need one" is worth
being able to read. Turning it back on reopens exactly what was set aside.

### 3 · Substages are rows, not an enum

`substage_templates` holds the six a planning stage opens with.
`project_substages` is one project's live copy, and a row there without a
`template_key` is a workstream somebody added because this job needed it. Adding
a seventh workstream is a row; changing what every project starts with is a
migration.

`project_substages.stage` is not fixed to `planning`, so execution substages are
the same machinery when that stage gets built.

## The tables

| Table | Holds |
|---|---|
| `people` | Parkk staff. `role` is admin or manager; `user_id` is null until there is an account to attach. |
| `clients`, `vessels`, `shipyards` | Reference data, created inline from the project form. |
| `workers` | The bench. Distinct from people: a worker only ever holds a seat, a person can also run the job. |
| `projects` | The three date pairs, the confirmed crew size, the gate stamps. |
| `project_managers` | Who runs it. Plural, with `removed_at` rather than deletion. |
| `assignments` | Seats, with `filled_at` and `released_at`. |
| `substage_templates` | The six workstreams and their per-person obligation kits. |
| `project_substages` | One project's workstreams, including hand-added ones. |
| `tasks` | Everything trackable: a visa, a flight, sixty drums of primer. `assignment_id` set means it belongs to a person. |
| `activity_log` | The trail. Append-only, and structured — see below. |

## One table for everything trackable

`tasks` holds visas, flights, yard passes, insurance and drums of paint.

**Why** — a workstream is a `group by substage_id` over one table. Six typed
tables would need six rollups that could disagree, and every new kind of work
would be a migration rather than a row.

**Reverses if** — one kind of work needs fields the others cannot share. Per
country immigration stages is the likely one; the answer there is probably a
`stage` column on the task plus templates, not a separate table.

## Two columns worth defending

**`owner_party`** — some clients book their own flights. The task still exists,
still goes red, still sits in the same rollup. Only who you chase changes. A
design that drops the tasks you do not own is a design that loses the ones that
hurt most.

**`valid_to`** — a yard pass valid to 20 March on a job running to 4 April is not
green, whatever anybody ticked. The rollup treats a coverage gap as `blocked`
regardless of the task's own status. This is the single rule in the system nobody
could enforce by eye across forty workers, and it is why the model is worth
building.

## The trail has two halves

`activity_log` keeps a sentence and a structure for the same event:

| Half | Columns | Read by |
|---|---|---|
| The sentence | `action`, `detail` | The activity feed and the project history |
| The structure | `entity`, `item_id`, `field`, `old_value`, `new_value`, `reason` | Anything that has to count |

The sentence reads well and answers nothing — you cannot ask it how many days a
project has slipped, or when travel was last finished. Every action writes both,
one row per field that actually moved. `reason` is required when a confirmed date
shifts and when somebody comes off the job: those are the two places the system
insists on prose.

## Derived, never stored

Six views. No rollup is written by hand, so no two screens can disagree.

| View | Gives |
|---|---|
| `seats_effective` | A seat plus who is in it — `occupant_name`, `occupant_kind`, `is_filled`, `is_live` — whether that is a worker or one of ours |
| `tasks_effective` | Tasks plus `has_expiry_gap`, `is_overdue`, `is_live`, `severity`, and who they are for |
| `project_substage_effective` | A workstream's counts and its derived status — seats for manpower, tasks for the rest |
| `project_board` | One row per project: the clock, the drift, the managers, the crew, the flags |
| `project_schedule_events` | Every move of every date, with `shift_days` worked out |
| `project_stage_periods` | What stage a project was in, and for how long — built from the trail |

## PII

`workers.passport_no` and `passport_expiry` exist because clients ask for
passport lists to issue yard passes, and the expiry radar needs the date to be
useful. This is real personal data in a hosted database, which is a decision, not
an accident — see [05-decisions.md](05-decisions.md) and
[question 7](06-open-questions.md).

## Security

Row-level security is on for all eleven writable tables, with one policy each:
any authenticated user can do anything. Views are declared
`security_invoker = on` so they inherit those policies rather than running with
the definer's rights and reading straight past them.

**Privileges and RLS are two separate gates, and both must be open.** Because the
views are `security_invoker`, the *caller's* rights are what get checked against
the base tables, so granting on the views alone is not enough. The migration
grants explicitly on the tables, the views and the sequences. `anon` is granted
nothing at all, which is why an unauthenticated request gets a flat permission
denial rather than an empty list.

When managers get logins, those eleven policies are the only thing that changes:
`using (true)` becomes a lookup through `project_managers`.
