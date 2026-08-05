# Security Report (Baseline)

**Owner:** Principal Architect (Grok 4.5) — initial posture; **GPT-5.5 performs independent review** after Wave 1+.  
**Date:** 2026-08-05

## Current posture

| Area | Finding |
|------|---------|
| AuthN | None |
| AuthZ | None |
| Secrets in repo | None found in Pages repo (good) |
| XSS | Static HTML; low dynamic surface today |
| CSRF | N/A (no mutating API in this repo) |
| SQLi | N/A |
| Token storage | N/A |
| Rate limiting | N/A |
| Logging | Fake Sentinel only |
| Dependency risk | None (no package manager) |

**Public static site risk is low; product security is unstarted.**

## Mandatory controls before private data

1. No `VITE_*` private API keys.  
2. Demo mode default on public Pages.  
3. API-side session auth before CRM sync.  
4. CSP on built index.  
5. Markdown/HTML sanitization for notes/knowledge.  
6. CSRF tokens or same-site cookie discipline on API mutations.  
7. Rate limits on auth, AI, and webhooks.  
8. Audit log for approvals, credential changes, agent runs.  
9. Integration secrets encrypted at rest on API.  
10. GPT-5.5 security review gate each wave that touches auth, AI, or connectors.

**Post–Wave 1 fix pack:** production source maps are now disabled (`build.sourcemap: false`), settling half of GPT review finding M3; the CSP on the built index (control 4) remains deferred to pre–private-data hardening (Wave 7) per the G3 architecture gate.

## Trust bug already shipping

Substrate cards show **Healthy** / **Action Req** for systems this UI cannot probe. That is a security *and* product integrity issue: operators may believe monitoring exists. Wave 1–2 must replace with Registry truth.
