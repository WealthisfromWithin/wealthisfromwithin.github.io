# Sovereign Mind Command Center

HermesBrain Sovereign Mission Command — the operating system for the business.

## Status

**Waves 1–4** are complete and gated: the foundation shell, the Attention OS,
Revenue & Relationships, and the Content Operating System. **Wave 5 —
Cognition: complete, awaiting review.** Knowledge, Memory, Documents,
Decisions, Research, Prompts, and the AI Workspace are routed, and every model
call goes through the Agent Kernel. Four hosted provider adapters report
Awaiting Credentials and refuse; the local adapter runs only when the operator
points `VITE_LOCAL_AI_URL` at a runtime on their own machine. Nothing publishes
and nothing generates from this bundle, and the surfaces say so rather than
implying otherwise. Health is still projected from the Integration Registry; no
probe has run.

## Run it

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm lint
pnpm typecheck
pnpm test
pnpm build      # dist/ plus the dist/404.html SPA fallback
pnpm preview
```

Requires Node 22+ and pnpm 10+.

## What ships today

| Route | Module | Notes |
|-------|--------|-------|
| `/` | Morning Brief | Six questions from the local IndexedDB store, demo rows badged |
| `/approvals` | Approval Queue | Human gates; approve, reject, and reopen persist in IndexedDB |
| `/health` | Health Monitor | Registry-derived substrate truth plus the recorded activity log |
| `/inbox` | Inbox | Every signal, filtered by read state and severity; read state is written through |
| `/crm` | CRM | People and companies, with person and company detail routes |
| `/pipeline` | Pipeline | Opportunities by stage with an opportunity detail route |
| `/tasks` | Tasks | Execution across projects; status, priority, and creation persist |
| `/projects` | Projects | Progress counted from linked tasks |
| `/calendar` | Calendar | One week of meetings and due work |
| `/meetings` | Meetings | Meeting records with an inline notes editor |
| `/content` | Content OS | Production queue, plus `ideas`, `calendar`, `campaigns`, `library`, `analytics`, and `item/:id` |
| `/decisions` | Decision Log | Calls with their rationale and a transition table, plus `entry/:id` |
| `/knowledge` | Knowledge | Notes, insights, playbooks, and questions with local joins, plus `node/:id` |
| `/memory` | Memory | Durable facts, preferences, and constraints with review dates and provenance |
| `/documents` | Documents | Local documents rendered as text blocks, plus `doc/:id`. No upload, no hosting |
| `/research` | Research | Open questions and findings recorded by hand. No crawler, no search connector |
| `/ai` | AI Workspace | Sessions through the Agent Kernel. Refusals are recorded as refusals |
| `/prompts` | Prompt Library | Reusable instructions, browsable and editable with no provider configured |
| `/integrations` | Integration Registry | 27 connectors: Connected, Disabled, or Awaiting Credentials |
| `/settings` | Settings | Local store controls, credential reality, kernel status, roadmap |

`⌘K` / `Ctrl+K` opens the command palette. `/` opens global search.

Five further modules are registered but have no route and never appear in
navigation. See `docs/waves/WAVE_5.md`.

### Optional local model

```bash
VITE_LOCAL_AI_URL=http://localhost:11434   # an Ollama-shaped runtime
VITE_LOCAL_AI_MODEL=llama3.1               # optional
```

This is the only provider that can run from this bundle, because it is the only
one that needs no secret. No API key is ever read from the environment: a key in
`import.meta.env` is a key in the published bundle.

The URL must be loopback — `localhost`, `127.0.0.1`, or `[::1]`. Anything else is
refused before a request is made, and the adapter reports that no local runtime
is available. It advertises itself to the kernel as a call that never leaves the
machine, so it only calls hosts where that is true.

## Start here

1. [`ARCHITECTURE_AUDIT.md`](./ARCHITECTURE_AUDIT.md) — repository intelligence & recommended architecture
2. [`docs/MODEL_WORKFLOW.md`](./docs/MODEL_WORKFLOW.md) — Grok / Claude / GPT ownership rules
3. [`docs/IMPLEMENTATION_PLAN.md`](./docs/IMPLEMENTATION_PLAN.md) — Wave 1 brief
   (Waves 2–5 have their own `IMPLEMENTATION_PLAN_WAVE_*.md`)
4. [`docs/waves/`](./docs/waves/) — what each wave delivered, deferred, and deviated on
5. [`docs/reviews/`](./docs/reviews/) — G2 reviews and G3 alignment gates
6. [`docs/reports/`](./docs/reports/) — debt, integrations, security, performance, matrix, roadmap

## Layout

```
src/app/          shell, router, module registry, providers
src/modules/      one folder per product module
src/domain/       zod entities and policies
src/data/         Dexie database, repositories, mutations, demo seed
src/integrations/ registry catalog and state model
src/search/       fuzzy matcher and global index
src/commands/     command palette registry
src/agents/       Agent Kernel; adapters live only in src/agents/providers
src/ui/           brand tokens and primitives
legacy/           archived static prototype, not built
```

## Deployment

GitHub Pages, published from `dist/` by `.github/workflows/deploy.yml`. The
repository's Pages source must be set to **GitHub Actions**. Build output is not
committed — the compiled artifact is no longer the source of truth.

## Rules

Incomplete features are hidden, not stubbed. Integrations are Connected,
Disabled, or Awaiting Credentials — never a hopeful green. Demo data is badged.
All AI goes through one kernel. Secrets never enter this bundle.
