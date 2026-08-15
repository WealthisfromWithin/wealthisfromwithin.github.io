# Wave 7 Implementation Brief — Production Hardening (Claude)

**Status:** Ready — Wave 6 G3 PASS + metrics window fix (857 tests).  
**Implementer:** Claude Opus (+ docs)  
**Reviewer:** GPT-5.5 (security emphasis)  
**Architecture / performance:** Grok 4.5  

Follow `ARCHITECTURE_AUDIT.md` §7 Wave 7 and Phase 17 doc list. Prefer refinement over rewrite.

---

## Objective

1. **Command API Sync module** (`/sync`) — enable as honest adapter UI: Connected / Disabled / Awaiting Credentials for ContentDone/API base URL; client that no-ops or probes `/health` only when `VITE_API_BASE_URL` is set; never store secrets in Pages; never fake sync success  
2. **Demo vs private mode** — Settings: clear Demo Mode; no fake auth theater — if no API auth, stay demo-local with badges  
3. **Connected-probe invariant (W6 L1)** — `connected` requires `lastProbedAt` (or equivalent); tests reject connected-without-probe  
4. **Performance** — vendor chunking / further split if cheap; document TD-16 status  
5. **Security hardening for static surface** — CSP meta or headers doc for Pages; confirm no secrets; sanitize any remaining risks  
6. **Phase 17 documentation** (create/update under `docs/`):
   - `SYSTEM_ARCHITECTURE.md`
   - `DATABASE.md`
   - `API.md`
   - `MCP.md`
   - `DEPLOYMENT.md`
   - `OPERATIONS.md`
   - `DEVELOPER_GUIDE.md`
7. **Final reports refresh** under `docs/reports/`: Feature matrix, Remaining Issues, Production Readiness (target score honest), Integration, Security, Performance, Roadmap 90-day, Executive Summary  
8. Preserve all prior wave invariants (W4 M1, W5 H1, W6 metrics window)

---

## Branch

`cursor/sovereign-wave7-harden-7cd2` from latest Wave 6.

---

## Out of scope

- Full OAuth/IdP product  
- Real multi-tenant SaaS  
- Live MCP transports that claim Connected without probe  
- Rewriting ContentDone server in this repo  

---

## Acceptance

```
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

- `/sync` enabled with honest states  
- Probe invariant tested  
- Docs listed above exist and match the running system  
- Final readiness score documented with rationale  
- Commit + push; no PRs  

