# Wave 2 — Attention OS (Inbox, Approvals, Health)

**Implementer:** Claude (Implementation Engineer)
**Plan:** `docs/IMPLEMENTATION_PLAN_WAVE_2.md`
**Architecture:** `ARCHITECTURE_AUDIT.md` §5.4, §5.7, §7 Wave 2
**Predecessor:** `docs/waves/WAVE_1.md` (G2 APPROVE WITH CHANGES, G3 PASS, fix pack applied)
**Status:** complete — awaiting G2 review (GPT-5.5) and G3 gate (Grok)

---

## What changed

Wave 1 could answer questions. Wave 2 can be **acted on**. The surface now
writes to the local store: an approval can be granted or refused, a signal can be
marked read, and both survive a reload *and* a demo reseed. Three modules moved
from `planned` to `enabled`, and the Morning Brief's attention section now links
into the surfaces that resolve it.

Nothing here fabricates health. The Health Monitor is a projection of the
Integration Registry and says, in plain words, that no probe has ever run.

## Enabled vs hidden

| Module | Route | Group | Wave | State |
|--------|-------|-------|------|-------|
| Morning Brief | `/` | Commander | 1 | enabled |
| Approval Queue | `/approvals` | Commander | 2 | **enabled (new)** |
| Health Monitor | `/health` | Commander | 2 | **enabled (new)** |
| Inbox | `/inbox` | Operator | 2 | **enabled (new)** |
| Integrations | `/integrations` | Operator | 1 | enabled |
| Settings | `/settings` | Operator | 1 | enabled |

Fourteen modules remain `planned` (missions, crm, pipeline, tasks, calendar,
content, knowledge, research, ai, decisions, automations, metrics, analytics,
sync). They still have **no route** and **never appear in navigation**;
`src/app/modules.test.ts` derives the expected router children from the registry,
so nav and router cannot drift, and a separate test asserts every module with
`wave > 2` is still `planned`.

Sidebar entries for Inbox and Approvals carry a live count — unread signals and
pending gates — read from the store, so a badge never outlives the work it counts.

## Domain and data

| Change | Why |
|--------|-----|
| `Approval.status: 'pending' \| 'approved' \| 'rejected'` | A gate is open, cleared, or refused. There is no "in review" limbo. |
| `Approval.decidedAt` / `decidedBy` | A decision without a timestamp and an actor is not an audit trail. |
| `Notification.readAt` | Distinguishes "read just now" from "read yesterday" in the inbox. |
| `recordBase.touchedAt` | Marks a row the operator authored or mutated. |
| Dexie version 2 | `approvals` gains a `status` index; the upgrade backfills version-1 rows as `pending`. |
| `SEED_VERSION = 'wave2.0'` | Seven signals (five unread) and five gates (three open, one approved, one rejected). |

**`touchedAt` is the mechanism that makes a decision durable.** `seedDemoData`
already refused to delete operator-owned rows; it now also refuses to replace a
seeded row the operator has acted on. Without it, the 12-hour demo refresh
(TD-17) would silently reopen an approved gate — which is exactly the class of
lie this project exists to remove. The demo **opt-out still wins**:
`clearDemoData` removes demo rows whether or not they were touched, because
removing demo data is an explicit instruction, and `src/data/mutations.test.ts`
proves it.

`src/data/mutations.ts` is the only write path:

- `setNotificationRead(id, read)` — write-through read state with a stamp
- `markAllNotificationsRead()` — returns how many rows actually changed
- `decideApproval(id, status)` — moves a gate and records an activity event in the
  same transaction

The decision event inherits the **provenance of the gate it describes**: a
decision about a demo approval is a demo event, so it is badged in the log and
removed with the rest of the demo data. Nothing invents `local` history out of
seeded rows.

## Inbox (`/inbox`)

Lists every signal the local store holds. Filters on two axes — read state (All /
Unread / Read) and severity (Any / Critical / Warning / Info) — both reflected in
the URL, so `/inbox?status=unread` is a linkable, palette-reachable surface.

Ordering is **attention order, not clock order**: unread first, then by severity,
then newest. A critical unread signal from yesterday outranks an info signal from
an hour ago. Row actions are `Mark read` / `Mark unread`, plus `Mark all read` in
the filter bar; every one of them writes to IndexedDB immediately.

## Approval Queue (`/approvals`)

Opens on the pending gates, ranked by risk and then by due date, with overdue
gates called out in the alert tone. `Approve` and `Reject` write the decision;
decided gates move to their own filter with the decision time and actor, and can
be reopened. Filters are URL-backed (`?status=approved`).

A decision has three visible consequences, all from the same write:

1. The gate leaves the queue's pending view and the sidebar count drops.
2. It leaves the Morning Brief's "What needs attention?" section.
3. It appears in the Health Monitor's recorded-events log and in the Brief's
   "What changed overnight?".

## Health Monitor (`/health`)

Derived **only** from `src/integrations/state.ts` and the registry rows in the
store. `src/modules/health/health.ts` owns no probe, no ping, and no timer.

| Panel | Source |
|-------|--------|
| Substrate status + statement | `deriveSubstrateHealth` over substrate-flagged rows |
| Connected / Disabled / Awaiting counts | `countByState` |
| Probe line | The presence of `lastProbedAt` on any row — absent, so it reads "No health probe has ever run from this surface." |
| Substrate dependencies | Registry rows flagged `substrate`, with their real state pill |
| Registry by category | `countByState` grouped by category |
| What cannot run | Capabilities of `awaiting_credentials` connectors, named with their owner |
| Recorded events | The local activity log, newest first — including approval decisions |

There is no uptime figure, no latency chart, and no green light. With zero
verified connectors the page reports `offline` and says why. Tests assert the
report can never claim `operational` while a substrate member is unverified, can
never report a probe the registry does not record, and that the rendered page
contains no "healthy" or "verified" claim. This is the minimal System Logs view
the brief allowed: it reuses recorded events and adds no telemetry.

## Brief wiring

- Unread signals link to their own `href` or to `/inbox`.
- Pending gates link to `/approvals`; **decided gates no longer appear at all**.
- The substrate statement links to `/health`; the credential gap still links to
  `/integrations`, which is where it is actually fixed.
- The header gained `Unread` and `Pending gates` counters, both linked.
- Section headers now print `shown/total` when the density limit truncates a
  section, so the brief states truncation instead of hiding it.

## Palette and search

- Navigation commands follow the registry, so Inbox, Approval Queue, and Health
  Monitor appeared automatically; a test asserts the palette never navigates to a
  path the router does not serve.
- New `Act` group: *Review pending approvals*, *Review unread signals*, and
  *Mark every signal read* — the first mutating command in the palette.
- New `Surface` command: *Check substrate health*.
- The search index gained an `Approval` kind (searchable by title, summary, and
  requester) and now routes signals to `/inbox` and gates to `/approvals`.

## Verification

| Command | Result |
|---------|--------|
| `pnpm lint` | 0 errors, 0 warnings |
| `pnpm typecheck` | clean |
| `pnpm test` | **100 tests, 14 files, passing** (Wave 1: 46 / 6) |
| `pnpm build` | success — 534.55 kB raw / 163.48 kB gzip, one chunk-size advisory (TD-16) |
| `pnpm preview` + headless Chrome | `/`, `/inbox`, `/approvals`, `/health` all render as deep links through the 404.html fallback |

New coverage: mutation persistence across a close/reopen cycle and across a demo
reseed, decision-event provenance, brief reflection of a decision, demo opt-out
after mutations, inbox filtering and ordering, approval ranking, health honesty
invariants, palette and search route parity, plus component tests that click
through both new surfaces against a real IndexedDB.

## Deferrals (intentional)

1. **Health probes.** They need an API to probe from; a Pages bundle cannot hold
   credentials. Until then `offline` is the honest answer (Wave 7).
2. **Remote persistence of decisions.** Decisions live in IndexedDB only. There is
   no server to write through to yet (Wave 7).
3. **Approval policy engine.** The WITHIN constitution is stated in copy, not
   enforced in code; nothing generates gates automatically because nothing
   generates content on this surface yet (Waves 4–6).
4. **Notification creation.** Wave 2 reads and mutates signals; it does not emit
   them. Emitters arrive with the modules that have something to say.
5. **Offline PWA claims.** M2 (Workbox / asset caching) is untouched. This build
   must still not be described as offline-capable.
6. **CSP.** Still Wave 7, pre–private-data, per the G3 gate.
7. Wave 3+ modules — CRM, pipeline, tasks, calendar, content, knowledge,
   research, AI workspace, decisions, automations, metrics, analytics, sync —
   remain registered and hidden.

## Debt movement

| ID | Movement |
|----|----------|
| TD-19 | **Paid.** A typed, tested mutation path exists; the brief can be acted on. |
| TD-10 | **Partly paid.** The Health Monitor exists and is honest. Probes still need an API, so this does not close until Wave 7. |
| TD-17 | **Reduced.** The 12-hour reseed can no longer undo an operator decision, though demo timestamps still move. |
| TD-16 | Unchanged and slightly larger (534 kB). Route-level splitting stays queued for Waves 3–4. |

## New debt

| ID | Debt | Severity | Note |
|----|------|----------|------|
| TD-20 | Decision events accumulate without retention | Low | Every approve/reject/reopen appends an event row. Demo-sourced events are cleared by a reseed or opt-out, but operator-sourced ones grow unbounded. Needs a retention rule when the audit log becomes real (Wave 7). |
| TD-21 | `Operator` is a hard-coded actor | Low | There is no identity on this surface, so `decidedBy` is a constant. Real attribution arrives with the auth gate (Wave 7). |
| TD-22 | Inbox and queue have no bulk keyboard selection | Low | Actions are per row plus one bulk control. Full keyboard-first triage (j/k, x to select) is queued with the L2 palette a11y work. |

## Deviations from the brief

1. **The brief asked for a System Logs view "only if it reuses health/audit
   events".** It does, so it shipped — as a `Recorded events` panel inside Health
   rather than a separate route. No new telemetry was invented for it.
2. **Notification hrefs in the seed were repointed** from `/` to the real Wave 2
   routes. A seeded deep link to a module that now exists is more honest than one
   that bounced to the brief.
3. **The brief's density limit became explicit.** Adding two more seeded signals
   pushed the credential-gap row past the six-item limit, which would have
   silently dropped a true item. Sections now carry a `total` and the UI prints
   `shown/total`, rather than quietly truncating.
4. **Row actions read `Mark read` / `Mark unread`**, not `Read` / `Unread`. The
   short labels collided with the `Read` filter button — a component test caught
   the ambiguity before a human could click the wrong control.
