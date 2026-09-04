# Screens

Twelve routes. Nine are live on real data, three are honest placeholders. The nav
marks the placeholders with a hollow dot and the pages say plainly that they are
not built — no mock data pretending otherwise.

## Pipeline

### `/quotation` — the pipeline
Work that is quoted but not yet won, each row carrying the scope it was quoted
on. Every date here is labelled an estimate, because nothing on this screen has
been agreed to by anybody. A row confirms in place — dates and crew size,
defaulted to the quote — or is revised, which reopens the window, the crew size
and the scope together, because a client who comes back rarely changes only one.
Cancelled quotes stay, in their own list.

### `/projects` — every project
All of them, at every stage. Stage chip, the clock, the manager, crew filled over
crew on the job, and flag counts. An unconfirmed date is marked `est.`; a
confirmed one that has moved carries how far.

### `/board` — the readiness board
One row per live project, one cell per workstream, each taking the worst status
of everything beneath it. Above it: live projects, starting within 14 days,
blocked tasks, unfilled seats. A coverage-gap banner appears only when there is
one.

Quoted and finished projects are excluded — a board about tomorrow has no use for
work that has not been won or has already ended. Hand-added workstreams have no
column of their own; the row says `+1 more` and the project page has it.

Every cell links to the project, filtered to that workstream.

### `/projects/[id]` — the project workspace
The screen the rest of the app exists to fill. In order:

1. **Stage rail** — where it has been and how long it spent there, from the trail.
2. **Stats** — the clock, crew, open tasks, blocked.
3. **Schedule** — quoted, confirmed, and now, each date carrying its own drift,
   with the full history of every move and the reason given.
4. **Managers** — who is running it, since when, and who used to.
5. **Planning** — the workstream cards. Status, progress, owner, and the control
   to add a task (or seats, for manpower). A card is a filter for the table below.
6. **Crew** — seats, filled and unfilled, with released ones greyed at the
   bottom carrying their reason. Each filled seat carries what it needs for this
   job: the work permit is a one-click tag, because "he does not need a visa" is
   a correction somebody makes while reading the list. Flights, a bed, cover and
   the yard pass are not tags — everybody who goes gets them. One of our own
   in a seat is marked *ours*.
7. **Tasks** — everything beneath every workstream, with a status control on each.
8. **History** — everything that has happened to this project, newest first.

## Planning

### `/crew` — the trades
Everyone off the bench who has held a seat. Records are created by filling a
seat, not by a separate onboarding form. Shows current seats, past ones,
outstanding obligations, and passport expiry. Our own people are on
[`/managers`](#managers--people) instead, even when they are on a job.

### `/crew/[id]` — one crew member
Every seat they have held and everything owed against each, editable in place.
The page a coordinator opens when the consulate finally calls back.

### `/logistics` — kit across every project
What each project needs and whether it turned up, with quantities where they
mean something. Not a warehouse: this tracks demand and receipt, never stock.

### `/expiry` — the expiry radar
Every clearance with a date on it, ordered by when it runs out, with the gap
against the job end computed. Plus passports, because a passport expiring in four
months is a flight nobody takes.

## System

### `/managers` — people
Parkk's own staff, as distinct from crew. Add somebody as a manager or an admin,
deactivate them, and see two separate columns: what they are **running**, and
what they are **going out** on. Most managers only ever fill the first; the ones
who fly hold a seat on that project like anybody else. A manager is a record
today; the same row becomes a login when invites are switched on.

### `/activity` — the trail
Every write in the system, newest first. Date moves render from their structured
half — formatted dates, the size of the move, the reason in the writer's own
words — and everything else renders the sentence its action wrote.

## Not built

`/execution`, `/blockers`, `/invoicing` — each says what will live there, why it
is out of this cut, and which open question it is waiting on.
