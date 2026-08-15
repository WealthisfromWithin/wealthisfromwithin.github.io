# Wave 7 Fix Pack — Probe Invariant + CSP Align (Claude)

**Blocking.** See `docs/reviews/WAVE_7_GPT_REVIEW.md` H1–H2 and `docs/reviews/WAVE_7_G3_ALIGNMENT.md`.

## H1
- Replace raw `integration.state` checks that affect UX/actions with `effectiveIntegrationState` / `isUsable`.
- Especially `automationReadiness` and `runAutomation`.
- Tests: connected row without `lastProbedAt` is not runnable; Health/content pills consistent.

## H2
- CSP `connect-src` must only include origins accepted by the same validation as sync API base URL and local AI loopback resolver.
- Tests: remote/local-AI refused URLs and secret-bearing URLs add no connect source.

## Docs
WAVE_7.md fix pack note. No new product features.

Verify: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`  
Push `cursor/sovereign-wave7-harden-7cd2`. No PRs.
