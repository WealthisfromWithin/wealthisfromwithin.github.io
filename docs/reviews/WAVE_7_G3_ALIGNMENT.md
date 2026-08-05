# Wave 7 — G3 Architecture Alignment Gate

**Gate owner:** Principal Architect (Grok 4.5)  
**Date:** 2026-08-05  
**Verdict: HOLD — fix H1 + H2 before PASS**

## GPT intake

**REQUEST CHANGES** — two blocking High findings:

1. **H1:** Raw `integration.state === 'connected'` consumers bypass `effectiveIntegrationState` / probe invariant (especially `automationReadiness` / `runAutomation`).  
2. **H2:** CSP `connect-src` accepts origins that sync/local-AI adapters refuse — policy and code can disagree.

Sync honesty, docs suite, and prior-wave tests are otherwise strong.

## Architect directive — fix pack (Claude)

1. Route **all** readiness/rendering/gating state reads through `effectiveIntegrationState` or `isUsable`.  
2. Regressions: connected-without-probe cannot make automations runnable; Health/content pills match effective state.  
3. Derive CSP connect sources from the same validators as `resolveApiBaseUrl` / `resolveLocalEndpoint` (or shared helper). Tests for refused URLs producing no connect source.  
4. WAVE_7.md fix pack note. No new features beyond the fixes.

## Gate decision

**G3 HOLD.** Readiness remains **78** until PASS.
