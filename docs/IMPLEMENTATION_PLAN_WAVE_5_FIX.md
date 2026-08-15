# Wave 5 Fix Pack — Local AI URL Policy (Claude)

**Blocking.** See `docs/reviews/WAVE_5_GPT_REVIEW.md` H1 and `docs/reviews/WAVE_5_G3_ALIGNMENT.md`.

## Fix

1. Parse `VITE_LOCAL_AI_URL`; allow only loopback hosts (`localhost`, `127.0.0.1`, `::1` / `[::1]`).
2. Non-local / invalid → refuse health/complete with honest state; never `fetch`.
3. Keep `external: false` only for validated loopback endpoints.
4. Tests: loopback OK; remote rejected without fetch; kernel policy cannot be bypassed.
5. AI Workspace / health copy when non-local rejected.
6. WAVE_5.md fix pack note. No Wave 6 work.

Verify: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`  
Push `cursor/sovereign-wave5-cognition-7cd2`. No PRs.
