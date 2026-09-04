# The lifecycle, stage by stage

```
  Quote        Confirmation      Planning        Execution       Invoicing
    │               │                │               │               │
 ███████████████████████████████████████            stub ✕        stub ✕
              built and working
```

## Quote

A project exists from the moment a quote goes out — it just has nothing beneath
it. Estimated dates, an estimated crew size, a value, and the scope. All four are
revisable while the quote is open, together in one form, and every revision is on
the record.

Exits: **confirmed**, or **cancelled**.

## Confirmation

The gate where an estimate becomes a commitment. It asks for the dates and the
crew size the client agreed to, defaulted to what was quoted, and stamps them as
`confirmed_start_date` / `confirmed_end_date` / `team_size` — a baseline written
once and never overwritten.

Everything after this measures against it. `quote_shift_days` says how far the
quote was out; `schedule_shift_days` is the slip.

## Planning

Opens when a manager is assigned — not because somebody pressed a button called
"open planning", but because a person is now answerable for it. Opening writes:

- the six workstreams — manpower, immigration, travel, yard passes, insurance, logistics
- one empty seat per person in the confirmed crew size

Then it runs in parallel. Seats get names, and each name brings its own
obligations. Tasks get added to any workstream, and workstreams get added to the
project. Crew join and leave, and the workstreams follow them.

Exits: **commence**, refused while any workstream is unfinished, naming the ones
that are.

## Cancelled

Not a stage but an ending, available at any point before the job closes. One
status covers every way a job does not happen, with an optional note — the
system never learns whether a quote was lost on price or simply went quiet, and
a required reason box only produces plausible guesses.

## Execution — not built

The stage exists in the enum and `project_substages.stage` is not fixed to
planning, so the same machinery carries over. What belongs here:

- Daily reports — area blasted, area coated, coats applied, hours worked
- Standing obligations: the recurring things owed each day, which complete
  differently from a visa
- Hold points and inspection sign-offs against the coating spec
- Progress derived from area and coats rather than typed in

**Blocked on** [question 5](06-open-questions.md): what the site reports today,
and to whom.

## Invoicing — not built

A milestone schedule against the confirmed dates, variations flowing through to
lines, and reconciliation back to the quote so scope drift is visible in money.

**Blocked on** [question 6](06-open-questions.md): whether this mirrors an
accounting package or duplicates it.

---

Ordering for the work ahead — including manager logins, which comes before all of
the above — is in [../PLAN.md](../PLAN.md).
