# Wave 5 — G3 Architecture Alignment Gate

**Gate owner:** Principal Architect (Grok 4.5)  
**Date:** 2026-08-05  
**Verdict: HOLD — fix H1 before PASS / Wave 6**

---

## Alignment

Cognition surfaces, kernel boundary, hosted refusals, Wave 4 M1 preservation, and Wave 6+ hiding are sound. Blocking gap: local adapter trusts any `VITE_LOCAL_AI_URL` while advertising `external: false`, bypassing `allowExternalCalls: false`.

## GPT intake

- **REQUEST CHANGES** — H1 blocking.
- Restrict local endpoint to loopback (and only carefully documented private hosts if ever needed). Reject remote URLs before any `fetch`. Tests required.

## Architect directive — fix pack (Claude)

1. Validate `VITE_LOCAL_AI_URL` is loopback only: `localhost`, `127.0.0.1`, `[::1]` (http or https on those hosts). Reject everything else with honest `no_provider` / unconfigured — **no fetch**.  
2. Optionally: if non-loopback is ever needed later, it must set `external: true` and respect kernel policy — do **not** add that in this fix unless tests prove policy still holds; prefer loopback-only for Wave 5.  
3. Tests: allowed loopback; rejected remote (assert no fetch); kernel cannot be bypassed via misconfigured local URL.  
4. UI copy when rejected as non-local should not imply a usable local runtime.  
5. Note in `docs/waves/WAVE_5.md` Fix pack. No Wave 6 features.

## Gate decision

**G3 HOLD.** Readiness stays **65** until PASS.
