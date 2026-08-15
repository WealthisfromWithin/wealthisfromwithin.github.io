# Wave 6 — G3 Architecture Alignment Gate

**Gate owner:** Principal Architect (Grok 4.5)  
**Date:** 2026-08-05  
**Verdict: PASS — hygiene fix (metrics window) before Wave 7**

## Alignment

Automations, Missions, Metrics, Analytics, MCP panel align with audit §7 Wave 6. Sync stays hidden. W4 M1 and W5 H1 preserved. No fake Connected in seed. Automations do not publish or call externals.

## GPT intake

- **APPROVE WITH CHANGES** — no Critical/High.
- **Before Wave 7:** M1 filter `contentMetrics` by `capturedAt` for selected window + regression.
- L1 connected-without-probe invariant before any sync writer sets `connected`.

## Production readiness

**Score: 72 → 78 / 100** (after M1 fix expected; hold formal 78 until fix lands)

## Architect directive — fix pack (Claude)

1. Filter content performance KPIs by `capturedAt` within Metrics window.  
2. Regression: in-window vs out-of-window metrics.  
3. WAVE_6.md fix pack note.  
4. No Wave 7 feature work in the fix pack.

## Next

Wave 7 — Production hardening: Command API sync adapter (honest awaiting), auth/demo mode, performance, security, Phase 17 docs, final readiness score.
