# Wave 6 Implementation Brief — Leverage Fabric (Claude)

**Status:** Ready after Wave 5 G3 PASS (H1 fixed, 644 tests).  
**Implementer:** Claude Opus  
**Reviewer:** GPT-5.5  
**Architecture gate:** Grok 4.5  

Follow `ARCHITECTURE_AUDIT.md` §7 Wave 6. Do not start Wave 7 Command API sync/auth.

---

## Objective

1. **Automation Center** (`/automations`) — define safe local automations with approval gates where appropriate  
2. **Integration Registry** polish — credential awaiting flows already exist; deepen UX (filters, actions, copy) without storing secrets in Pages  
3. **MCP Connections** (`/mcp` or under Integrations) — panel listing MCP servers with Connected / Disabled / Awaiting Credentials only; no fake Connected; no implementing full MCP runtimes unless a local stub is honest  
4. **Analytics** (`/analytics`) — product analytics surface (content + pipeline + attention signals from local store)  
5. **Business Metrics / Financial KPIs** (`/metrics`) — leverage KPIs from local domain (pipeline value, content throughput, approvals latency, etc.) — no fake external finance APIs  
6. **Mission Control** (`/missions`) — enable if still planned; objectives tied to tasks/opportunities/content locally  

Keep Sync planned/hidden (Wave 7). Preserve kernel loopback policy and content approval sync.

---

## Branch

`cursor/sovereign-wave6-leverage-7cd2` from latest Wave 5 branch after G3 PASS commit.

---

## Automations (safe)

- Local rules: e.g. overdue task → notification; content due today → inbox; opportunity stalled → approval/attention  
- Runs are simulated/local job log — not n8n live unless awaiting credentials clearly  
- High-impact actions require Approval Queue gate  
- Never auto-publish content or call external providers  

---

## MCP panel

- Catalog entries for Hermes Memory, HermesBrain, Sovereign Mind MCP, vendor MCPs  
- States only: Connected | Disabled | Awaiting Credentials  
- Health derives from registry; no cosplay green  

---

## Acceptance

```
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

- Modules enabled; Sync still hidden  
- No secrets in VITE_*; no fake Connected  
- W4 M1 + W5 H1 regressions still green  
- `docs/waves/WAVE_6.md` + matrix deltas  
- Push branch; no PRs  

---

## Nav

Enable Automations, MCP (or Integrations sub), Analytics, Metrics, Missions as designed — hide anything unfinished.
