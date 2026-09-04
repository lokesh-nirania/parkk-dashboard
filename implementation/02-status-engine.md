# Status engine

How a cell gets its colour, and how a finished workstream goes back to
unfinished. The whole engine is small on purpose.

## One vocabulary

Six statuses, used identically by a visa, a flight, a yard pass, sixty drums of
primer and the workstream above them.

| Status | Means | Reads as |
|---|---|---|
| `n_a` | Not applicable to this scope | hollow, faint |
| `not_started` | Nobody has begun | hollow, grey |
| `in_progress` | We are working it | amber |
| `awaiting_external` | Filed — waiting on someone outside | blue |
| `blocked` | Stopped. Needs a decision or an escalation | red |
| `done` | Complete | green |

**`awaiting_external` is not `in_progress`.** "We have not filed the visa" and
"we filed it five weeks ago and the consulate is silent" are both amber to a
spreadsheet and completely different phone calls in real life. If one distinction
from this design survives, it should be this one.

## Worst-wins

A workstream takes the worst status of everything beneath it:

```
blocked (5) > not_started (4) > awaiting_external (3) > in_progress (2) > done (1) > n_a (0)
```

`not_started` outranks `awaiting_external` deliberately: something filed and
waiting is further along than something nobody has touched, even though the filed
one is out of your hands.

Defined once, in SQL, as `status_severity()`. The board, the project page and
every rollup read the same function.

## What each workstream counts

| Unit | Used by | Progress is |
|---|---|---|
| `seats` | Manpower | Filled seats over live seats. A confirmed twelve with nobody named reads 0/12 and goes red without anybody inventing a row. |
| `tasks` | Everything else | Tasks done over tasks that count. |

A workstream with nothing beneath it keeps the status somebody set by hand —
which is how a workstream that genuinely does not apply gets closed as `n/a`, so
the commence gate does not deadlock on it forever. The moment something is
beneath it (`is_derived`), the control disappears and the action refuses to
write: nobody ticks travel green while a flight is unbooked.

## The expiry override

Before worst-wins runs, one rule fires:

> If any live task in the workstream has `valid_to` earlier than the project's
> `end_date`, the workstream is `blocked` — whatever its tasks say.

A yard pass marked done, valid to 20 March, on a job running to 4 April turns the
cell red. Move the job's dates and the gap can appear on its own, without anybody
touching the pass — which is exactly the failure this catches.

## Released seats stop counting

A task belonging to somebody who has come off the job is neither outstanding work
nor an achievement to count. `tasks_effective.is_live` is false for those, and
every rollup filters on it.

So the dashboard reflects the crew that is actually on the job, while the task
itself stays readable on the project page and in the person's own record.

## Reopening, and why it is an event

A workstream's status is derived, so nothing writes it, and nothing would
otherwise record it moving. But *"travel was finished on the 3rd and reopened on
the 15th when Lena joined"* is the most useful sentence this system can produce.

So every action that disturbs a workstream — adding a task, moving a task,
filling a seat, adding seats, releasing somebody — takes a reading of every
workstream before and after, and logs the crossings:

| Event | When |
|---|---|
| `substage_completed` | It was unfinished, and now it is `done` or `n_a` |
| `substage_reopened` | It was settled, and now it is not — with what caused it |

Nothing else is logged, because a workstream drifting from `not_started` to
`in_progress` is already visible in the tasks beneath it.

## The clock

`days_to_start = start_date − current_date`, computed in the view, so it is right
whenever the page loads.

- `T−6` — six days out
- `T+12` — started twelve days ago
- Under seven days is the only number on the board allowed to turn red on its own

## Reading a cell

| Shows | When |
|---|---|
| `done` | Everything complete |
| `8/12` | Partial, counted by thing |
| `awaiting` | Nothing done, everything filed and waiting |
| `not started` | Nothing done, nothing filed |
| `n/a` | Closed as not applicable |
| `—` | Nothing beneath it yet |
| `▲ exp` | A coverage gap, on top of whatever else the cell says |

## Colour is never the only signal

Every status carries a dot shape, a text label and a tint. `not_started` and
`n_a` are hollow rings, not filled dots. It reads correctly in greyscale, on a
bad projector, and to a colour-blind viewer — which matters, because this screen's
entire job is to be scanned quickly in a room.
