# Wave 5 Implementation Brief — Cognition (Claude)

**Status:** Ready — Wave 4 G3 PASS after M1 fix (409 tests).  
**Implementer:** Claude Opus  
**Reviewer:** GPT-5.5  
**Architecture gate:** Grok 4.5  

Follow `ARCHITECTURE_AUDIT.md` §7 Wave 5 and §5.6 Agent Kernel. Do not invent architecture. Do not start Wave 6 Automations/MCP servers. No live billed provider calls without explicit awaiting-credentials honesty.

---

## Objective

1. **Knowledge Base** (`/knowledge`) — notes/nodes with tags; link to people/content/opportunities where natural  
2. **Memory** (`/memory`) — durable operator/system memories (facts, preferences, decisions context)  
3. **Documents** (`/documents`) — document metadata + body (local markdown/text; sanitize on render if needed — prefer text nodes)  
4. **Decision Log** (`/decisions`) — record decisions with rationale/status  
5. **Prompt Library** (`/prompts`) — reusable prompts; no provider execution required to browse/edit  
6. **AI Workspace** (`/ai`) — chat/workspace UI talking **only** to Agent Kernel  
7. **Agent Kernel + provider adapters** — keep UI free of SDKs; implement `local` stub (and optional adapters that refuse until credentials — never fake completions as live provider success)  
8. **Research** (`/research`) — research briefs/topics queue (local); no pretending live web scrape unless clearly local/demo  

Enable these in the module registry. Keep Automations, MCP-as-module, Metrics/Analytics-as-product-module, Sync **planned/hidden** (Wave 6/7). Mission Control may remain Wave 6.

---

## Branch

`cursor/sovereign-wave5-cognition-7cd2` from latest `cursor/sovereign-wave4-content-7cd2`.

---

## Agent Kernel rules (non-negotiable)

- UI imports only from `src/agents` kernel API — never provider packages (eslint already enforces).  
- Providers implement one interface; adapters under `src/agents/providers/**` only.  
- Default: stub/local that returns honest `generated: false` / `no_provider` when no endpoint.  
- If OpenAI/Anthropic/Gemini/OpenRouter adapters are added, they must check credentials and return awaiting/disabled — **no silent fake success**.  
- AI Workspace shows provider status from Integration Registry / kernel health.

---

## Domain

Extend zod + Dexie as needed:

- `KnowledgeNode`, `MemoryEntry`, `Document`, `Decision`, `Prompt`, `ResearchItem`, `AgentSession` / `AgentMessage` (local)

Seed badged demo. Respect demo opt-out. Mutations stamp `touchedAt`.

---

## Brief / search / palette

- Brief: recent decisions, memory prompts, research due, AI follow-ups if any  
- Search indexes all new entities  
- Palette commands for each module + “New decision” / “Save memory” if lightweight creates exist  

---

## UX

- Sovereign density; lazy routes; href/record route patterns  
- Knowledge/Memory: lists + detail, not empty card grids  
- AI Workspace: clear when stub vs live  

---

## Out of scope

- Live MCP servers, Automation Center product, Command API sync, OAuth  
- Claiming semantic search without embeddings provider (fuzzy OK; label semantic as awaiting if not real)  

---

## Acceptance

```
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

- Enabled cognition routes; Wave 6+ hidden; registry parity  
- Kernel boundary held; no provider SDK in UI  
- Content approval sync (W4 M1) still green  
- `docs/waves/WAVE_5.md` + feature matrix deltas  
- Commit + push; no PRs  

---

## Suggested nav

**Commander:** Brief, Approvals, Health, Decisions (optional under Commander)  
**Operator:** … Knowledge, Memory, Documents, Research, AI, Prompts, …
