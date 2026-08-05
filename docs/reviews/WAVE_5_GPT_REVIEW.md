# Wave 5 GPT-5.5 Review

## Verdict: REQUEST CHANGES

## Summary

Wave 5 is largely complete and well-aligned with the cognition brief: the seven cognition modules are enabled, Wave 6+ modules remain planned and unrouted, provider SDKs stay out of UI code, hosted adapters refuse honestly, generated agent messages are written only from kernel success results, Wave 4 content approval sync is still intact, and document/research rendering uses React text nodes rather than HTML injection.

Verification passed locally:

```text
pnpm lint       -> pass
pnpm typecheck  -> pass
pnpm test       -> pass (612 tests, 48 files)
pnpm build      -> pass
```

The blocking issue is in the local provider boundary. `VITE_LOCAL_AI_URL` is documented as a loopback/local runtime, and the adapter marks itself `external: false`, but the implementation accepts any URL and will probe/post to it under the default policy. A remote URL therefore becomes an external model call that bypasses `AgentPolicy.allowExternalCalls: false`.

## Findings (Critical/High/Medium/Low, blocking Y/N)

### Critical

None.

### High

#### H1 - `VITE_LOCAL_AI_URL` can point at a remote endpoint while bypassing the external-call policy

- **File refs:** `src/agents/providers/local.ts:47-51`, `src/agents/providers/local.ts:60-72`, `src/agents/providers/local.ts:104-121`, `src/agents/kernel.ts:170-178`, `src/agents/providers/providers.test.ts:38-49`
- **Issue:** `createLocalProvider` treats every configured endpoint as the trusted local adapter: it sets `external: false`, reports ready when `/api/tags` answers, and posts the full turn history to `/api/chat`. There is no URL parsing or loopback/private-host validation. Because the kernel only blocks adapters whose descriptor says `external: true`, a build with `VITE_LOCAL_AI_URL=https://example.invalid` (or any non-local host) can send prompt/session content to a remote service even though the request policy did not allow external calls.
- **Impact:** This breaks the Agent Kernel policy boundary and weakens the Wave 5 security posture. It does not expose provider secrets, but it can exfiltrate operator/customer context from the AI Workspace to an arbitrary remote endpoint while the UI still labels the provider as "Local model" and non-external.
- **Recommended fix:** Restrict the local adapter to explicit local origins before health or completion: e.g. `http://localhost`, `http://127.0.0.1`, `http://[::1]`, and possibly documented LAN/private hosts only if the UI/policy labels them as non-public and the kernel can still distinguish them from third-party external providers. Invalid/non-local endpoints should refuse with `no_provider`/`policy_blocked` and never call `fetch`. Add tests for allowed loopback URLs and rejected remote URLs.
- **Blocking:** Yes.

### Medium

None.

### Low

None beyond the test gaps below.

## Security posture

- Good: no provider SDK imports were found outside `src/agents/providers/**`, and UI modules import the public kernel API (`@/agents`) rather than adapters.
- Good: hosted provider adapters never create text and return `generated: false` / `awaiting_credentials`.
- Good: no `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, `document.write`, direct hosted provider API fetches, browser token storage, or `VITE_*` key/secret/token variables were found in `src/`.
- Good: documents, prompt bodies, AI messages, and research findings/sources render as React text nodes; research sources are not anchors.
- Risk: the "local" AI endpoint is not constrained to local origins, so policy-safe local execution can become remote execution if the build environment is misconfigured.

## Architecture alignment

- Scope is correct: Knowledge, Memory, Documents, Decision Log, Prompt Library, AI Workspace, Agent Kernel/providers, and Research are the Wave 5 additions; Mission Control, Automations, Metrics, Analytics, and Sync remain `planned` and unrouted.
- The Agent Kernel shape is sound: provider ordering, refusal handling, external-call policy for external descriptors, and kernel-owned `requiresApproval` are centralized.
- AI Workspace honesty is strong: no provider-ready claim appears unless health says ready, refused turns are first-class records, and `runAgentTurn` writes assistant text only from kernel success results.
- Wave 4 M1 content approval synchronization appears preserved and tested from both the mutation and Approval Queue page paths.
- Href and route patterns match the prior safety model: new record routes are `/knowledge/node/:id`, `/documents/doc/:id`, and `/decisions/entry/:id`, with allowlisted query parameters and safe href builders.
- The only blocking architecture gap is H1: an adapter can effectively reclassify a remote endpoint as non-external by accepting an arbitrary URL.

## Test gaps

- Add local-provider URL validation tests for loopback allowed vs remote rejected, including a test that rejected remote URLs do not call `fetch`.
- Add an end-to-end kernel test proving `allowExternalCalls: false` cannot be bypassed by local-provider configuration.
- Consider a Dexie v4-to-v5 upgrade test that opens a pre-Wave-5 database and asserts the eight cognition stores exist while prior Wave 4 rows remain intact. Current schema and mutation coverage is strong, but the actual upgrade path remains mostly indirect.
- Consider a regression test for AI Workspace copy when `VITE_LOCAL_AI_URL` is rejected as non-local, so the UI does not imply a usable local runtime.

## Acceptance vs plan

- **Cognition modules enabled / Wave 6+ hidden:** Met.
- **Agent Kernel boundary:** Mostly met; provider SDK/adapters stay behind the kernel, but H1 lets the local adapter bypass the external-call policy via configuration.
- **Honest refusals / no fake completions:** Met for hosted adapters, unconfigured local, seeded messages, and persisted refused turns.
- **WITHIN/approval policy:** Kernel-owned `requiresApproval` is met for provider outputs. External-call policy is not fully met because of H1.
- **Wave 4 M1 approval sync:** Met; content gate decisions from `/approvals` move the linked content item and run/record compliance as expected.
- **XSS / document rendering safety:** Met for reviewed surfaces.
- **Secrets:** Met for private-key exposure; no private `VITE_*` keys found. Local endpoint origin validation is missing.
- **Href/record routes, demo opt-out, `touchedAt`:** Met in reviewed code and tests.
- **Verification:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` all pass.

## Recommended follow-ups before Wave 6

1. Fix H1 by validating `VITE_LOCAL_AI_URL` before any provider health/completion fetch and by preserving the kernel's external-call invariant.
2. Add the local-provider and kernel policy regression tests described above.
3. Keep provider credentials server-side only; do not add hosted provider browser calls in Wave 6 automation work.
4. Preserve the current href allowlist and text-node rendering patterns as automations/MCP surfaces are introduced.
5. Add true Dexie upgrade coverage before the next schema expansion.
