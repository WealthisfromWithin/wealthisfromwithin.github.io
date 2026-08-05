# Wave 2 GPT-5.5 Review

## Verdict: APPROVE WITH CHANGES

## Summary

Wave 2 delivers the requested Attention OS surfaces without expanding routed scope into Wave 3+ CRM, pipeline, content, AI, or automation modules. Inbox and Approval Queue are real local write surfaces: read state, approve/reject/reopen decisions, decision metadata, and decision events persist through reload and are protected from the 12-hour demo reseed by `touchedAt`. The Wave 1 M1 demo opt-out is now durable and absolute, including after acted demo rows, which is the right behavior for an explicit "Remove demo rows" control. Health Monitor is materially honest for the shipped registry: zero Connected connectors, offline substrate, no synthetic probe, no uptime/latency claim, and recorded events are local activity only. Registry/nav/router parity is strong and tested from the registry, with all Wave 3+ modules left `planned` and unserved by the router. The main change I would require before remote/user-generated records is an enabled-internal-route allowlist for data-provided notification hrefs; current seed rows are safe, but the rendering boundary still trusts arbitrary `href` strings. Verification passed locally: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` with 100 tests passing and the known single-chunk build advisory.

## Findings (Critical/High/Medium/Low with blocking Y/N)

### Critical

None.

### High

None.

### Medium

#### M1 - Data-provided notification hrefs are rendered without an enabled-route allowlist

- **File refs:** `src/domain/entities.ts:127-135`, `src/modules/dashboard/brief.ts:56-66`, `src/modules/dashboard/MorningBriefPage.tsx:44-52`, `src/modules/inbox/InboxPage.tsx:67-75`
- **Issue:** `Notification.href` accepts any string, and both the Morning Brief and Inbox render that value directly through React Router `Link`. The Wave 2 seed uses only internal enabled routes, so this is not exploitable from current static demo data. However, the boundary will become unsafe as soon as notifications can be user-authored, synced, imported, or created by future modules: external URLs, protocol-relative URLs, `javascript:` URLs, or planned-module paths could become misleading navigation or an XSS/open-redirect-style browser navigation risk.
- **Recommended fix:** Add a small route-normalization helper that permits only currently enabled internal routes (and known query variants such as `/inbox?status=unread`, `/approvals?status=all`, `/integrations?state=awaiting_credentials`). Fallback unknown, external, unsafe-scheme, or planned-module hrefs to `/inbox`, `/approvals`, `/integrations`, or `/` based on record kind.
- **Blocking:** No for Wave 2 seeded-local acceptance; yes before remote/user-generated notification records.

### Low

#### L1 - `operational` health is based on the `connected` enum, not probe evidence

- **File refs:** `src/integrations/state.ts:59-112`, `src/modules/health/health.ts:62-75`, `src/modules/health/health.test.ts:73-83`, `src/integrations/state.test.ts:77-84`
- **Issue:** The shipped catalog has zero Connected integrations and tests assert that, so the current UI is honest. The generic health derivation will nevertheless report `operational` when every eligible substrate row has `state: 'connected'`, even if no row carries `lastProbedAt`. If future migration/import code writes a Connected row without proof, the UI can claim operational while the probe line says no probe has ever run.
- **Recommended fix:** Before any connector can become Connected, make `connected` require probe metadata/freshness at the schema/repository boundary or have `deriveSubstrateHealth` count only connected rows with valid probe evidence.
- **Blocking:** No for Wave 2, because no shipped connector is Connected.

#### L2 - Approval decision events can grow without retention

- **File refs:** `src/data/mutations.ts:46-88`, `src/modules/health/health.ts:48-126`, `docs/waves/WAVE_2.md:186-191`
- **Issue:** Every approval state change appends an activity event. The Health page limits rendering to 12 rows, and demo-sourced events clear with demo opt-out, but local/operator events can grow indefinitely.
- **Recommended fix:** Define retention, compaction, or export semantics when the audit log becomes product truth in Wave 7.
- **Blocking:** No.

#### L3 - Production bundle still ships as one large JS chunk

- **File refs:** `package.json:8-15`, `src/app/router.tsx:1-43`, `docs/waves/WAVE_2.md:177-184`
- **Issue:** Build succeeds, but Vite reports the main JS chunk at 534.63 kB raw / 163.49 kB gzip. This is documented TD-16 and not a Wave 2 functional issue, but it will become more costly as Wave 3+ modules add heavier screens.
- **Recommended fix:** Introduce route-level lazy loading when new routed modules are enabled.
- **Blocking:** No.

## Security posture

- No `dangerouslySetInnerHTML`, direct `innerHTML`, `eval`, browser token storage, or provider SDK imports were found in active `src/`.
- No secrets or credential collection paths are present in the Wave 2 UI. Settings and Integrations correctly state that credentials belong to a future Command API, not the public Pages bundle.
- Provider references in `src/integrations/catalog.ts` and `src/agents/kernel.ts` are identifiers/copy only, not SDK usage or network calls.
- React text rendering escapes seeded record titles/bodies/summaries; I found no current XSS through textual content.
- The remaining security concern is URL safety for data-provided notification hrefs (M1). It is safe with the current seed but should be fixed before any non-seed notification source.
- CSP, source-map policy, auth/session design, API secret vaulting, CSRF/rate limits, and sanitized remote-content rendering remain Wave 7/private-data prerequisites.

## Architecture alignment

- Strong alignment with `ARCHITECTURE_AUDIT.md` §5.3, §5.4, §5.7, and §7 Wave 2.
- Enabled modules are exactly Morning Brief, Approval Queue, Health Monitor, Inbox, Integrations, and Settings. The Commander/Operator split matches the Wave 2 plan.
- All Wave 3+ modules remain `planned`, hidden from navigation, and unserved by the router; `src/app/modules.test.ts` verifies parity and route refusal for planned modules.
- Inbox, Approvals, and Health are module-scoped under `src/modules/{inbox,approvals,health}` and use shared domain/data helpers rather than introducing a parallel architecture.
- `src/data/mutations.ts` centralizes Wave 2 writes. The mutation path stamps `touchedAt`, which is correctly reused by reseeding logic to preserve operator actions.
- Health owns no probe, ping, or timer. It projects Integration Registry rows plus local activity events and avoids fake uptime/latency/green claims in the shipped state.
- No routed Wave 3+ CRM/content/provider feature leaked into the app. Search still indexes local demo domain records, but unbuilt record kinds route to existing surfaces rather than dead planned routes.

## Test gaps

- Add a route-safety test for `Notification.href` covering external URLs, protocol-relative URLs, `javascript:`, malformed strings, and planned-module paths.
- Add migration-focused Dexie tests that open a true version-1 database, upgrade to v2, and verify legacy approvals backfill `status: 'pending'` without corrupting decided rows or indexes.
- Add component coverage for approval `Reject` and `Reopen` flows, not only `Approve`, and verify the Brief/sidebar counts update from the same click.
- Add a rendered Morning Brief test for `shown/total` truncation copy and for decided gates disappearing after mutation.
- Add a health test asserting a Connected substrate row without `lastProbedAt` cannot produce an operational claim once probe evidence becomes mandatory.
- Command palette tests remain light for rendered keyboard/a11y behavior: Ctrl/Cmd+K, `/`, arrows, Enter, Escape, focus restoration, and mutating commands should get component or browser coverage as density grows.

Verification run locally:

```text
pnpm lint       -> pass
pnpm typecheck  -> pass
pnpm test       -> pass (100 tests, 14 files)
pnpm build      -> pass, with Vite chunk warning at 534.63 kB raw / 163.49 kB gzip
```

## Acceptance vs plan

- **Notifications inbox (`/inbox`):** Met. Lists local notifications, filters via URL, orders by attention, writes read/unread state, and supports mark-all-read.
- **Approval Queue (`/approvals`):** Met. Pending/approved/rejected filters work, approve/reject/reopen mutate the local store, decisions persist through reload, and decided gates leave Brief attention.
- **Health Monitor (`/health`):** Met for Wave 2. Derived from Integration Registry and local events only; shipped state has no fake Connected/Healthy/operational claim.
- **Morning Brief wiring:** Met. Header counters link to Inbox/Approvals, attention items link to relevant existing surfaces, decided gates are excluded, and density truncation exposes shown/total counts.
- **Module registry/nav/router parity:** Met and tested. Enabled modules match Wave 1 + Wave 2 only.
- **Demo badging and opt-out:** Met. Demo rows are badged; demo opt-out removes acted demo rows and survives reload/`ensureSeeded`.
- **No Wave 3+ scope leakage:** Met in routes/navigation. Future-domain demo records remain local/searchable but do not expose CRM/content/pipeline routes.
- **Acceptance command chain:** Met locally.

## Recommended follow-ups before Wave 3

1. Close M1 by normalizing notification hrefs to enabled internal routes before any new producer can write notifications.
2. Add the Dexie v1-to-v2 upgrade regression test using an actual version-1 database fixture.
3. Make future Connected/operational health states require valid probe evidence, not only the enum value.
4. Expand rendered interaction tests around Approval reject/reopen, Brief/sidebar live count updates, and command palette mutating actions.
5. Keep Wave 3 modules hidden until real routes exist, and add any newly enabled route to the registry-derived parity tests.
6. Revisit route-level code splitting as soon as Wave 3 adds heavier CRM/pipeline/task/calendar screens.
