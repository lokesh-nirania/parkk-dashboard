# Open questions

Ask these. The answers reshape the model, not just the UI, so each one says what
it changes.

---

**1 · Who signs in, and what should they see?**
Today one role: an admin who can do everything. Managers exist as records without
accounts. The invite flow is straightforward; what it needs is an answer to what
a manager may see — only their own projects, everything read-only, or everything.
→ *Changes:* eleven RLS policies, and whether the board becomes personal or stays
a portfolio view. First item in [PLAN.md](../PLAN.md).

---

**2 · How much lead time is there between confirmation and start?**
Two months and this is a tracking tool. Two weeks and it is a compression tool —
alerting matters more than data entry, and entry has to get very fast.
→ *Changes:* whether alerting jumps ahead of everything else.

---

**3 · Does one obligation kit fit every job?**
Filling a seat writes seven things: four travel, a permit, a pass, a cover note.
A seat can be excused the permit one click at a time, which covers
"this half of the crew is local". What it does not cover is a kit whose *contents*
differ — a country that wants a medical and a police certificate, a client that
wants a drug test.
→ *Changes:* `substage_templates.person_tasks` becomes a set keyed by
destination or client, and the admin screen for it arrives earlier.

---

**4 · Who books travel — us, the client, or the agency?**
`owner_party` exists on every task because the answer varies. If the client books
most of it, the product's centre of gravity is chasing somebody else rather than
tracking ourselves, and that is a different emphasis in the UI.
→ *Changes:* escalation and reminders become the point, not status entry.

---

**5 · What does site actually report today, and to whom?**
Execution is unbuilt on purpose. If the honest answer is a WhatsApp photo at 6pm,
the first version of it is an inbox, not a form.
→ *Changes:* the shape of the entire execution stage.

---

**6 · Is invoicing already in an accounting package?**
If it is, this screen is a read-only mirror and an export, not a second system
that has to be kept in step.
→ *Changes:* whether invoicing is a week or a quarter.

---

**7 · Passport data — does it live here?**
It currently does, because clients ask for passport lists and the expiry radar
needs the dates. If that is a firm yes, this becomes a system with real PII
obligations: hosting region, access logging, retention, export controls.
→ *Changes:* becomes step 0, ahead of every feature.

---

**8 · Do managers who go out get counted as crew commercially?**
They hold a seat, so they show in `seats_total` and in manpower. If a client is
billed for twelve and the twelfth is our own supervisor, the board is right about
the yard and wrong about the invoice.
→ *Changes:* a billable flag on the seat, and manpower counts two numbers.

---

**9 · When people are added mid-job, is that a variation?**
The system handles the mechanics: seats are added, obligations are written,
workstreams reopen. What it does not do is price it. If adding two people in week
three is commercially a variation, that record belongs next to the crew change
rather than in an email.
→ *Changes:* blockers and variations move up, and `team_size` gets a history of
its own rather than staying the confirmed number.

---

**10 · Who keeps this updated, daily?**
The honest answer decides whether any of this succeeds. If it is one person,
bulk edit and CSV import are not a nicety.
→ *Changes:* entry speed becomes the priority over every new screen.

---

**11 · Hull jobs — where does the paint spec live?**
If quantities come from a spec — area × coats — that is structured data, not an
attachment on an email, and logistics quantities become derived rather than typed.
→ *Changes:* a technical scope object, and a new kind of task.

---

## After asking

Record the answers here with the date, and update [PLAN.md](../PLAN.md) before
writing more code.

| # | Answer | Date | Follow-on |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |
| 6 | | | |
| 7 | | | |
| 8 | | | |
| 9 | | | |
| 10 | | | |
| 11 | | | |
