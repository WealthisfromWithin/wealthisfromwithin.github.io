# Wave 6 GPT-5.5 Review

## Verdict: APPROVE WITH CHANGES

## Summary

Wave 6 is broadly aligned with the Leverage Fabric brief. Automations are local and operator-invoked, gated automation effects flow through the existing Approval Queue, hand-off rules refuse rather than calling n8n or providers, Sync remains planned/unrouted, MCP is implemented as an Integration Registry lens with no invented rows, metrics/analytics are explicitly local-store readings, and the Wave 5 loopback AI policy is still intact.

Verification passed locally:

```text
pnpm lint       -> pass
pnpm typecheck  -> pass
pnpm test       -> pass (856 tests, 64 files)
pnpm build      -> pass
```

The changes I am asking for are targeted: fix a Metrics windowing bug before Wave 7, and tighten the future invariant around `Connected` registry rows before any probe writer exists.

## Findings (Critical/High/Medium/Low, blocking Y/N)

### Critical

None.

### High

None.

### Medium

#### M1 - Content performance KPIs ignore the selected Metrics window

- **File refs:** `src/modules/metrics/metrics.ts:267-318`, `src/modules/metrics/MetricsPage.tsx:97-99`
- **Issue:** `contentGroup()` filters published packages by `publishedAt`, but `engagement-rate` and `recorded conversions` sum every `dataset.contentMetrics` row regardless of the selected Metrics window. The page copy says "A window filters recorded dates," so `/metrics?window=30d` can include stale performance readings in content KPI values and samples.
- **Impact:** Operators can read old content performance as current-window performance. This does not fabricate external finance data, but it weakens the honesty contract of the Business Metrics surface.
- **Recommended fix:** Filter `contentMetrics` by `capturedAt` using the same `start`/`now` window before summing impressions, engagements, and conversions. Add a regression test with one in-window and one out-of-window content metric.
- **Blocking:** No for the Wave 6 branch; should be fixed before Wave 7.

### Low

#### L1 - `Connected` currently depends on a trusted registry row, not a probe timestamp invariant

- **File refs:** `src/integrations/mcp.ts:119-124`, `src/integrations/mcp.test.ts:56-68`, `src/integrations/state.ts:74-76`, `src/modules/health/health.ts:50-52`
- **Issue:** Current seeded data has zero connected integrations, and there is no Wave 6 writer that can mark one connected. However, selector logic treats any row with `state: 'connected'` as usable/verified and the MCP tests fabricate a connected row without `lastProbedAt`.
- **Impact:** Not a current fake-connected bug, but it leaves the Wave 7 probe writer contract under-specified. A future migration or sync adapter could set `state: 'connected'` without evidence and the UI would repeat "verified probe."
- **Recommended fix:** Before adding any writer/sync path that can set `connected`, require a valid `lastProbedAt` or explicit probe result on connected rows, and add tests that reject or downgrade connected-without-probe data.
- **Blocking:** No.

## Security posture

- No `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, DOM HTML injection, browser token storage, or credential text boxes were found in the reviewed Wave 6 surfaces.
- No provider SDK imports were found in UI or Wave 6 modules. Hosted AI adapters still refuse honestly, and the Wave 5 local adapter now rejects non-loopback `VITE_LOCAL_AI_URL` values before health or completion fetches.
- Automations do not call `fetch`, n8n, webhooks, provider APIs, or publishing APIs. The only automation side effects I found are IndexedDB writes to `automationRuns`, `approvals`, `notifications`, and `events`.
- MCP pages do not hold credentials, enumerate tools, report latency, or open transports.
- User/demo strings render as React text nodes in reviewed pages; routes/hrefs go through existing allowlists/builders.

## Architecture alignment

- **Scope:** Met. Automations, Mission Control, Business Metrics, Analytics, and `/integrations/mcp` are enabled. Command API Sync remains `planned`, hidden from nav, and unrouted.
- **Automations:** Met. Action vocabulary excludes publish/send/post; handoff always refuses; no scheduler or service worker automation path was found; gated notify writes an approval first and only writes the inbox signal after Approval Queue approval.
- **Approval Queue / W4 content sync:** Met. `decideApproval` dispatches content gates before automation gates and existing content approval tests still pass.
- **MCP honesty:** Met for current data and routes: rows come from the registry only, and the seeded catalog has no Connected rows. L1 is a future invariant gap.
- **Metrics/analytics honesty:** Mostly met. Revenue and pipeline values are local opportunity values with clear caveats; declared metric rows are quarantined as unverified. M1 is the notable windowing bug.
- **W5 H1 policy:** Met. Remote `VITE_LOCAL_AI_URL` is refused without a probe or completion request.

## Test quality / gaps

- Strong coverage was added across domain rules, mutations, selectors, pages, routes, hrefs, MCP registry behavior, and Dexie v5-to-v6 upgrade.
- Add the M1 regression test for `contentMetrics.capturedAt` window filtering.
- Add a connected-without-probe invariant test before Wave 7 sync/probe writers.
- Consider a test for approving a pending automation gate after any future rule-edit writer exists, so the approved payload cannot drift from the gate summary.

## Acceptance vs plan

- **Modules enabled; Sync hidden:** Met.
- **No auto-publish or external provider calls:** Met.
- **Approval-gated automation actions:** Met.
- **MCP states only Connected / Disabled / Awaiting Credentials; no invented rows:** Met for current branch data.
- **No fake external finance data:** Met; caveats are explicit. M1 affects time-window correctness, not source honesty.
- **No secrets in Pages / no provider SDK leakage:** Met in reviewed code.
- **Validation:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.

## Follow-ups before Wave 7

1. Fix M1 by filtering content performance KPIs by `capturedAt`.
2. Define and test the connected-probe invariant before any sync/probe writer can set `state: 'connected'`.
3. Keep Command API Sync hidden until auth, probe writers, and credential storage exist outside the Pages bundle.
4. Preserve the Approval Queue split between content gates and automation gates as additional automation actions are considered.
