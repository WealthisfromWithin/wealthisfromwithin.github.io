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
