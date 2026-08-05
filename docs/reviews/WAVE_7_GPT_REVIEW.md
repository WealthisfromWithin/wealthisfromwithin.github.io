# Wave 7 GPT-5.5 Review

## Verdict: REQUEST CHANGES

Wave 7 is close in intent and much stronger than prior waves on sync honesty: `/sync`
does not auto-fetch, does not accept URL-carried secrets, sends the health probe
with `credentials: 'omit'` and no headers, and does not claim that records moved.
Demo/local-mode copy is also materially more honest than earlier settings copy.

I cannot approve the hardening gate yet because two security/trust invariants are
not actually structural:

1. Some consumers still read raw `integration.state`, and one of them can mark an
   automation runnable from a `connected` row that has no `lastProbedAt`.
2. The production CSP `connect-src` builder accepts origins that the adapters
   would refuse, so the CSP can grant an exfiltration destination exactly when the
   docs say the policy and adapter validation cannot disagree.

Verification passed locally:

```text
pnpm lint       -> pass
pnpm typecheck  -> pass
pnpm test       -> pass (919 tests, 68 files)
```

## Findings

### High

#### H1 - Connected-probe invariant is bypassed by raw integration-state consumers

- **File refs:** `src/domain/leverage.ts:340-347`, `src/domain/leverage.ts:392-399`,
  `src/data/mutations.ts:2154-2163`, `src/modules/automations/automations.ts:81-95`,
  `src/modules/content/ContentItemPage.tsx:101-107`,
  `src/modules/health/HealthPage.tsx:91-96`,
  `src/integrations/state.ts:90-91`
- **Issue:** Wave 7 adds `effectiveIntegrationState()` to downgrade `connected`
  rows with no parseable `lastProbedAt`, but several consumers still use
  `integration.state` directly. The most serious path is `automationReadiness()`:
  any non-handoff automation with `requiresIntegrationId` becomes runnable when
  the raw row says `connected`, even if the row has no probe timestamp. That same
  readiness function drives both the Automation Center selector and
  `runAutomation()`, so this is not just display copy. Other surfaces can also
  render a raw green `Connected` pill for unprobed rows, creating contradictions
  with the registry/header counts that use the effective state.
- **Impact:** The Wave 6 L1 invariant remains incomplete. A hand-edited
  IndexedDB row or a future careless writer can reintroduce fake Connected/usable
  behavior outside the registry page, which is exactly the class of failure Wave
  7 set out to prevent.
- **Recommended fix:** Route all state reads through `effectiveIntegrationState`
  (or `isUsable`) anywhere state affects rendering, sorting, readiness, matching,
  capability blocking, or action gating. Add regression tests for
  `automationReadiness()` and `runAutomation()` with a `connected` row lacking
  `lastProbedAt`, plus component coverage for Health and content publishing
  pills.
- **Blocking:** Yes.

#### H2 - CSP `connect-src` can allow origins the adapters refuse

- **File refs:** `src/lib/csp.ts:78-84`, `src/lib/csp.ts:95-98`,
  `src/modules/sync/sync.ts:89-109`, `src/agents/providers/local.ts:93-102`,
  `src/lib/csp.test.ts:76-92`, `docs/DEPLOYMENT.md:135-140`,
  `docs/waves/WAVE_7.md:300-303`
- **Issue:** `connectSourcesFromEnv()` uses `originOf()`, which accepts any
  parseable `http:` or `https:` URL and strips it to an origin. That is less
  strict than both adapters. Examples the code adapter refuses but CSP would add
  to `connect-src`: `http://api.example.com`, `https://user:pw@api.example.com`,
  `https://api.example.com?api_key=abc`, and
  `https://models.example.com` via `VITE_LOCAL_AI_URL`. The current CSP test only
  checks an unparsable string.
- **Impact:** The public no-env build still gets `connect-src 'self'`, but a
  misconfigured hardened build can silently grant a compromised dependency a
  remote exfiltration destination while the `/sync` or local AI adapter refuses
  to call that same origin. That breaks the documented claim that "the policy and
  the code cannot disagree" and weakens the CSP's main stated purpose.
- **Recommended fix:** Derive CSP connect sources from the same accepted
  configuration states as the adapters, or extract shared validation so refused
  API/local-AI values produce no connect source. Add tests for every refused
  `resolveApiBaseUrl()` case and non-loopback `resolveLocalEndpoint()` case.
- **Blocking:** Yes.

### Medium

None beyond the two blocking findings.

### Low

None.

## Security posture

- Good: `/sync` is honest about its implemented capability. With no
  `VITE_API_BASE_URL` it makes no request; with a refused URL it makes no
  request; with an accepted URL it performs only `GET /health` with
  `credentials: 'omit'`, no headers, `cache: 'no-store'`, and an abort timeout.
- Good: I found no credential field, browser token storage, provider SDK import,
  hosted-provider browser call, `dangerouslySetInnerHTML`, `innerHTML`, `eval`,
  `new Function`, or `document.write` in reviewed source.
- Good: hosted AI adapters still refuse, and the local AI adapter still rejects
  non-loopback endpoints before probing or completing.
- Risk: H2 means CSP is not yet a trustworthy exfiltration backstop for
  configured builds.
- Risk: clickjacking protection remains absent on GitHub Pages because
  `frame-ancestors` cannot be delivered by a meta CSP. The docs state this
  honestly.
- Risk unchanged: no auth, no authorization, no server-side credential vault, no
  private-data backup/export, no rate limits, and no API-side audit log.

## Architecture alignment

- `/sync` aligns with the static Pages boundary: it is an adapter, not a sync
  implementation, and it does not store or solicit secrets.
- Demo-local/auth claims are honest. Settings distinguishes the removable demo
  seed from the deployment reality that no backend/session exists.
- Wave 4 M1 appears preserved by existing tests and source shape: content gates
  still route through content-aware approval handling.
- Wave 5 H1 appears preserved at the local AI adapter/kernel boundary.
- Wave 6 M1 appears fixed in `contentGroup()` by filtering `contentMetrics` with
  `capturedAt` inside the selected metrics window.
- Wave 6 L1 is not fully closed because H1 leaves raw state consumers outside
  the effective-state invariant.

## Test gaps

1. No regression proves `automationReadiness()`/`runAutomation()` reject a
   `connected` integration without `lastProbedAt`.
2. No component tests prove Health substrate rows and content publishing copy
   render the effective state rather than raw `integration.state`.
3. CSP tests do not cover adapter-refused-but-parseable URLs.
4. No build-level test verifies the generated CSP for invalid env values.
5. No coverage/e2e/browser-CSP suite yet; all current tests are jsdom/unit-level.

## Acceptance vs plan

- **`/sync` enabled with honest states:** Mostly met, subject to H2 for CSP
  parity in configured builds.
- **No fake sync success / no secrets in Pages:** Met in the Sync UI and adapter
  code I reviewed.
- **Connected-probe invariant enforced:** Not met. Write-side enforcement exists,
  and many reads are correct, but H1 leaves material bypasses.
- **CSP correctness / bypasses:** Not met for configured builds because H2 can
  widen `connect-src` beyond adapter-accepted origins.
- **Prior invariants:** W4 M1, W5 H1, and W6 metrics window look preserved; W6 L1
  remains incomplete.
- **Docs accuracy vs code:** Not met. Several docs say every consumer uses the
  read-time downgrade and that CSP cannot disagree with adapter configuration;
  both claims are currently false.
- **Readiness score honesty:** The 78/100 score is directionally conservative
  about missing auth/private mode, but the specific gains for integrations
  honesty and auth/security are overstated until H1 and H2 are fixed.

## Follow-ups for production

1. Fix H1 and H2 before approving Wave 7.
2. Deliver CSP as a response header before private data, including
   `frame-ancestors 'none'` and HSTS.
3. Build the Command API with session auth and server-side connector probes
   before any private CRM/content sync.
4. Keep connector/provider secrets server-side only; do not introduce bearer
   tokens readable by JavaScript.
5. Add export/backup and retention controls before relying on local IndexedDB for
   real operational records.
6. Add browser-level tests for CSP, service worker behavior, and at least the
   sync/settings/auth-honesty flows.
