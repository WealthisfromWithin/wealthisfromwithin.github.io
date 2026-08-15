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
| TD-29 | Memory review dates decay on one fixed interval for every kind | Low | Wave 6 |
| TD-30 | Agent session history is sent whole, with no length bound | Low | Wave 6 |
| TD-31 | Knowledge backlinks are computed by scanning every node | Low | Wave 7 |
| TD-32 | Automation triggers are evaluated by scanning whole tables per rule | Low | Wave 7 |
| TD-33 | A gated run stores no snapshot of the effect it deferred | Low | Wave 7 |
| TD-34 | Declared and counted mission progress diverge with nothing recording why | Low | Wave 7 |
| TD-35 | Window and median arithmetic is duplicated across analytics and metrics | Low | Wave 7 |

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

## Wave 5 paydown (`docs/waves/WAVE_5.md`)

| ID | Status after Wave 5 |
|----|---------------------|
| TD-06 | **Partly paid.** Hosted providers are no longer stubbed in the vague sense: four adapters live under `src/agents/providers/**` behind one interface, each reporting `awaiting_credentials` with the integration row that would fix it and refusing every call. The file holding them has no code path that produces text. Closes when the Command API can hold a key and sign a request (Wave 7). |
| TD-15 | **Partly paid.** There is a runtime: a kernel that orders adapters, applies the WITHIN policy, owns the approval flag, and returns the most explanatory refusal — plus a local adapter that genuinely runs against an operator-supplied endpoint. Named agents with roles and objectives remain Wave 6. |
| TD-16 | **Held, larger.** Ten new page chunks keep 78.9 KB out of the first load, but the seed and eight new zod schemas took it to 645.71 KB raw / 199.57 KB gzip across 32 deferred chunks. Vendor chunking (Wave 7) is still the only thing that moves the advisory. |
| TD-17 | **Held.** All 23 cognition writers stamp `touchedAt`; a recorded decision, a saved memory, or a captured node survives the 12-hour reseed. |
| TD-19 | **Held.** 23 new writers in the same module, adopting the `{ ok, reason }` result shape Wave 4 introduced. |
| TD-20 | **Larger.** An eighth channel, `cognition`, appends to the same unbounded activity log. Retention remains Wave 7. |
| TD-03 | **Held.** Everything counted is a count: recalls, prompt uses, findings, unanswered turns. Memory confidence is a provenance word — stated, observed, inferred — rather than a percentage, precisely so nothing on these surfaces reads as modelled. |
| TD-21 | **Held, and more visible.** `decidedBy` defaults to the same hard-coded `Operator` as every other actor field. A decision log is the first surface where the actor genuinely matters. |
| TD-23 | **Held.** `knowledgeHref`, `documentHref`, and `decisionHref` validate id shape, not existence; a link to a cleared record lands on "Not in the local store". |
| TD-24 | **Larger.** The href allowlist now reads filter constants from six more selector modules, pulling more selector code into the shared chunk. Same Wave 7 fix. |
| TD-27 | **Unpaid.** Nominally due this wave; nothing in Wave 5 touched content readings. Moves with the metric entry form. |
| TD-10 | **Unchanged.** No probes. The local adapter's `/api/tags` check is an adapter-level probe of the operator's own machine, not a Health Monitor probe, and Health still projects registry state. |

## Wave 6 paydown (`docs/waves/WAVE_6.md`)

| ID | Status after Wave 6 |
|----|---------------------|
| TD-15 | **Partly paid, further.** Named agents with roles are still absent, but the mechanism one would be handed now exists: declared triggers, declared actions, readiness derived from the registry, a gate shared with the human queue, and a run log that records refusals and empty runs as outcomes. The remaining gap is identity and authority, not machinery. |
| TD-07 | **Held, and better stated.** The MCP panel names the Command API as the only place an MCP token could live, and neither registry surface holds a credential, an endpoint, or a field to type one into. |
| TD-16 | **Held, larger.** Seven new page chunks keep 54.5 KB out of the first load, which nonetheless grew to 692.18 KB raw across 40 deferred chunks. Vendor chunking (Wave 7) still owns the advisory. |
| TD-17 | **Held.** All eight Wave 6 writers stamp `touchedAt`: a defined rule, an enabled or archived rule, an opened objective, a status move, and a declared progress figure all survive the 12-hour reseed. |
| TD-19 | **Held.** Eight new writers in the same module, keeping the `{ ok, reason }` result shape. |
| TD-20 | **Larger, in two ways.** Automation runs append to the same unbounded activity log, and `automationRuns` is itself a second unbounded table that grows every time a rule is asked to run. Retention remains Wave 7 and now has two tables to cover. |
| TD-03 | **Held.** Every KPI and loop reading carries its basis and sample size, refuses when the denominator is zero, and warns under five rows. Metric rows recorded as figures are quarantined in a "Declared metrics" group so a typed number is never read as a counted one. |
| TD-21 | **Held, and more visible.** `invokedBy` on every run is the same hard-coded `Operator`. A run log with one possible actor is the second surface where the actor genuinely matters. |
| TD-23 | **Held.** `automationHref` and `missionHref` validate id shape, not existence; a link to a cleared row lands on "Not in the local store". |
| TD-24 | **Larger.** The href allowlist now reads filter constants from the automations, missions, analytics, and metrics selectors plus the integration category list, pulling more selector code into the shared chunk. Same Wave 7 fix. |
| TD-26 | **Unpaid.** Nominally due this wave. No automation touches the compliance policy, and versioning it against what it checked is still coupled to the content approval path. |
| TD-27 | **Unpaid.** Content readings are still assumed cumulative. `/metrics` and `/analytics` read them and both state they were entered by hand or seeded, which makes the assumption visible without fixing it. |
| TD-28 | **Partly paid.** The MCP sub-route gets the same tab strip the Content OS has, so a nested surface is reachable and legible from its module. The sidebar still highlights only the module. |
| TD-05 / TD-29 / TD-30 / TD-31 | **Held.** Untouched by this wave. |
| TD-10 | **Unchanged.** Still no probes, and now stated per row: every connector and every MCP server prints *never probed*. |

## Wave 7 paydown (`docs/waves/WAVE_7.md`)

| ID | Status after Wave 7 |
|----|---------------------|
| TD-16 | **Substantially paid, and one claim corrected.** Vendor chunking splits React, Dexie, and Zod into separately cacheable chunks, and the demo seed is dynamically imported. First load fell from 692.21 kB raw / 210.16 kB gzip to **639.46 kB / 195.60 kB**, meeting the Wave 1 target of under 200 kB gzip for the first time — in a wave that also added a module. **The chunk-size advisory this item tracked does not fire, and did not fire at Wave 6 either:** rebuilding `cf8c64d` on the current toolchain emits no warning, because the largest chunk was 364.83 kB. The "one chunk-size advisory" recorded in the Wave 6 note does not reproduce and was carried forward rather than re-observed. What remains is `vendor-react` at 86.21 kB gzip (only a smaller framework moves it) and eager zod validation at 17.23 kB. |
| TD-10 | **Partly paid — the first probe in the platform's history.** `/sync` runs a real `GET /health` against a configured base URL and writes the result, with its timestamp, through `recordIntegrationProbe`. The Health Monitor's "N of M substrate systems verified" becomes true arithmetic the moment one succeeds. Capped hard: **1 of 29 connectors has a probe path**, because the other 28 need a credential this bundle cannot hold. Closes with the server-side vault. |
| TD-07 | **Partly paid, further.** The Pages-safe credential model is now enforced rather than asserted. Both URL-taking adapters refuse before sending: the Command API adapter rejects userinfo, query strings, fragments, and non-HTTPS on public hosts; the local model adapter rejects any non-loopback host. `/sync` prints only the **host** of a configured base URL, never the full URL, because a misconfigured value can carry userinfo. Still no vault — that is the Command API's job. |
| TD-12 | **Paid.** The seven Phase 17 documents exist under `docs/` and are written against measured facts: 30 stores, six migrations, 50 writers, two outbound `fetch` call sites, 639.46 kB first load. This closes item 8 of `ARCHITECTURE_AUDIT.md` §10. |
| TD-03 | **Held, and structurally reinforced.** Nothing in Wave 7 renders a figure that was not counted, and the connected-probe invariant removes the last place where a *state* could be displayed without evidence behind it. Fake telemetry was the debt; an unevidenced Connected was its last hiding place. |
| TD-17 | **Held.** `recordIntegrationProbe` stamps `touchedAt`, so a probed registry row survives the 12-hour reseed. The seed version deliberately stays at `wave6.0` — nothing about the seed's shape changed, and bumping it would rebuild demo rows for no reason. |
| TD-19 | **Held.** One new writer in the same module, keeping the `{ ok, reason }` shape. It is the first writer that is also a *gate*: it is the only path that can set `connected`, and it refuses rather than writes when the evidence is missing. |
| TD-20 | **Larger, marginally.** Probe results append to the same unbounded activity log. Retention is still unbuilt and now has two unbounded tables plus a third writer feeding one of them. This is the highest-value unpaid item that needs no server. |
| TD-21 | **Held.** A probe is recorded as `system` rather than `Operator`, which is arguably the first honest actor value in the codebase — but the hard-coded `Operator` remains everywhere else. |
| TD-24 | **Held, and now measured.** The href allowlist still imports filter constants from a dozen selector modules, dragging their siblings into the eager `index` chunk. Wave 7 can finally put a number on it: `index` is 127.42 kB raw / 37.26 kB gzip, and declaring filter values as data rather than importing them is the largest remaining build win. |
| TD-23 | **Held.** Record hrefs still validate id shape, not existence. `/sync` adds no record route. |
| TD-05 / TD-06 / TD-08 / TD-09 / TD-15 | **Held.** All five need the Command API. Wave 7 built the adapter's *boundary* and declared what sits on the far side of it; it did not cross it. |
| TD-13 | **Held.** `DEPLOYMENT.md` now exists in this repository and is accurate for this repository. The org-path drift in ContentDone's copy is that repository's to fix. |
| TD-18 | **Unchanged, and owner-blocked.** The Pages source must be switched to GitHub Actions in repository settings. Nothing in this repo can assert it, and until it is set the workflow succeeds while nothing ships. |
| TD-25 / TD-26 / TD-27 / TD-28 / TD-29 / TD-30 / TD-31 / TD-32 / TD-33 / TD-34 / TD-35 | **Held.** Untouched by this wave. TD-35 (duplicated window arithmetic) and TD-32 (per-rule table scans) are the two most likely to bite first. |

**No new debt was filed in Wave 7.** The wave added one module, one writer, one
build plugin, and 850 lines of source — and each was built against the existing
contracts rather than beside them. The debt that grew, grew because existing
mechanisms were used more (TD-20), not because a new mechanism was introduced.

### Unpaid items now overdue

Five items were nominally due by Wave 7 and are not paid. They are listed here
rather than quietly re-dated:

| ID | Item | Why it slipped |
|----|------|----------------|
| TD-20 | Retention on `events` and `automationRuns` | Needs no server and was not scoped into any wave. **The most overdue item on the register** |
| TD-21 | Hard-coded `Operator` actor | Genuinely blocked — there is no identity without auth |
| TD-23 | Hrefs validate shape, not existence | Low value while the degraded state ("Not in the local store") is correct and legible |
| TD-24 | Eager selector loading via the allowlist | Deferred while the performance target was unmet; now that it is met, this is optimisation rather than necessity |
| TD-31 / TD-32 | Whole-table scans | Correct at every scale this store has reached. Fixing them now would be optimising against a load that does not exist |
