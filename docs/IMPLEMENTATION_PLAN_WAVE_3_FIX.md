# Wave 3 Hygiene Fix Pack (Claude)

See `docs/reviews/WAVE_3_GPT_REVIEW.md` L1–L2 and `docs/reviews/WAVE_3_G3_ALIGNMENT.md`.

1. Align docs/comments with code: Dexie v3 company status backfill = `prospect` (not `active`).
2. When `setTaskStatus` moves a task out of `blocked`, clear both `blockedSince` and `blockedReason`. Add a regression test.
3. Short note in `docs/waves/WAVE_3.md` Fix pack section.
4. No Wave 4 features.

Verify: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Push `cursor/sovereign-wave3-revenue-7cd2`. No PRs.
