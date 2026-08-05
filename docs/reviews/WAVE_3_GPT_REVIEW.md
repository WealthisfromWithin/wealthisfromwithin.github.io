# Wave 3 GPT-5.5 Review

## Verdict: APPROVE WITH CHANGES

## Summary

Wave 3 is correctly scoped and materially complete for the Revenue & Relationships brief. CRM, Pipeline, Tasks, Projects, Calendar, and Meetings are enabled in the module registry, routed, searchable, and reachable from the palette; Wave 4+ modules remain planned and hidden from navigation. The new record detail routes are declared centrally and the href allowlist now covers only enabled module paths, declared filter query values, and lower-case dynamic record ids. Mutations for task status/priority, task creation, opportunity stage movement, and meeting notes write to IndexedDB, stamp `touchedAt`, and are covered by reload/reseed/demo-opt-out regression tests.

The implementation also keeps the product honest: relationship intelligence and lead intelligence are local joins over stored records, expected value is value times record probability, won/lost probabilities settle to 100/0, and health/integration/provider surfaces make no fake connectivity claims. Full local verification passed:

```text
pnpm lint       -> pass
pnpm typecheck  -> pass
pnpm test       -> pass (281 tests, 26 files)
pnpm build      -> pass, with known Vite >500 kB main chunk advisory
```

No blocking correctness or security findings were found. I would still address the low-risk documentation/migration and blocked-task cleanup items before Wave 4 to keep the local store contract crisp.

## Findings (Critical/High/Medium/Low, blocking Y/N)

### Critical

None.

### High

None.

### Medium

None.

### Low

#### L1 - Dexie v3 company status backfill is inconsistent between code and Wave 3 documentation

- **File refs:** `src/data/db.ts:69-87`, `docs/waves/WAVE_3.md:69-77`
- **Issue:** The v3 migration comment and code backfill legacy companies as `prospect`, but the Wave 3 implementation doc says v2 rows are backfilled as `active`. This is not a current seeded-data bug because Wave 3 reseeds demo rows at `SEED_VERSION = 'wave3.0'`, but it creates ambiguity for real v2 local stores and future migration tests.
- **Recommended fix:** Pick one intended default and align code, comments, docs, and migration tests. I would lean toward the code's conservative `prospect` default unless product explicitly wants all pre-Wave-3 companies treated as active relationships.
- **Blocking:** No.

#### L2 - Blocked-task unblocking leaves stale `blockedReason` in the stored row

- **File refs:** `src/data/mutations.ts:149-157`, `src/modules/tasks/TasksPage.tsx:62-66`
- **Issue:** `setTaskStatus` clears `blockedSince` when a task moves out of `blocked`, but leaves `blockedReason` intact. The UI only renders the reason while status is `blocked`, so this is not user-visible dishonesty today. It is still a data hygiene edge case: if future UI/API paths can block and unblock tasks repeatedly, an old reason can remain attached and be revived by a later status change.
- **Recommended fix:** When status is not `blocked`, clear both `blockedSince` and `blockedReason`, or intentionally preserve the reason as historical data and rename/copy it into an audit/event field.
- **Blocking:** No.

## Security posture

- No active `dangerouslySetInnerHTML`, direct HTML injection, eval/new Function, `document.write`, unsafe `window.location` navigation, browser token storage, provider SDK imports, network fetches, WebSockets, or credential collection paths were found in `src/`.
- React text rendering is used for CRM, pipeline, task, meeting, and notes content, so seeded/operator text is escaped by default.
- Data-provided hrefs now pass through `normalizeInternalHref`; record links are built through `personHref`, `companyHref`, and `opportunityHref`; palette search navigation normalizes document routes before calling `navigate`.
- The allowlist rejects external URLs, unsafe schemes, protocol-relative/backslash tricks, planned-module paths, undeclared query parameters, unsafe query values, nested dynamic segments, encoded traversal, uppercase ids, empty ids, and queries on record routes.
- Provider references are catalog/kernel identifiers only. No OpenAI/Anthropic/Gemini/Apollo/ZoomInfo/HubSpot SDKs or client-side secrets are present.
- Remaining production prerequisites are unchanged: auth, CSP, remote-content sanitization, API-side secret vaulting, CSRF/rate limits, audit retention, and private-data sync hardening belong to later waves.

## Architecture alignment

- Aligns with `ARCHITECTURE_AUDIT.md` §5.3 and §7 Wave 3: the app adds CRM/relationship intelligence, pipeline/lead intelligence, tasks/projects, and calendar/meetings without starting Content OS, Knowledge, AI, Automations, Analytics, Sync, or provider work.
- `src/app/modules.ts` is still the source of truth for enabled/planned modules and record routes. Router children are derived from enabled modules plus enabled record routes; planned modules are not served except by catch-all redirect to the brief.
- Wave 3 pages live under `src/modules/{crm,pipeline,tasks,projects,calendar,meetings}` and read shared selectors/data types instead of creating parallel state.
- `src/data/mutations.ts` remains the write boundary. New writes stamp `touchedAt`, append local activity events where appropriate, and use provenance honestly.
- Relationship and lead intelligence are local joins over people/companies/opportunities/tasks/meetings. No fake score, enrichment provider, transcript, or predictive model was introduced.
- Route-level lazy loading is implemented for every non-brief route with a Suspense outlet in `AppShell`. TD-16 is honestly only partially mitigated because the shared main chunk remains above the advisory threshold.

## Test gaps

- Add a true Dexie v2-to-v3 upgrade test that opens a v2-shaped database, upgrades with the current `SovereignDb`, and asserts `projects`/`meetings` stores, new indexes, task/opportunity indexes, and company status defaults. Current persistence tests primarily seed current-schema databases.
- Add a regression around blocked-task transitions that defines whether `blockedReason` should clear or persist when a task moves out of `blocked`.
- Add a href test for hash fragments (for example `/inbox#x`) so the allowlist's intended "path plus declared query only" contract is explicit. I did not find an exploitable current path from hashes, but the policy should be tested.
- Add component coverage for opportunity detail page stage moves, including direct close to won/lost and expected/probability display after the mutation.
- Add rendered command-palette keyboard/focus coverage as density grows: arrow navigation, Enter, Escape, mode switch to search, and focus restoration.

## Acceptance vs plan

- **Scope:** Met. Wave 3 revenue/relationship modules are enabled; Wave 4+ modules are planned/hidden and parity-tested. Mission Control is correctly left planned despite earlier registry drift.
- **Persistence, `touchedAt`, reseed, opt-out:** Met. Mutated demo records survive reseed because they are touched; explicit demo opt-out removes even touched demo rows and prevents reseed until refresh/reset.
- **Href allowlist/dynamic routes:** Met for current app behavior. Record routes are declared, dynamic ids are shape-limited, detail routes take no query, and data-provided hrefs are normalized.
- **Pipeline/task honesty:** Met. Stage moves persist; closed deals settle probability to 100/0; expected value uses stored probability; task completion/reopen status and counts update from selectors.
- **Relationship intelligence:** Met. CRM and opportunity detail surfaces are local joins and stored fields, not scoring theater.
- **Lazy routes/TD-16:** Met as partial mitigation. Lazy chunks exist and router tests wait for Suspense, while the main chunk warning remains documented.
- **Security:** Met for public local-first Wave 3 scope. No secrets, provider SDKs, unsafe navigation, HTML injection, or fake connected states found.
- **Brief selectors:** Met. Morning Brief uses pipeline/task/calendar selectors for open opportunities, today's work/meetings, stalled opportunities, overdue tasks, and blocked projects.
- **Tests:** Strong for selectors, href safety, route parity, mutation persistence, demo opt-out, and key component interactions. Migration-depth and a few UI interaction gaps remain.
- **Dexie schema:** v3 adds `projects`, `meetings`, and new indexes as claimed; the only concern is the documented/company-status default mismatch in L1.

## Recommended follow-ups before Wave 4

1. Resolve L1 by aligning the company status migration default across code, comments, docs, and tests.
2. Resolve L2 or document the intended lifecycle of `blockedReason` after a task unblocks.
3. Add true Dexie v2-to-v3 migration coverage before introducing more stores/indexes.
4. Keep Content OS, Knowledge, AI, Automations, Analytics, Sync, and provider integration routes hidden until their real wave implementations exist.
5. Continue splitting constants away from selector modules or add vendor chunking in the planned performance pass; TD-16 remains only partially paid.
6. Preserve the current href-normalization pattern for every future record or notification producer before remote/user-authored data arrives.
