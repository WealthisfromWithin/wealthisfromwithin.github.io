# Wave 2 Implementation Brief — Attention OS (Claude)

**Status:** Ready — Wave 1 G3 PASS + fix pack verified (46 tests).  
**Implementer:** Claude Opus / Sonnet  
**Reviewer:** GPT-5.5  
**Architecture gate:** Grok 4.5  

Follow `ARCHITECTURE_AUDIT.md` §7 Wave 2. Do not invent architecture. Do not expand into Wave 3+ (CRM/pipeline/content).

---

## Objective

Make the Command Center an **attention operating system**:

1. **Notifications inbox** (`/inbox`) — unread / attention items from local store  
2. **Approval Queue** (`/approvals`) — human gates; approve/reject mutate local store  
3. **Health Monitor** (`/health`) — substrate truth from Integration Registry only (no fake greens)  
4. Wire Morning Brief deep links / actions to these surfaces where selectors already point  
5. Enable these three modules in the module registry (nav + router); keep all other planned modules hidden  
6. System Logs minimal view only if it reuses health/audit events without new fake telemetry — otherwise defer under Health as an events list  

---

## Branch

Create/work on: `cursor/sovereign-wave2-attention-7cd2` from latest `cursor/sovereign-wave1-foundation-7cd2`.

---

## Domain / data

- Reuse existing entities (`Notification`, `Approval`, etc.) in `src/domain` — extend only if needed with zod + provenance  
- Seed a few **badged demo** approvals and notifications (respect demo opt-out)  
- Approvals: statuses like `pending | approved | rejected`; mutations must update store and reflect in Brief selectors  
- Health: derive exclusively from `integrations/state` + catalog; show awaiting/disabled counts; never invent Connected  

---

## UX

- Preserve Sovereign dark-first brand tokens  
- High density, quiet, keyboard-first  
- Inbox and Approvals should be actionable (not posters)  
- Cards only when interaction needs a container  
- Incomplete Wave 3+ modules stay hidden  

---

## Palette / search

- Register commands/routes for Inbox, Approvals, Health  
- Search must find seeded notifications/approvals by title  

---

## Out of scope

- CRM, pipeline, content OS, live AI, MCP servers, OAuth, remote API  
- Claiming robust offline PWA (M2 still open)  
- Full CSP  

---

## Acceptance

```
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

- Nav shows Brief, Approvals, Health (Commander) + Inbox, Integrations, Settings (Operator) — adjust IA to match audit without clutter  
- `/inbox`, `/approvals`, `/health` work; unknown routes still redirect  
- Approve/reject persists across reload  
- Demo opt-out still respected  
- No fake Healthy/Connected  
- Write `docs/waves/WAVE_2.md`  
- Update feature matrix deltas  
- Commit + push branch; do not create PR (parent will)

---

## Suggested Commander / Operator enablement

**Commander:** Brief `/`, Approvals `/approvals`, Health `/health`  
**Operator:** Inbox `/inbox`, Integrations `/integrations`, Settings `/settings`
