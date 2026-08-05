# Sovereign Mind Command Center — Architecture Audit

**Auditor role:** Principal Architect (Grok 4.5)  
**Scope:** `wealthisfromwithin.github.io` (primary) + ecosystem repos `ContentDone`, `leadschedulerpro`  
**Date:** 2026-08-05  
**Mode:** Read-only intelligence. No production feature code in this phase.  
**Repo audited SHA:** `dce9b41` — *Deploy Sovereign Command dashboard to GitHub Pages*

---

## Executive Verdict

The Command Center **does not yet exist as software**. What is live on GitHub Pages is a **single-file visual prototype** of HermesBrain Sovereign Mission Command: premium dark UI, hardcoded KPIs, dead navigation, no data layer, no auth, no APIs, no MCP, no agent runtime.

The real operational systems live **outside** this repo, fragmented across:

| System | Repo | Reality |
|--------|------|---------|
| Sovereign Command UI shell | `wealthisfromwithin.github.io` | Static HTML mockup + PWA shell |
| Content / lead engine | `ContentDone` | Working Express + JSON file store + n8n hooks |
| Sales / CRM collateral | `leadschedulerpro` | Static marketing + CSV CRM + pipeline docs |

**Primary architectural job:** converge these into one coherent operating system, with this GitHub Pages property becoming the **command surface**, and ContentDone (or a successor API) becoming the **execution substrate**.

Do **not** rewrite ContentDone blindly. Absorb its proven domain model. Replace the mock UI with a real application. Unify under one information architecture.

---

## 1. Current Architecture

### 1.1 Primary repository inventory

```
wealthisfromwithin.github.io/
├── index.html              # 303 KB — inlined Tailwind CSS + static dashboard markup
├── 404.html                # Identical copy of index.html (SPA fallback intent, unused)
├── sw.js                   # Offline cache shell (sovereign-v1)
├── manifest.webmanifest    # PWA: "Sovereign Command | HermesBrain"
├── icon-192.png / icon-512.png
├── .nojekyll
└── .gitignore              # .DS_Store, node_modules/
```

**No source tree.** No `package.json`. No TypeScript. No React/Next. No tests. No CI. No env schema. No database. No backend. One commit on `main`.

### 1.2 What the UI actually is

**Brand / visual system (preserve):**

| Token | Value |
|-------|-------|
| Obsidian base | `#16130b` |
| Surface container | `rgb(35, 31, 23)` |
| Surface high / highest | `rgb(46,42,33)` / `rgb(57,52,43)` |
| Sovereign gold | `rgb(201, 162, 39)` / `#c9a227` |
| Ivory / on-surface | `rgb(245,241,232)` / `rgb(234,225,212)` |
| Sentinel teal | `#2A9D8F` |
| Alert | `rgb(230, 57, 70)` |
| Glass | `rgba(35,31,23,.6)` + blur 12px |
| Display | Libre Caslon Text |
| UI caps | Inter |
| Data | JetBrains Mono |

**Nav (Commander Mode / Operator Mode):**

- Command ← active, but only one screen exists  
- Substrate, Mission Control, Intelligence, Inbox, Content, Automations ← all `href="#"`

**Visible mock modules on the single screen:**

- Compounding Leverage Projection / Constraint Locator  
- Autonomation Pipeline Discovery  
- Sovereign Substrate health (LeadScheduler, ContentDone, TruOak)  
- Mission Control cards (MSN-042, MSN-043) with fake agent chains (ORACLE / ARIA / ENVOY / SCRIBE)  
- Sovereign Mind: Pulse timeline  
- Agent Approval Queue  

**Interactivity:** hover border on `.glass-panel`; fake “Last beat” timer; service worker registration. Sixteen buttons; zero functional handlers beyond hover.

### 1.3 Ecosystem backends (not in this repo)

#### ContentDone — the closest thing to a real OS kernel

- **Stack:** Node/Express, JSON file persistence under `data/`, optional Ollama/local AI, n8n webhooks, Render/Railway deploy  
- **AI abstraction (nascent):** `packages/ai` → `getModelProvider()` + `generateText()` for `local | openai | anthropic` — hosted providers return fallback (“integration pending”)  
- **Domain stores:** leads, audits, content-calendar, social-queue, social-publishes, publishing-log, nurture, topic-history, cta-events, capacity, clients, analytics  
- **API surface (representative):**

```
GET  /health
GET  /api/config | /api/leads | /api/content | /api/analytics | /api/trends
GET  /api/dashboard/overview | /api/capacity | /api/clients | /api/learning/insights
POST /api/quiz | /api/audit | /api/content | /api/content/:id/publish | /api/content/approval
POST /api/automation/research | /api/social-queue | /api/cta/track | /api/learning/cycle
POST /api/webhooks/{calendly,crm,social}
POST /api/compliance/check
```

- **Integrations (env-gated, honest skipped states):** Calendly, n8n, CRM webhook, Airtable, LinkedIn, Facebook, social publish webhook  
- **Missing from ContentDone vs Command Center vision:** auth, CRM graph, tasks/projects, knowledge/memory, command palette, MCP topology, multi-provider agent orchestration beyond stub, HermesBrain, Sovereign Mind MCP

#### leadschedulerpro — sales operating collateral

- Static lead-gen site + Playwright tests  
- CSV CRM dumps + `pipeline-stages.md` (7-stage sales OS)  
- Sequences: email, SMS, voicemail  
- **No live API.** Useful as domain source for CRM / Opportunity / Lead Intelligence modules.

### 1.4 Hosting / deploy reality

| Property | Constraint |
|----------|------------|
| This repo | GitHub Pages (static only) |
| ContentDone | Render / Railway (Node) |
| n8n | `sovereignwealthkingdom.app.n8n.cloud` |
| Secrets | Render env only; none in Pages repo |

**Implication:** The Command Center UI can ship as a static SPA on Pages, but any privileged integration must call an API substrate (ContentDone successor) or run client-side against user-provided keys with explicit status states. Never pretend cloud secrets exist in a Pages bundle.

### 1.5 Auth / routing / state / MCP today

| Concern | Status |
|---------|--------|
| Auth | Absent |
| Routing | Absent (single HTML document) |
| State management | Absent |
| Database | Absent in Pages; JSON files in ContentDone |
| MCP | Named in mission brief only; zero implementation |
| Search / command palette | Absent |
| Agent layer | Cosplay labels (ARIA, ORACLE…) with no runtime |
| Security surface | Static public site only — low attack surface, zero product security |

---

## 2. Problems

1. **Illusion of a product.** The Pages site looks like an OS; it is a poster.  
2. **Fragmented brain.** Content, leads, sales, and command UI live in three repos with no shared schema or identity.  
3. **No source of truth.** Build artifact committed as source; unmaintainable (303 KB duplicated in `404.html`).  
4. **Dead navigation** creates fake module inventory.  
5. **Fake operational signals** (health, beats, missions, approvals) presented without labeling as demo — violates Phase 18 golden rule.  
6. **AI layer incomplete.** ContentDone’s provider interface is the right shape; hosted providers are stubs.  
7. **JSON file DB** does not scale to Command Center (FKs, indexes, concurrency, multi-tenant).  
8. **No MCP topology.** Integrations listed in the mission do not exist here; ContentDone covers a subset via webhooks only.  
9. **No command palette / global search** — fatal for a keyboard-first OS.  
10. **Brand/type tension:** mock uses Inter for UI (against preferred expressive stacks elsewhere), but Caslon + JetBrains + gold/obsidian is a coherent Sovereign identity — keep identity, refine type roles.  
11. **Sister DEPLOYMENT.md references a different org path** (`PlanYourLegaSEED/ContentDone`) than the live owner (`WealthisfromWithin/ContentDone`) — documentation drift.  
12. **No tests, lint, types, or CI** on the Command Center property.

---

## 3. Strengths

1. **Clear brand gravity.** Obsidian + sovereign gold + Caslon reads as one product, not a generic dashboard.  
2. **Correct product metaphor already sketched:** Commander vs Operator modes, Substrate health, Mission Control, Approval Queue, Pulse.  
3. **ContentDone is a real kernel** with routes, compliance gate, learning loop, capacity limits, and honest integration skip states — rare and valuable.  
4. **LeadScheduler pipeline doctrine** is unusually complete for CRM stage design.  
5. **PWA shell** already exists (manifest + SW) — installable command surface is cheap to finish.  
6. **WITHIN / AI2AI spec** already defines approval gates, self-evolution rules, and optimization objectives — adopt as agent constitution.  
7. **GitHub Pages + API split** can be the right long-term topology if designed intentionally (UI edge / API core).

---

## 4. Technical Debt

| ID | Debt | Severity | Notes |
|----|------|----------|-------|
| TD-01 | Source = compiled HTML | Critical | Cannot iterate safely |
| TD-02 | Duplicate `index.html`/`404.html` | High | Drift risk |
| TD-03 | Hardcoded fake telemetry | High | Trust destruction |
| TD-04 | No module boundaries | Critical | Every feature would be a rewrite |
| TD-05 | ContentDone JSON store | High | Needs SQLite/Postgres migration path |
| TD-06 | Hosted AI providers stubbed | Medium | Interface exists; finish it |
| TD-07 | Integration secrets undocumented for Pages | Medium | Need credential status model |
| TD-08 | Three-repo domain duplication (leads/content) | High | Convergence required |
| TD-09 | No authn/z | High | Block before any private data |
| TD-10 | No observability beyond fake Sentinel | Medium | Needs real health probes |
| TD-11 | Inter as default UI font in mock | Low | Replace with intentional stack |
| TD-12 | No ADR / architecture docs in repo | Medium | This audit begins repayment |

---

## 5. Recommended Architecture

### 5.1 One-sentence thesis

**Sovereign Mind Command Center = a static, keyboard-first React SPA (Pages) talking to a typed Command API (evolved ContentDone), with a single Agent Kernel, Integration Registry, and local-first store that degrades gracefully when credentials are absent.**

### 5.2 System topology

```
┌─────────────────────────────────────────────────────────────┐
│  COMMAND SURFACE (this repo → GitHub Pages)                 │
│  React + TS + Vite SPA · dark-first · PWA                   │
│  Shell: Sidebar · Topbar · Command Palette · Global Search  │
│  Modules: Dashboard, Missions, CRM, Content OS, Agents…     │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS (typed client)
┌───────────────────────────▼─────────────────────────────────┐
│  COMMAND API (ContentDone successor /api/v1)                │
│  Auth · RBAC · Domain services · Webhooks · Jobs            │
│  Agent Kernel (Claude/GPT/Gemini/OpenRouter adapters)       │
│  Integration Registry (Connected|Disabled|Awaiting Creds)   │
└───────┬─────────────────────────┬───────────────────────────┘
        │                         │
   ┌────▼────┐              ┌─────▼──────┐
   │ Store   │              │ Externals  │
   │ Postgres│              │ Google*    │
   │ (+vec)  │              │ Notion     │
   │ Redis   │              │ ClickUp    │
   │ optional│              │ GitHub     │
   └─────────┘              │ Slack, …   │
                            │ n8n/MCP    │
                            └────────────┘
```

\*Google Workspace suite treated as one connector family with discrete capability flags (Gmail, Calendar, Drive).

### 5.3 Application architecture (Command Surface)

```
apps/command-center/          # Vite React TS (source of truth)
  src/
    app/                      # shell, router, providers
    modules/                  # one folder per product module
    domain/                   # entities, schemas (zod), policies
    data/                     # repositories (local + remote)
    agents/                   # UI-facing agent session API only
    integrations/             # status model + capability cards
    search/                   # global index + fuzzy + recent/pinned
    commands/                 # command palette registry
    ui/                       # design system (tokens, primitives)
    lib/                      # clock, id, result types
packages/ (optional later)
  schema/                     # shared zod/OpenAPI with API
```

**Rules:**

- UI never imports provider SDKs (OpenAI/Anthropic/etc.) directly.  
- All AI goes through `agents/` → API Agent Kernel.  
- All externals go through Integration Registry.  
- Demo data must be tagged `source: "demo"` and visually badged.  
- Modules with no implementation are **hidden from nav**, not stubbed as “Coming soon” pages.

### 5.4 Information architecture (nav that answers the six questions)

The dashboard must answer:

1. What needs attention?  
2. What opportunities exist?  
3. What should I do today?  
4. What changed overnight?  
5. What is blocked?  
6. What is producing leverage?

**Recommended IA (Commander / Operator preserved):**

**Commander**

| Route | Module | Job |
|-------|--------|-----|
| `/` | Executive Dashboard / Morning Brief | Answer the six questions |
| `/missions` | Mission Control | Objectives, agents, predictions |
| `/approvals` | Approval Queue | Human gates |
| `/metrics` | Business Metrics / Financial KPIs | Leverage proof |
| `/health` | Health Monitor + System Logs | Substrate truth |
| `/decisions` | Decision Log | Institutional memory of choices |

**Operator**

| Route | Module | Job |
|-------|--------|-----|
| `/inbox` | Notifications + Unread | Attention inbox |
| `/crm` | CRM + Relationship Intelligence | People/companies |
| `/pipeline` | Revenue Pipeline + Opportunities + Leads | Money motion |
| `/tasks` | Tasks + Projects | Execution |
| `/calendar` | Calendar + Meetings + Notes | Time |
| `/content` | Content Operating System | Production OS |
| `/knowledge` | Knowledge + Memory + Documents | Compounding context |
| `/research` | Research | External signal |
| `/ai` | AI Workspace + Prompt Library | Controlled generation |
| `/automations` | Automation Center | Workflow leverage |
| `/integrations` | MCP Connections | Honest connectivity |
| `/analytics` | Analytics | Learning loop |
| `/settings` | Settings | Preferences, credentials status |

Command Palette (`⌘K`) and Search (`/`) are shell-level, not modules.

### 5.5 Data architecture

**Phase A (ship UI immediately on Pages):** IndexedDB (Dexie) local store + optional remote sync.  
**Phase B (production truth):** Postgres via Command API with migrations.

**Canonical domains (normalize across ContentDone + LeadScheduler):**

- `Person`, `Company`, `Relationship`  
- `Opportunity`, `PipelineStage`, `Lead`  
- `Mission`, `Task`, `Project`, `Approval`  
- `ContentItem`, `Campaign`, `Asset`, `Hook`, `CTA`, `PlatformVariant`  
- `Meeting`, `Note`, `Document`, `KnowledgeNode`, `MemoryEntry`  
- `Decision`, `MetricSnapshot`, `Notification`  
- `Integration`, `AgentRun`, `Automation`, `AuditLog`

Foreign keys, indexes on status/date/owner, and soft-delete as defaults.

### 5.6 Agent Kernel (centralized)

```
AgentKernel.run({
  intent, messages, tools?, policy?, providerPreference?
}) → AgentResult
```

Providers implement one interface:

```ts
interface LLMProvider {
  id: 'claude' | 'openai' | 'gemini' | 'openrouter' | string
  complete(req: CompletionRequest): Promise<CompletionResponse>
  embed?(req: EmbedRequest): Promise<EmbedResponse>
  health(): Promise<ProviderHealth>
}
```

UI talks only to Kernel. WITHIN constitution = default policy (approval gates for customer-facing / compliance / secrets).

### 5.7 Integration Registry states (non-negotiable)

Every integration is exactly one of:

| State | Meaning | UI |
|-------|---------|----|
| `connected` | Credentials verified by health probe | Green · usable |
| `disabled` | Intentionally off | Muted · not offered in flows |
| `awaiting_credentials` | Supported, not configured | Amber · CTA to Settings |

Never “maybe connected.” Never fake green on Substrate cards.

**Initial registry (from mission + ContentDone reality):**

Connected-capable first (already patterned in ContentDone): Calendly, n8n, Airtable, LinkedIn, Facebook, CRM webhook, local AI.  
Awaiting-credentials by default until probed: Google (Gmail/Calendar/Drive), Notion, ClickUp, GitHub, Supabase, OpenAI, Claude, Gemini, SendGrid, Apollo, ZoomInfo, HubSpot, Slack, Hermes Memory, HermesBrain, Sovereign Mind MCP, Cursor.  
Disabled until product need proven: anything unused.

### 5.8 Content Operating System (absorb ContentDone)

Treat ContentDone as the **Content Engine backend**, not a separate product UI. Command Center `/content` owns:

Idea Vault · Production Queue · Publishing Calendar · Performance Analytics · Repurposing · Campaigns · Asset Library · Templates · Video Tracking · Hook Library · CTA Library · Platform Variants · Daily Content Loop · Monthly Optimization · Performance Learning

Map existing JSON entities → normalized Content domain; keep compliance check + learning cycle as first-class services.

### 5.9 Security baseline (before private data)

- No secrets in Pages bundle  
- Credential vault only on API (or user-local encrypted store for personal keys)  
- Session auth (magic link / OAuth) before syncing private CRM  
- CSP, sanitized markdown, CSRF on mutating API, rate limits, audit log  
- Demo mode default for public Pages deploy

### 5.10 Deployment

1. **Source** in this repo under `apps/command-center` (or repo root `src/`).  
2. **Build** → static assets.  
3. **GitHub Action** publishes `dist/` to Pages (or root for current hosting style).  
4. **API** remains ContentDone → evolves to `command-api` service.  
5. Environment: `VITE_API_BASE_URL`, `VITE_DEMO_MODE`, feature flags — no private keys in `VITE_*`.

---

## 6. Dependency Graph

```
Brand Tokens / Design System
        │
        ▼
App Shell (router, layout, palette, search)
        │
        ├───────────────┬────────────────┬─────────────────┐
        ▼               ▼                ▼                 ▼
 Executive Brief   Domain Modules   Integration UI    Agent Workspace
        │               │                │                 │
        └───────┬───────┴────────┬───────┘                 │
                ▼                ▼                         ▼
         Domain Repositories   Integration Registry   Agent Kernel
                │                │                         │
                ├──── Local DB ──┤                         │
                ▼                ▼                         ▼
           Command API ◄──── Connectors / MCP ◄──── LLM Providers
                │
                ▼
           Postgres / Jobs / Webhooks / n8n
```

**Hard dependency order (build sequence):** Design system → Shell → Domain schemas → Local repos → Dashboard → CRM/Pipeline → Content OS → Agent Kernel → Integrations → Automations → Remote API sync → Hardening.

---

## 7. Execution Order

Model ownership is binding (see `docs/MODEL_WORKFLOW.md`).

### Wave 0 — Architecture lock (Grok 4.5) ← **THIS PHASE**

- [x] Repository intelligence  
- [x] Architecture audit  
- [ ] Acceptance of recommended topology by product owner  

### Wave 1 — Foundation (Claude implements · GPT reviews · Grok gates)

1. Vite/React/TS/Tailwind scaffold preserving brand tokens  
2. App shell + router + hidden-until-ready module registry  
3. Design system primitives (no card spam; density; dark-first)  
4. Local domain schemas + Dexie repositories + demo seed (badged)  
5. Command Palette + Global Search skeletons  

### Wave 2 — Attention OS

6. Executive Dashboard / Morning Brief (six questions)  
7. Notifications inbox  
8. Approval Queue (wire to local + future API)  
9. Health Monitor reflecting **real** integration states  

### Wave 3 — Revenue & relationships

10. CRM + Relationship Intelligence  
11. Pipeline + Opportunities + Lead Intelligence (port LeadScheduler stages)  
12. Tasks / Projects  
13. Calendar / Meetings / Notes  

### Wave 4 — Content OS

14. Port ContentDone domain into Content Engine modules  
15. Idea Vault → Queue → Calendar → Analytics loop  
16. Hook/CTA/Asset/Template libraries  
17. Compliance gate + learning insights surfaces  

### Wave 5 — Cognition

18. Knowledge / Memory / Documents / Decision Log  
19. Prompt Library + AI Workspace  
20. Agent Kernel + provider adapters (local stub first)  
21. Research module  

### Wave 6 — Leverage fabric

22. Automation Center + safe automations with approval gates  
23. Integration Registry UI + credential awaiting flows  
24. MCP connection panel (honest states)  
25. Analytics / Business Metrics / Financial KPIs  

### Wave 7 — Production hardening

26. Command API sync layer (ContentDone `/api` as v1 adapter)  
27. Auth gate for private mode  
28. Performance pass (Grok)  
29. Security review (GPT)  
30. Docs + readiness score + 90-day roadmap  

**Subsystem rule:** one subsystem per Claude implementation PR; GPT review; Grok architecture alignment before the next subsystem.

---

## 8. Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Boiling the ocean / unfinished stubs everywhere | High | Critical | Hide incomplete modules; ship Brief + CRM + Content first |
| Treating mock data as production truth | High | High | Mandatory `demo` badge + Demo Mode flag |
| Putting secrets in Pages | Medium | Critical | Registry states; API-only secrets |
| Rewriting ContentDone instead of adapting | Medium | High | Adapter pattern over `/api`; migrate store later |
| Provider-specific AI leaks into UI | Medium | High | Kernel interface enforced in review |
| Multi-repo drift | High | High | Shared schema package or OpenAPI contract |
| Scope includes MCP servers that do not exist | High | Medium | Mark `awaiting_credentials` / build only when leverage proven |
| GH Pages limits (no SSR, no private env) | Certain | Medium | Accept static UI; remote API for privileged work |
| Design regression to generic AI dashboard | Medium | High | Preserve gold/obsidian; forbid purple-glow tropes |
| Single-model thrash (architect+coder+reviewer) | High | High | Enforce MODEL_WORKFLOW roles |

---

## 9. Feature Completion Matrix (baseline)

| Module | Mock UI | Real UI | Data | API | Integrations | Status |
|--------|---------|---------|------|-----|--------------|--------|
| Executive Dashboard | Partial | No | Fake | No | No | 5% |
| Mission Control | Partial | No | Fake | No | No | 5% |
| Revenue Pipeline | No | No | No | No | No | 0% |
| CRM | No | No | CSV elsewhere | No | No | 0%* |
| Opportunity Tracker | No | No | No | No | No | 0% |
| Tasks / Projects | No | No | No | No | No | 0% |
| Knowledge / Memory | No | No | No | No | No | 0% |
| Daily Brief / Weekly Review | No | No | No | No | No | 0% |
| Content Engine | Label only | Elsewhere | ContentDone | ContentDone | Partial | 35%† |
| Calendar / Meetings | Pulse fake | No | No | No | No | 0% |
| Research | No | No | Trends API elsewhere | ContentDone | No | 10%† |
| AI Workspace / Prompts | No | No | Stub AI | Stub | Local only | 10%† |
| Automation Center | Nav only | No | Jobs in ContentDone | Partial | n8n | 15%† |
| MCP Connections | No | No | No | No | No | 0% |
| Notifications | No | No | No | No | No | 0% |
| Analytics | Fake KPIs | Elsewhere | ContentDone | Yes | Partial | 30%† |
| Settings / Health / Logs | Fake health | No | No | `/health` elsewhere | Partial | 10% |
| Command Palette / Search | Icons only | No | No | No | No | 0% |
| Documents / Notes | No | No | No | No | No | 0% |
| Business Metrics / KPIs | Fake | No | No | No | No | 0% |
| Lead Intelligence | Substrate chip | Elsewhere | ContentDone + CSV | Partial | Partial | 25%† |
| Idea Vault / Approvals | Approvals fake | Partial elsewhere | ContentDone | Partial | No | 20%† |
| Content Calendar | No | Elsewhere | ContentDone | Yes | Social | 40%† |
| Relationship Intelligence | No | No | No | No | No | 0% |
| Decision Log | No | No | No | No | No | 0% |

\*Doctrine exists in LeadScheduler. †Capability lives in ContentDone, not Command Center.

**Weighted platform completion today: ~8–12%.**  
**Production Readiness Score today: 12 / 100** (visual brand 8 + PWA 2 + ecosystem kernel 2).

---

## 10. What “Done” Means for Convergence

The platform is the business OS when:

1. Morning Brief answers the six questions from **real stores** (or clearly badged demo).  
2. Every nav item either works or is hidden.  
3. Every integration is Connected, Disabled, or Awaiting Credentials.  
4. All AI flows through one Kernel.  
5. ContentDone is reachable as Content/Lead substrate without a second product UI.  
6. Command Palette can reach tasks, people, companies, content, prompts, settings, agents.  
7. Build, lint, types, and critical tests pass.  
8. Docs listed in Phase 17 exist and match the running system.

---

## 11. Immediate Non-Goals (protect leverage)

- Do not rebuild ContentDone from scratch in this wave.  
- Do not implement every MCP server before the shell and Brief exist.  
- Do not put Next.js on GitHub Pages unless SSR is actually required (it is not).  
- Do not invent multi-tenant SaaS before single-operator excellence.  
- Do not keep fake Sentinel green for TruOak when tokens are expired — surface truth.

---

## 12. Architect’s Directive to Implementation

Claude may begin **Wave 1 only** after this audit is accepted.  
GPT reviews Wave 1 for security/correctness.  
Grok re-gates architecture alignment before Wave 2.

The smallest change that unlocks the largest leverage: **replace the poster with a real shell + domain store + Morning Brief**, then absorb ContentDone behind an adapter — refinement over replacement.
