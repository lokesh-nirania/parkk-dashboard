# Parkk — the pitch

**One sentence:** the work between winning a job and starting it is a dozen
parallel obligations against a fixed date, and a spreadsheet cannot tell you
which of them is about to make you late.

## The problem, concretely

A hull job is confirmed for the 14th with twelve people. Between now and then:
twelve visas, twenty-four flights, twelve yard passes, twelve insurance
certificates, and sixty drums of primer that ship by sea. Each one is somebody's
job, some of them belong to the client, and one of them — a yard pass issued for
30 days on a job that runs 40 — is already wrong in a way nobody will notice
until the crew is at the gate.

Then in week three the client adds two people, and every one of those obligations
starts again for them alone.

## What this does about it

**One board.** Every live project as a row; every workstream as a cell taking the
worst status of everything beneath it. A cell is a link, so the answer to "why is
travel red" is one click, not a phone call.

**Gates, not dropdowns.** A project is confirmed because somebody confirmed it, on
a date, with the dates and crew size the client agreed to. Planning opens because
a manager is answerable for it. Commencement is refused while a workstream is
unfinished, and it names them.

**A record that survives change.** Dates move, people join, people leave. The
dashboard shows what is true now; the history shows what was true before, who
changed it and why.

## The three rules a spreadsheet cannot enforce

1. **A clearance that expires before the job ends is not green** — whoever ticked it.
2. **Filed and waiting is not the same as in progress** — they are different phone calls.
3. **A workstream is only as done as the newest person on the crew** — onboarding
   in week three reopens travel, on its own, without anybody remembering to.

## What it is not

Not a warehouse system, not an accounting package, not a daily-progress tool.
It answers one question — *what is not ready, and who do I ring about it* — and
stops.

See [README.md](README.md) for the model, [implementation/](implementation/) for
the detail, and [PLAN.md](PLAN.md) for what comes next.
