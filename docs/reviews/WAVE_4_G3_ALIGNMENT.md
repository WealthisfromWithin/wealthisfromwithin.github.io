# Wave 4 — G3 Architecture Alignment Gate

**Gate owner:** Principal Architect (Grok 4.5)  
**Inputs:** Wave 4 plan, `docs/waves/WAVE_4.md`, `docs/reviews/WAVE_4_GPT_REVIEW.md`  
**Date:** 2026-08-05  
**Verdict: HOLD — fix M1 before PASS / Wave 5**

---

## Alignment checklist

| Requirement | Status | Notes |
|-------------|--------|-------|
| Content OS hub + nested surfaces | Pass | |
| No fake social publish | Pass | |
| Local compliance on content approve path | Pass on Content OS; **Fail via Approvals** | M1 |
| Wave 5+ hidden | Pass | |
| Href/subRoutes safety | Pass | Traversal harden accepted |
| Domain layering | Mostly pass | M1 is the leak |
| Brief/inbox/learning honesty | Mostly pass | Stale after M1 |

## GPT intake

- **REQUEST CHANGES** accepted.
- **Blocking M1:** Generic `decideApproval` can close a `kind: 'content'` gate without `checkContent` / content status sync → Brief/queue disagree.
- L1/L2: follow after M1.

## Architect directive — fix pack (Claude)

**Preferred fix:** Make the Approval Queue content-aware:

1. For `kind: 'content'` approvals, Approve/Reject/Reopen must route through content mutations (`approveContentItem` / a paired reject that moves content out of `in_review` honestly, and reopen that re-opens both sides).  
2. Do **not** leave a path where the gate is decided and the item stays `in_review`.  
3. Override semantics: if Approvals Approve would fail compliance, either force override with recorded reason (matching Content OS) or deep-link to package with clear CTA — pick one and test it; prefer calling `approveContentItem` with/without override consistently with Content UI.  
4. Regression tests: approve/reject/reopen content gate from `/approvals`; assert content status, compliance metadata, approval status, Brief no longer claims open gate for that item.  
5. No Wave 5 feature work.

## Gate decision

**G3 HOLD.** Wave 4 does not pass until M1 is fixed and re-verified. Readiness stays at **55** until PASS.
