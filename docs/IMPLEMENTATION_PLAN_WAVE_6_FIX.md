# Wave 6 Fix Pack — Metrics Window (Claude)

See `docs/reviews/WAVE_6_GPT_REVIEW.md` M1 and `docs/reviews/WAVE_6_G3_ALIGNMENT.md`.

1. In `contentGroup()` / metrics selectors, filter `contentMetrics` by `capturedAt` using the same window as the page.
2. Regression test: one in-window + one out-of-window metric; windowed KPIs exclude the stale row.
3. WAVE_6.md fix pack note.
4. No Wave 7 features.

Verify: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`  
Push `cursor/sovereign-wave6-leverage-7cd2`. No PRs.
