# Wave 3 — Revenue & Relationships (CRM, Pipeline, Tasks, Projects, Calendar, Meetings)

**Implementer:** Claude (Implementation Engineer)
**Plan:** `docs/IMPLEMENTATION_PLAN_WAVE_3.md`
**Architecture:** `ARCHITECTURE_AUDIT.md` §5.4, §7 Wave 3
**Predecessor:** `docs/waves/WAVE_2.md` (G2 APPROVE WITH CHANGES, G3 PASS, M1 href fix pack applied)
**Status:** complete — awaiting G2 review (GPT-5.5) and G3 gate (Grok)

---

## What changed

Wave 2 made the surface actionable. Wave 3 makes **money motion and
relationships** the thing being acted on. Six modules moved from `planned` to
`enabled`, three record detail routes appeared, and the Morning Brief stopped
computing its own answers from raw rows — its opportunity and today sections now
read from the same selectors the modules render.

The through-line is the **join**. A task points at a project, a person, and an
opportunity; a meeting points at attendees, a company, and a deal; an opportunity
points at a company and a champion. Nothing is scored, predicted, or inferred:
"relationship temperature" is days since the last recorded touch, "expected
value" is value × the probability written on the record, and "stalled" is days in
the current stage. Every number on these pages can be traced to a stored field.

## Enabled vs hidden

| Module | Route | Group | Wave | State |
|--------|-------|-------|------|-------|
| Morning Brief | `/` | Commander | 1 | enabled |
| Approval Queue | `/approvals` | Commander | 2 | enabled |
| Health Monitor | `/health` | Commander | 2 | enabled |
| Inbox | `/inbox` | Operator | 2 | enabled |
| CRM | `/crm` | Operator | 3 | **enabled (new)** |
| Pipeline | `/pipeline` | Operator | 3 | **enabled (new)** |
| Tasks | `/tasks` | Operator | 3 | **enabled (new)** |
| Projects | `/projects` | Operator | 3 | **enabled (new)** |
| Calendar | `/calendar` | Operator | 3 | **enabled (new)** |
| Meetings | `/meetings` | Operator | 3 | **enabled (new)** |
| Integrations | `/integrations` | Operator | 1 | enabled |
| Settings | `/settings` | Operator | 1 | enabled |

Record detail routes, declared in `recordRoutes` and served only while their
owning module is enabled:

| Route | Serves |
|-------|--------|
| `/crm/person/:id` | Person detail with relationship intelligence |
| `/crm/company/:id` | Company detail with the account rollup |
| `/pipeline/opportunity/:id` | Opportunity detail with lead intelligence |

Ten modules remain `planned` (content, knowledge, research, ai, decisions,
missions, automations, metrics, analytics, sync). They still have **no route**
and **never appear in navigation**. `src/app/modules.test.ts` derives the
expected router children from the registry — modules *and* record routes — and a
separate test asserts every module with `wave > 3` is still `planned`.

**Mission Control moved from wave 3 to wave 6.** The audit's §7 Wave 3 list is
CRM, Pipeline, Tasks/Projects, and Calendar/Meetings; missions is not on it. It
was carrying `wave: 3` from Wave 1's registry, which would have made "every
wave > 3 module is planned" pass while silently implying missions was in scope.
Objectives and predictions need the leverage fabric, so it now sits with Wave 6
and stays hidden.

## Domain and data

| Change | Why |
|--------|-----|
| `Project` entity | Tasks belong to something. Status covers `planning`, `active`, `blocked`, `paused`, `complete`, with `blockedReason` so a stall states its cause. |
| `Meeting` entity | `startsAt`/`endsAt`, `kind`, `personIds`, optional `companyId`/`opportunityId`, `location`, `notes`. |
| `Task.projectId` / `.personId` / `.opportunityId` | The joins that make a task list a work list rather than a to-do list. |
| `Task.completedAt` | "Done" without a completion time cannot be sorted, undone, or counted into project progress honestly. |
| `Company.status` | `prospect` / `active` / `dormant` / `churned`. Dexie v3 backfills v2 rows as `active`. |
| `Person.notes` | Relationship detail had nowhere to record what is actually known about a person. |
| `Opportunity.personId` / `.leadSource` / `.stageChangedAt` | Champion, where the lead came from, and when the stage last moved — the three facts lead intelligence needs. `leadSource` is deliberately not `source`, which is provenance. |
| `ActivityEvent.channel` gains `execution` and `relationship` | A task completion is not a pipeline event and not a system event. |
| Dexie version 3 | New `projects` and `meetings` stores; new indexes on `tasks.projectId`, `opportunities.stage`, `meetings.startsAt`, `companies.status`. |
| `SEED_VERSION = 'wave3.0'` | 5 companies, 5 people, 5 projects, 11 tasks, 6 meetings, 7 opportunities (5 open, 1 won, 1 lost). |

Meetings seed against the **current week** rather than fixed dates, so the
calendar has something in it whenever the demo is opened, plus one past meeting
nine days back that carries real notes and one that does not.

`src/data/mutations.ts` remains the only write path. Wave 3 adds:

- `setTaskStatus(id, status)` — stamps `completedAt` on done, clears it on
  reopen, clears `blockedSince` when work restarts, records an `execution` event
- `setTaskPriority(id, priority)`
- `createTask({ title, ... })` — operator-owned (`source: 'local'`), so no
  reseed touches it
- `setOpportunityStage(id, stage)` — stamps `stageChangedAt`; moving to `won`
  sets probability to 100 and `lost` to 0, because a closed deal has no
  remaining uncertainty. Open-stage moves leave the operator's probability alone
- `saveMeetingNotes(id, notes)` — records a `relationship` event, and only when
  the text actually changed

Every one sets `touchedAt`, so the 12-hour reseed (TD-17) cannot undo a completed
task or a closed deal. The **demo opt-out still wins**: `clearDemoData` removes
demo rows whether or not they were touched, and `src/data/mutations.test.ts`
proves it after mutating a task, an opportunity, and a meeting.

## CRM (`/crm`)

Two views behind one route (`?view=people|companies`), because a person and their
account are the same question asked at different resolution.

**People** rank by relationship temperature — `hot` under 7 days since the last
recorded touch, `warm` under 14, `cooling` under 21, `dormant` beyond, `unknown`
when nothing was ever recorded. That is arithmetic on `lastTouchAt`, not a score.
**Companies** rank by open pipeline value, with contact count and status.

**Relationship intelligence lives on the detail page**, not on a page of its own:
`/crm/person/:id` states in one line what the store knows — days since the last
touch, open opportunities and their combined value, open tasks, next meeting —
then shows the joined opportunities, tasks, meetings, and notes. `/crm/company/:id`
does the same at account level, rolling up its people. A detail page for an id
the store does not hold says so plainly and offers the way back, rather than
rendering an empty shell.

## Pipeline (`/pipeline`)

The existing eight-stage enum (`identified → contacted → engaged → qualified →
proposal → negotiation`, plus `won`/`lost`) already carried the LeadScheduler
progression, so it was kept rather than renamed; the brief asked for its spirit,
not its labels.

A stage distribution strip across the six open stages (count and value each,
click to filter) sits above a dense list ranked by expected value. Mobile keeps
the list rather than columns. Each row carries the next-stage move plus explicit
`Won` and `Lost`; every move persists.

`/pipeline/opportunity/:id` is lead intelligence: where the lead came from, days
in stage against the 14-day stall threshold, the champion and their temperature,
next step and whether it is overdue, expected value, and the tasks and meetings
attached to the deal. Each signal is a stored fact with its source named.

## Tasks (`/tasks`) and Projects (`/projects`)

Tasks ship as a separate route from projects, as the brief preferred. The list is
overdue-first, then priority, then due date, filtered on status
(`open` by default) and priority, both URL-backed. Each row shows the project,
person, and opportunity it touches as links. One transition per row — `todo →
in progress → done → todo`, `blocked → in progress` — because `blocked` needs a
reason and a button cannot supply one.

The inline **New task** form is the CRUD-lite the brief asked for. Tasks created
here are `local`, carry no demo badge, and survive both a reseed and a demo
opt-out; the page says so.

Projects are a list, not a board: status, objective, due date, blocked reason
when blocked, and progress counted from linked tasks (`3/7 done`) rather than a
stored percentage. Blocked projects sort first.

## Calendar (`/calendar`) and Meetings (`/meetings`)

They are separate routes because they answer different questions, and the brief
allowed either. `/calendar` answers *when* — a Monday-to-Sunday agenda merging
meetings and task due dates into one time-ordered list per day, with
`?week=previous|current|next`, today marked, and empty days shown as empty rather
than collapsed. `/meetings` answers *what happened* — the records themselves,
filtered by `?when=upcoming|past|all`, each with an inline notes editor that
writes to IndexedDB.

Neither duplicates the other: the calendar links into meetings and tasks, and the
meetings page links to the week view. Past meetings with no notes are flagged, and
the header counts how many are awaiting them. Nothing is transcribed; notes are
what the operator typed.

## Brief wiring

- **Opportunities** now come from `selectOpportunities(dataset, 'open')`, so the
  brief and `/pipeline` rank identically and closed deals disappear from both at
  once. Each links to its detail page.
- **Today** comes from `dayAgenda`, merging meetings starting today with tasks
  due today and work already in progress. Blocked tasks are excluded — they have
  their own section, and listing a task as today's work when it cannot move is
  the kind of small lie this project exists to remove.
- **Attention** gained stalled opportunities and overdue tasks alongside the
  existing unread signals and pending gates.
- **Blocked** gained blocked projects next to blocked missions and tasks.
- The header counts open pipeline, expected value, meetings today, and tasks due,
  all from the shared selectors.

Because the sections are selector-driven, completing a task or closing a deal is
visible in the brief on the next render — asserted in
`src/data/mutations.test.ts`, not just by hand.

## Palette and search

- Navigation commands follow the registry, so all six modules appeared
  automatically.
- New actions: *Review the open pipeline*, *Review open tasks*, *Review blocked
  work*, *Review dormant relationships*, *Open this week*, *Meetings awaiting
  notes*.
- The search index gained `project` and `meeting` kinds, and people, companies,
  and opportunities now route to their detail pages instead of the module list.
- Two tests hold the line: every palette target resolves to a route the router
  serves, and every palette target passes `isSafeInternalHref` — the same check a
  record link must pass.

## Href safety with dynamic ids

Wave 2's allowlist compared a href against a set of exact enabled paths, which a
detail route cannot satisfy. Rather than loosen the check, the registry now
**declares** which patterns exist (`recordRoutes`), and `isSafeInternalHref`
accepts a path only if it is an enabled module path or an enabled record pattern
whose id matches `/^[a-z0-9][a-z0-9-]*$/`. Detail routes take no query string;
module routes take only their own declared filter values.

Record links are built by `personHref`, `companyHref`, and `opportunityHref`,
which validate their own output and degrade to the module list if an id would
produce something unsafe. Every link rendered from a record on these pages goes
through one of them or through `normalizeInternalHref`. `src/app/href.test.ts`
covers path traversal, uppercase and encoded ids, empty ids, query strings on
detail routes, and detail paths under planned modules.

## Code splitting (TD-16)

Every route except the Morning Brief is now `React.lazy`, declared in
`src/app/lazyModules.ts` and suspended at the `AppShell` outlet. The brief stays
eager because it is the landing route and a fallback flash there is a worse trade
than the bytes.

| | Wave 2 | Wave 3 |
|---|---:|---:|
| First-load chunk | 534.55 kB / 163.48 kB gzip | 540.44 kB / 167.67 kB gzip |
| Deferred route chunks | 0 | 13 chunks, 76.77 kB / 23.91 kB gzip |

Six modules and three detail pages were added and the first load grew by 5.9 kB.
The split works, but **TD-16 is only partly paid**: the shared chunk is dominated
by React, React Router, Dexie, and Zod, none of which route splitting can move,
so the 500 kB advisory stands. Real reduction needs vendor chunking and deferring
schema validation, which belongs to the Wave 7 performance pass.

## Verification

| Command | Result |
|---------|--------|
| `pnpm lint` | 0 errors, 0 warnings |
| `pnpm typecheck` | clean |
| `pnpm test` | **265 tests, 25 files, passing** (Wave 2 + fix pack: 114 / 15) |
| `pnpm build` | success — 540.44 kB first load + 13 lazy chunks, one chunk-size advisory (TD-16) |

New coverage: six selector suites (CRM temperature and joins, pipeline stage
ordering and stall detection, task filtering and links, project progress,
week agenda merging, meeting windows), Wave 3 mutation persistence across a
reload *and* a reseed, event provenance and channel for each new mutation, brief
reflection after each mutation, registry and record-route parity, href safety for
dynamic ids, palette href parity, and component tests that click through
`/tasks`, `/pipeline`, `/meetings`, and both CRM detail pages against a real
IndexedDB.

## Deferrals (intentional)

1. **No opportunity or person creation.** Wave 3 creates tasks and mutates
   everything else. Full CRUD needs a form layer and validation surface that
   would not have earned its keep against the mutations the brief actually asked
   to persist.
2. **No drag-and-drop pipeline board.** Stage moves are explicit buttons. Dense
   and keyboard-reachable beats a board that fails on mobile.
3. **No calendar write path.** Meetings can be annotated, not scheduled. A
   scheduler with no external calendar to write to would be theatre.
4. **No relationship scoring model.** Temperature is days since a recorded touch.
   Anything richer would be a prediction, and this surface does not predict.
5. **No live CRM connectors.** Apollo, ZoomInfo, and HubSpot stay
   `awaiting_credentials` in the registry. Health still reports `offline`.
6. **Remote persistence, auth, CSP, PWA claims** — unchanged, all Wave 7.
7. Wave 4+ modules — content, knowledge, research, AI workspace, decisions,
   missions, automations, metrics, analytics, sync — remain registered and hidden.

## Debt movement

| ID | Movement |
|----|----------|
| TD-16 | **Partly paid.** Route-level splitting shipped: 13 lazy chunks, 76.77 kB kept out of the first load. The shared vendor chunk is unchanged, so the advisory stands and the remainder moves to Wave 7. |
| TD-08 | **Partly paid.** CRM and pipeline doctrine now lives in `src/domain/entities.ts` as the single typed definition on this surface, rather than being re-derived from LeadScheduler. Cross-repo contract is still Wave 4–7. |
| TD-17 | **Held.** `touchedAt` now covers task status, task priority, opportunity stage, and meeting notes, so no Wave 3 mutation can be reseeded away. |
| TD-19 | **Held.** The mutation path took five new writers without changing shape. |
| TD-20 | **Larger.** Task, stage, and note events append to the same unbounded log. Retention is still Wave 7. |
| TD-03 | **Held.** No fabricated numbers: expected value, progress, temperature, and stall are arithmetic over stored fields. |

## New debt

| ID | Debt | Severity | Note |
|----|------|----------|------|
| TD-23 | Record ids are validated by shape, not by existence | Low | `isSafeInternalHref` accepts any well-formed id, so a link to a deleted record routes to a "not in the local store" page rather than being refused at link time. Correct behaviour for a local store that can be cleared, but it means a stale link is a 200 with an apology. |
| TD-24 | Selector modules are imported eagerly by `href.ts` | Low | The allowlist reads each module's filter constants, so selector code lands in the shared chunk even though the pages are lazy. Splitting the constants out of the selectors would recover a few kB; not worth a second module boundary until the Wave 7 performance pass. |
| TD-25 | No blocked-reason capture in the UI | Low | `setTaskStatus` can write `blocked`, but the rows only offer transitions that need no reason, so a task can only become blocked through the seed. A reason prompt arrives with the form layer. |

## Deviations from the brief

1. **Mission Control was re-waved from 3 to 6** (see *Enabled vs hidden*). It was
   the only registry row claiming Wave 3 without being in the audit's Wave 3 list.
2. **`/meetings` shipped as its own route** rather than embedded under the
   calendar, per the brief's stated preference. The two are cross-linked and
   share no rendering, because "when is it" and "what happened" are different
   questions.
3. **`Company.status` and `Person.notes` were added** beyond the brief's field
   list. Both are rendered on detail pages; neither is decoration.
4. **Closing a deal overwrites its probability** (100 for won, 0 for lost). The
   brief did not ask for it, but leaving a 65% probability on a won deal would
   corrupt every expected-value total that reads the record.
5. **The brief's attention section got its own density limit.** Adding stalled
   deals and overdue tasks pushed true items past the shared six-item cap; the
   attention section now allows more before truncating, and still prints
   `shown/total` when it does.
6. **Wave 2's pages were lazy-loaded too.** The brief asked for splitting on new
   modules; splitting only half the routes would have left the win on the table
   for no gain in safety.
