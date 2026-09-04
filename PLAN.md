# What comes next

The build covers the front half of the lifecycle end to end: a quote becomes a
confirmed job, a manager opens planning, six workstreams and a crew list carry it
to the start date, and every change is on the record. Execution and invoicing are
honest placeholders.

This is the order the rest should be built in, and why.

---

## 1 · Logins for managers

**Now:** a manager is a person record. They can be assigned to projects and own
workstreams; they cannot sign in. One role exists — admin — and it can do
everything.

**Next:** an invite by email attaches an auth account to the existing person row
(`people.user_id`), which the schema and the sign-up trigger already expect. Then
the eleven row-level security policies stop being `using (true)` and start
reading the manager's own projects through `project_managers`.

**Why first:** every other feature below assumes somebody other than an admin is
looking at it. Building them against a single omniscient role bakes in
assumptions that are expensive to unpick.

---

## 2 · Substage templates, editable

**Now:** the six planning workstreams and the per-person obligation kit they
write are reference data in the migration. Adding a seventh workstream to one
project is a row; changing what every project starts with is a code change.

A seat can already be excused a work permit one click at a time, which covers
"half this crew is local". What it cannot do is change what the kit *contains*,
or make some other part of it waivable.

**Next:** an admin screen over `substage_templates`, including the
`person_tasks` kit and which parts of it are waivable. Probably per project type
or per destination — a supervision job does not need sixty drums of primer, and
a country that wants a medical and a police certificate needs two more rows in
the kit rather than two more tasks typed by hand forty times.

**Blocked on:** [question 3](implementation/06-open-questions.md) — whether the
checklist genuinely differs per country or per client.

---

## 3 · Alerting

**Now:** the board is true whenever somebody opens it.

**Next:** a T−minus digest to the project's managers — what is red, what is
expiring, what is overdue, and who is being chased. Daily at a fixed hour, and on
the crossings the trail already records (a workstream reopening, a date moving).

**Blocked on:** step 1. A digest needs somebody to send it to.

---

## 4 · Execution

**Now:** a stub, and the `execution` stage exists in the enum so the shape is visible.

**Next:** the substage machinery already generalises — `project_substages.stage`
is not fixed to `planning`. Execution is a different rhythm rather than a
different model: daily reports, standing obligations that recur rather than
complete, hold points and sign-offs against the coating spec, and progress
derived from area and coats rather than typed in.

**Blocked on:** [question 5](implementation/06-open-questions.md) — what the site
actually reports today, and to whom. If the honest answer is a WhatsApp photo at
6pm, the first version of this is an inbox, not a form.

---

## 5 · Blockers and variations

A blocker is currently a status. A blocker with an age, an owner and a cost
impact is a bigger object, and a variation — extra scope agreed mid-job — is the
thing that adds people in week three. The crew and reopening machinery is already
built for that; what is missing is the money and the paper trail around it.

---

## 6 · Invoicing

A milestone schedule against the confirmed dates, variations flowing through to
lines, and reconciliation back to the quote so scope drift is visible in money.

**Blocked on:** [question 6](implementation/06-open-questions.md) — whether this
is a mirror of an accounting package or a second system that has to be kept in step.

---

## Running repairs, whenever they are hit

- **Bulk edit and CSV import.** Twelve visas moved to *awaiting external* on one
  phone call is twelve clicks today. This matters the day somebody maintains a
  real project rather than a demo one.
- **Crew size on a running job.** Seats can be added and released from the
  project page; the confirmed `team_size` deliberately does not move with them.
  If the gap between "confirmed at 12" and "14 on the job" starts mattering
  commercially, it becomes a variation record rather than a number.
- **Attachments.** A visa is a PDF somebody has in an inbox. Supabase Storage
  against a task is small; deciding retention on passport scans is not.
