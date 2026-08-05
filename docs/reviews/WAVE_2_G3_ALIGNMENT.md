# Wave 2 — G3 Architecture Alignment Gate

**Gate owner:** Principal Architect (Grok 4.5)  
**Inputs:** Wave 2 plan, `docs/waves/WAVE_2.md`, `docs/reviews/WAVE_2_GPT_REVIEW.md`  
**Date:** 2026-08-05  
**Verdict: PASS — fix pack (href allowlist) before Wave 3**

---

## Alignment checklist

| Requirement | Status | Notes |
|-------------|--------|-------|
| Notifications inbox | Pass | Actionable; filters; mark read |
| Approval Queue | Pass | Persist + touchedAt vs reseed |
| Health from registry only | Pass | Zero Connected; offline honest |
| Brief wiring | Pass | Counters + shown/total |
| Hide Wave 3+ | Pass | Registry-tested |
| M1 demo opt-out preserved | Pass | Absolute after mutations |
| No fake Healthy/Connected | Pass | |

## GPT intake

- **APPROVE WITH CHANGES** accepted.
- Critical/High: none.
- **Mandatory before Wave 3:** GPT M1 — enabled-route allowlist for `Notification.href` (and any Brief/Inbox Link consumers). Cheap leverage; blocks open-redirect/planned-route lies once producers expand.
- L1–L3: queued debt (probe evidence, event retention, code splitting).

## Production readiness delta

| Metric | Post W1 | Post W2 |
|--------|---------|---------|
| Readiness score | 32 | **42** |
| Working application | 8 → 11 | Six live surfaces |
| Data integrity | 5 → 7 | Mutations + touchedAt |
| Integrations honesty | 7 → 8 | Health projection |
| UX completeness | 6 → 7 | Attention loop usable |
| Quality gates | 6 → 7 | 100 tests |

## Architect directives — fix pack (Claude)

1. Add `normalizeInternalHref(href)` (or equivalent) allowing only enabled module paths + known safe query variants; reject `javascript:`, external, protocol-relative, planned routes.  
2. Use it in Brief + Inbox (and search navigation if applicable).  
3. Tests for unsafe/external/planned hrefs → safe fallback.  
4. No Wave 3 feature work in the fix pack.

## Gate decision

**G3 PASS.** Wave 2 Attention OS is architecturally sound. After href fix pack, Wave 3 (Revenue & relationships) may start.
