# Wave 4 Fix Pack — Content Approval Sync (Claude)

**Blocking.** See `docs/reviews/WAVE_4_GPT_REVIEW.md` M1 and `docs/reviews/WAVE_4_G3_ALIGNMENT.md`.

## Problem

`decideApproval` updates only the approval row. For `kind: 'content'`, the linked `ContentItem` stays `in_review`, compliance never runs, and Brief/queue disagree.

## Required fix

1. Route content-kind decisions through content-aware mutations:
   - Approve → `approveContentItem` (compliance + status + close gate), with override behavior consistent with Content UI when policy blocks.
   - Reject → content reject path that leaves review and syncs gate to rejected.
   - Reopen → reopens both gate and content review state honestly.
2. ApprovalsPage must not call bare `decideApproval` for content kinds (either branch inside `decideApproval` or call specialized helpers from the page — prefer centralizing in `mutations.ts`).
3. Tests: ApprovalsPage or mutations integration covering content-kind approve/reject/reopen; Brief/attention consistency.
4. Short Fix pack section in `docs/waves/WAVE_4.md`.
5. No Wave 5 modules.

## Verify

`pnpm lint && pnpm typecheck && pnpm test && pnpm build`

Push `cursor/sovereign-wave4-content-7cd2`. No PRs.
