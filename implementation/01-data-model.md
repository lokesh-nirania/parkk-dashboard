# Data model

Twelve tables. Four are reference data, one is staff, one is the seat, one is the
work, and one is the record.

```
people ──────┬──> project_managers ──┐
             │                       │
clients ──┐  └──> (owns) ────────┐   │
vessels ──┼──> projects ─────────┴───┴──> project_substages ──> tasks
shipyards ┘        │                              ▲               ▲
                   └──> assignments ──────────────┘───────────────┘
                            │                   (substage_templates)
                        workers                     activity_log
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

### 2 · A seat has a beginning and an end

`assignments` is the seat. `worker_id` null means declared but unfilled — an
unfilled seat is a tracked, red thing rather than a missing row. `released_at`
means somebody came off the job.

Nothing is ever deleted, which is what makes "we were twelve, then fourteen, then
eleven" a record instead of a memory. A released seat's tasks stop counting
toward what is outstanding (`tasks_effective.is_live`) and stay readable in the
history.

`substage_templates.person_tasks` is the obligation kit — the visa, the two
flights, the pass, the cover note — written by `open_person_tasks()` when a
worker goes into a seat. That function is why onboarding somebody in week three
reopens travel and immigration without anybody remembering to.

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
| `workers` | Crew. Distinct from people: a worker holds a seat, a person runs one. |
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

Five views. No rollup is written by hand, so no two screens can disagree.

| View | Gives |
|---|---|
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
