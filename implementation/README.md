# Implementation

What this build is, what is actually in it, and what is deliberately not.

| | |
|---|---|
| **Covers** | Quote → Confirmation → Planning, end to end. Execution and invoicing are honest placeholders. |
| **Stack** | Next.js 16 (App Router) · Supabase Postgres + Auth · Tailwind v4 · Vercel |
| **Roles** | One. Anyone who can sign in is an admin. Managers are records without accounts. |
| **Data** | None shipped. Every row on every screen is created through the UI. |

## The documents

| File | What it answers |
|---|---|
| [00-scope.md](00-scope.md) | What is in and what is out, with reasons |
| [01-data-model.md](01-data-model.md) | Tables, views, and the three ideas the schema is built around |
| [02-status-engine.md](02-status-engine.md) | How a cell gets its colour, and how a finished workstream reopens |
| [03-screens.md](03-screens.md) | Every route, its state, and what it is for |
| [04-roadmap.md](04-roadmap.md) | The lifecycle stage by stage — built, and not yet |
| [05-decisions.md](05-decisions.md) | Decisions taken, and what would reverse them |
| [06-open-questions.md](06-open-questions.md) | What to ask, and what each answer changes |

Ordering for the work ahead is in [../PLAN.md](../PLAN.md).

## The one sentence

The work between winning a job and starting it is a dozen parallel obligations
against a fixed date. This tracks them, refuses to let the job start while one is
open, and keeps the record when they change.

## Where things live

```
src/app/(app)/           screens behind auth
src/app/login/           the only public route
src/lib/types.ts         the vocabulary — statuses, stages, gates, labels
src/lib/actions.ts       the one write path; every action appends to the trail
src/components/          status pill, inline forms, schedule panel, stage rail
supabase/migrations/     schema, views, RLS, and the substage templates
supabase/seed.sql        two sign-ins, and nothing else
```
