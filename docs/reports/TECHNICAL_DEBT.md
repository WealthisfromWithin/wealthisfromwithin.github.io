# Technical Debt Report (Baseline)

**Owner:** Principal Architect (Grok 4.5)  
**Companion:** `ARCHITECTURE_AUDIT.md`  
**Date:** 2026-08-05

## Summary

Debt is dominated by **absence of an application**, not by messy application code. The Pages repo is a design artifact. Operational logic exists elsewhere and is not contractually bound to this UI.

## Register

| ID | Item | Severity | Paydown wave |
|----|------|----------|--------------|
| TD-01 | Source equals 303KB compiled HTML | Critical | Wave 1 |
| TD-02 | `index.html` ≡ `404.html` duplication | High | Wave 1 |
| TD-03 | Fake telemetry presented as live | High | Wave 1–2 |
| TD-04 | No module / package boundaries | Critical | Wave 1 |
| TD-05 | ContentDone JSON file database | High | Wave 6–7 |
| TD-06 | Hosted AI providers stubbed | Medium | Wave 5 |
| TD-07 | No Pages-safe credential model | Medium | Wave 1 + 6 |
| TD-08 | Cross-repo domain duplication | High | Wave 3–4 |
| TD-09 | No authentication | High | Wave 7 |
| TD-10 | No real health/observability | Medium | Wave 2 |
| TD-11 | Inter as default UI font in mock | Low | Wave 1 |
| TD-12 | Missing ADRs / system docs | Medium | Wave 0–7 |
| TD-13 | DEPLOYMENT.md org path drift in ContentDone | Low | Docs pass |
| TD-14 | No CI on Command Center property | High | Wave 1 |
| TD-15 | Agent names without runtime | Medium | Wave 5 |
| TD-16 | Single ~508KB JS chunk (no route splitting) | Low | Wave 3–4 |
| TD-17 | Demo seed refreshes on a 12-hour timer | Low | Wave 7 |
| TD-18 | Pages source not yet switched to GitHub Actions | Medium | Owner action |
| TD-19 | Repositories are read-plus-seed; no mutation path | Medium | Wave 2 |
| TD-20 | Decision events accumulate without a retention rule | Low | Wave 7 |
| TD-21 | `Operator` is a hard-coded actor on every decision | Low | Wave 7 |
| TD-22 | No bulk keyboard triage in the inbox or queue | Low | Wave 4 |
| TD-23 | Record hrefs validate id shape, not id existence | Low | Wave 7 |
| TD-24 | Selector modules load eagerly via the href allowlist | Low | Wave 7 |
| TD-25 | No blocked-reason capture when a task is blocked from the UI | Low | Wave 4 |
| TD-26 | Compliance policy is hard-coded and unversioned against what it checked | Low | Wave 6 |
| TD-27 | Content readings are assumed cumulative with nothing enforcing it | Low | Wave 5 |
| TD-28 | Hub sub-routes have no distinct sidebar state | Low | Wave 6 |

## Interest (cost of waiting)

Every day the poster stays live trains the operator to distrust Substrate health and Approval Queue signals. Fix truthfulness before adding modules.

## Wave 1 paydown (`docs/waves/WAVE_1.md`)

| ID | Status after Wave 1 |
|----|---------------------|
| TD-01 | **Paid.** Real Vite/React/TS source tree; the poster is archived at `legacy/poster.html`. |
| TD-02 | **Paid.** `404.html` is a build output of `index.html`, not a committed duplicate. |
| TD-03 | **Paid on this surface.** Fake telemetry deleted; every seeded row is badged and health reports the truth. |
| TD-04 | **Paid.** Module registry, domain, data, integrations, search, commands, agents, ui, lib boundaries. |
| TD-07 | **Partly paid.** Three-state credential model shipped; the vault still needs an API. |
| TD-10 | **Partly paid.** Health derives from registry truth and honestly reports offline; probes are Wave 2. |
| TD-11 | **Paid.** Inter replaced by DM Sans; Caslon and JetBrains Mono retained. |
| TD-14 | **Paid.** `ci.yml` runs lint, typecheck, test, and build on every branch and PR. |

## Wave 2 paydown (`docs/waves/WAVE_2.md`)

| ID | Status after Wave 2 |
|----|---------------------|
| TD-19 | **Paid.** `src/data/mutations.ts` is a typed, tested write path: approval decisions and notification read state persist in Dexie. |
| TD-10 | **Still partly paid.** The Health Monitor ships and is honest, but it projects registry state rather than probing. Closes when the Command API can probe (Wave 7). |
| TD-03 | **Held.** Wave 2 added three surfaces and no fake telemetry; health still reports `offline` and the log shows recorded events only. |
| TD-17 | **Reduced.** Rows the operator acted on carry `touchedAt` and survive the 12-hour reseed, so a demo refresh can no longer reopen a decided gate. Demo timestamps still move. |
| TD-16 | **Unchanged.** One chunk, now ~534 KB raw / ~163 KB gzip. Route splitting stays queued for Waves 3–4. |

## Wave 3 paydown (`docs/waves/WAVE_3.md`)

| ID | Status after Wave 3 |
|----|---------------------|
| TD-16 | **Partly paid.** Every route but the Morning Brief is `React.lazy`: 13 deferred chunks holding 76.77 KB raw / 23.91 KB gzip. Six new modules and three detail pages cost the first load 5.9 KB. The shared chunk (540 KB raw / 168 KB gzip) is React, React Router, Dexie, and Zod, which route splitting cannot move — the 500 KB advisory stands and the remainder is a Wave 7 vendor-chunking and validation-deferral problem. |
| TD-08 | **Partly paid on this surface.** CRM, pipeline, task, project, and meeting shapes are now defined once in `src/domain/entities.ts` instead of being re-derived from LeadScheduler doctrine. The cross-repo contract itself is still Wave 4–7. |
| TD-17 | **Held.** `touchedAt` now covers task status, task priority, opportunity stage, and meeting notes, so no Wave 3 mutation can be reseeded away. Demo timestamps still move. |
| TD-19 | **Held.** Five new writers went through `src/data/mutations.ts` without changing its shape. |
| TD-20 | **Larger.** Task transitions, stage moves, and meeting notes append to the same unbounded activity log. Demo-sourced rows still clear with the demo; operator-sourced ones still grow. Retention remains Wave 7. |
| TD-03 | **Held.** Expected value, project progress, relationship temperature, and stall age are arithmetic over stored fields. Nothing on the new surfaces is modelled, predicted, or fabricated. |
| TD-10 | **Unchanged.** Still no probes; health still reports `offline`. The CRM connectors Wave 3 would want stay `awaiting_credentials`. |

## Wave 4 paydown (`docs/waves/WAVE_4.md`)

| ID | Status after Wave 4 |
|----|---------------------|
| TD-08 | **Partly paid, further.** ContentDone's domain — ideas, campaigns, assets, templates, hooks, CTAs, variants, metrics — is now defined once in `src/domain/entities.ts`, and the compliance policy sits beside it in `src/domain/compliance.ts` rather than in a module. The cross-repo contract is still Wave 7 sync. |
| TD-16 | **Held, slightly larger.** Seven content pages ship as seven lazy chunks (48.9 KB of the 120.49 KB now deferred), but the first load grew to 582.31 KB raw / 181.65 KB gzip, most of it the seed. Vendor chunking is still the only thing that moves the advisory. |
| TD-17 | **Held.** Every content writer stamps `touchedAt`; an approval, a schedule, or a recorded publish survives the 12-hour reseed. |
| TD-19 | **Held.** Ten new writers, same module. The content writers return `{ ok, reason, compliance }` instead of a boolean, which the older writers should probably adopt. |
| TD-20 | **Larger.** Content status changes, idea captures, and promotions append to the same unbounded log. Retention remains Wave 7. |
| TD-03 | **Held.** Engagement rate, idea score, campaign counts, and the monthly comparison are arithmetic over stored readings, each printed with its sample size. An item with no reading shows no performance rather than a zero. |
| TD-10 | **Unchanged.** No probes. LinkedIn, Facebook, and the n8n publishing webhook stay `awaiting_credentials`, and the Content OS says so wherever a publish would otherwise be implied. |
| TD-24 | **Larger.** The href allowlist now reads the content filter constants too, so more selector code lands in the shared chunk. Same Wave 7 fix. |
| TD-25 | **Held.** `setContentStatus` can write `blocked`, but no surface collects a reason, so blocked packages still arrive only from the seed. |
