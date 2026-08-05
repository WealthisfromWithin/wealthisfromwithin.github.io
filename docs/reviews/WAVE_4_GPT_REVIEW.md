# Wave 4 GPT-5.5 Review

## Verdict: REQUEST CHANGES

## Summary

Wave 4 is broadly well-scoped and materially complete as a local-first Content Operating System. The implementation keeps Wave 5+ modules planned/hidden, adds the Content OS hub and nested surfaces, avoids provider calls and fake social publishing, centralizes content transitions/compliance helpers in the domain/data layers, stamps content mutations with `touchedAt`, preserves demo opt-out semantics, hardens content record hrefs, and wires content signals into the Brief, Inbox, search, and command palette.

Verification passed locally:

```text
pnpm lint       -> pass
pnpm typecheck  -> pass
pnpm test       -> pass (396 tests, 31 files)
```

The blocking issue is that content approval gates can be decided through the generic Approval Queue without using the compliance-aware content mutation. That leaves the linked content item in `in_review`, marks the gate as approved/rejected independently, and can make the Brief/queue disagree about whether the item is still awaiting approval. Fix that path before G3/Wave 5 so the shared Approval Queue is not a parallel, inconsistent decision surface for content.

## Findings (Critical/High/Medium/Low, blocking Y/N)

### Critical

None.

### High

None.

### Medium

#### M1 - Content gates approved in the Approval Queue bypass the content approval workflow

- **File refs:** `src/modules/approvals/ApprovalsPage.tsx:147-154`, `src/data/mutations.ts:83-103`, `src/data/mutations.ts:482-534`, `src/modules/dashboard/brief.ts:92-127`
- **Issue:** `submitContentForReview` creates a linked `Approval`, and `approveContentItem` correctly runs `checkContent`, moves the content item to `approved`, stamps compliance metadata, and closes the linked approval. However, the Approval Queue's own Approve/Reject/Reopen buttons call the generic `decideApproval` mutation for every approval kind. For `kind: 'content'`, that updates only the approval row and does not run `checkContent`, does not call `approveContentItem`, and does not transition or reject the content item. The result is an approved/rejected gate attached to an item still in `in_review`. The Brief then suppresses the generic approval row by approval id but still lists the content item as awaiting approval, using copy that says an open gate exists even if the gate has already been approved.
- **Impact:** The shared Approval Queue can present a content gate as decided while the Content OS still requires approval, and an operator can believe customer-facing copy cleared the human gate without the content status/compliance workflow being applied. This does not appear to enable fake publishing, but it does break the approval boundary and attention model.
- **Recommended fix:** Route content approvals through a content-aware writer. Options: disable/replace generic Approve/Reject controls for `kind: 'content'` with a link to the content item; or teach `decideApproval`/a new mutation to find the linked content item and call the compliance-aware approve/reject path, including honest override handling. Add regression coverage for approving/rejecting a content gate from `/approvals`.
- **Blocking:** Yes.

### Low

#### L1 - Dexie v3-to-v4 migration coverage is still mostly indirect

- **File refs:** `src/data/db.ts:103-132`, `src/data/repositories.test.ts:42-142`, `src/data/mutations.test.ts:723-749`
- **Issue:** Version 4 adds seven stores and widens `contentItems`, including a `review` -> `in_review` migration and defaulting several new fields. Current tests cover current-schema seeding, content mutations, reseed persistence, and demo opt-out, but I did not find a true upgrade test that opens a v3-shaped database and then upgrades it with the v4 `SovereignDb`.
- **Impact:** Low current risk because the demo seed is current and tests exercise the live schema heavily. The risk is legacy local stores: missing defaults or indexes in the upgrade path would only show up for users carrying older IndexedDB data.
- **Recommended fix:** Add a focused Dexie upgrade test that creates v3 content rows, opens with the current schema, and asserts new stores, indexes, `review` normalization, and defaulted content fields used by selectors/pages.
- **Blocking:** No.

#### L2 - Approval Queue tests do not cover content-kind gate semantics

- **File refs:** `src/modules/approvals/ApprovalsPage.tsx:86-113`, `src/modules/approvals/ApprovalsPage.test.tsx`, `src/data/mutations.test.ts:507-597`
- **Issue:** Content mutation tests cover creating and closing content gates through `submitContentForReview`/`approveContentItem`, and approval tests cover generic approval decisions. There is no cross-surface test proving what should happen when a `kind: 'content'` row is approved or rejected from `/approvals`.
- **Impact:** This is the test gap that allowed M1 to survive despite otherwise strong coverage.
- **Recommended fix:** Add one component or mutation integration test for a content approval row in `/approvals`, asserting content status, compliance behavior, approval status, and Brief/queue state after the decision.
- **Blocking:** No, once M1 is fixed.

## Security posture

- No `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, `document.write`, browser token storage, network `fetch`/XHR/WebSocket/EventSource calls, provider SDK imports, or direct social API calls were found in `src/`.
- React renders content copy, variants, hooks, CTAs, assets, templates, compliance excerpts, and seeded/operator text as text nodes, so XSS exposure remains low for the local-first scope.
- LinkedIn, Facebook, and n8n references are domain labels, seed content, integration registry rows, or explicit "awaiting credentials/manual" copy. I did not find fake publish-success claims.
- Record href builders and `isSafeInternalHref` cover the new `/content/item/:id` route and reject traversal/collapsed paths, unsafe schemes, external URLs, undeclared query params, and unsafe ids.
- Remaining production security prerequisites are unchanged for later waves: auth, CSP, remote-content sanitization, API-side secret vaulting, audit retention, CSRF/rate limits for mutating APIs, and sync hardening.

## Architecture alignment

- Aligns with `ARCHITECTURE_AUDIT.md` §5.8 and §7 Wave 4 in scope: Content OS is enabled; Knowledge, Research, AI Workspace, Decisions, Automations, Metrics, Analytics, and Sync remain planned/hidden.
- The content domain was absorbed locally rather than rewriting or calling the ContentDone Express app. No ContentDone/social HTTP adapter was introduced.
- Layering is mostly clean: the status transition table and compliance helper live in `src/domain`, while write paths stay in `src/data/mutations.ts`. Content pages read selectors and invoke data mutations rather than maintaining a separate write model.
- The only boundary concern is M1: the generic Approval Queue is now a second decision path for content gates, but it is not content-aware. That should be resolved by routing content-kind decisions through the content domain/write boundary.

## Test gaps

- Add cross-surface Approval Queue coverage for `kind: 'content'` decisions (M1/L2).
- Add true Dexie v3-to-v4 upgrade coverage for the seven new stores, `contentItems` indexes, status normalization, and defaulted fields.
- Add a regression that stale/decided approval gates do not cause the Brief to describe a content item as holding an open gate.
- Consider a narrow test for resubmitting content after a prior content approval was approved/rejected/reopened, once the intended lifecycle is fixed.

## Acceptance vs plan

- **Scope / Wave 5 hidden:** Met. `/content` and its nested Content OS surfaces are enabled; Wave 5+ modules remain planned and unrouted.
- **No fake social publish / Connected claims:** Met. Publish is disabled as awaiting credentials or recorded manually; no provider/social calls were found.
- **Status machine + compliance before approve:** Mostly met for Content OS actions, but not met through the generic Approval Queue path for content gates (M1).
- **Mutations persist / touchedAt / demo opt-out:** Met in covered paths. Content writes stamp `touchedAt`; operator-owned captured/promoted ideas are local; demo opt-out removes demo content stores even after touched mutations.
- **Href / subRoutes / record route safety:** Met. `/content/item/:id` avoids sub-route collision and traversal/collapsed paths are rejected.
- **Domain boundary:** Mostly met. Compliance/transitions are in domain; mutations remain data-layer writes. M1 is the main boundary leak because generic approval decisions lack content semantics.
- **Brief / inbox / learning honesty:** Mostly met. Content due today, approval-needed items, blocked content, inbox content signals, and local-only learning insights are wired and honestly described. M1 can make Brief copy stale after a content gate is decided in `/approvals`.
- **Security:** Met for public local-first Wave 4 scope.
- **Tests / Dexie schema:** Strong selector, UI, mutation, compliance, href, registry, and route coverage; true schema-upgrade coverage is still missing.

## Recommended follow-ups before Wave 5

1. Fix M1 so content approval gates cannot be decided generically without content compliance/status synchronization.
2. Add Approval Queue regression tests for content-kind approve/reject/reopen behavior.
3. Add a true Dexie v3-to-v4 upgrade test before adding more stores in Wave 5.
4. Keep all provider/social publishing work deferred until a credentialed API boundary exists.
5. Preserve the current href allowlist pattern for any new Wave 5 record routes.
