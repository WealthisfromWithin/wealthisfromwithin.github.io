# Wave 2 Fix Pack — Href Allowlist (Claude)

**Mandatory before Wave 3.** See `docs/reviews/WAVE_2_GPT_REVIEW.md` M1 and `docs/reviews/WAVE_2_G3_ALIGNMENT.md`.

## Task
1. Add a route-normalization helper that permits only currently **enabled** internal routes (and known query variants: `/inbox?status=unread`, `/approvals?status=all`, `/integrations?state=awaiting_credentials`, etc.).
2. Reject/fallback: external URLs, protocol-relative, `javascript:`, malformed, planned-module paths.
3. Apply in Morning Brief links, Inbox links, and any search result navigation that uses record hrefs.
4. Unit tests covering the unsafe cases.
5. Do not start Wave 3 modules.

Verify: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`

Push to `cursor/sovereign-wave2-attention-7cd2`. No PRs.
