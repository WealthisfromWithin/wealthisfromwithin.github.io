# Sovereign Mind Command Center

HermesBrain Sovereign Mission Command — the operating system for the business.

## Status

**Waves 1–6** are complete and gated: the foundation shell, the Attention OS,
Revenue & Relationships, the Content Operating System, Cognition, and the
Leverage Fabric. **Wave 7 — Production Hardening: complete, awaiting review.**

All 25 registered modules are now routed — nothing is hidden for the first time.
Command API Sync ships as an honest adapter: it makes no network request at all
unless a build was configured with `VITE_API_BASE_URL`, and when one was, it can
do exactly one thing — ask whether that origin's `/health` answers, and record
the answer with the time it was asked. It moves no record in either direction,
and there is no code path in it that could report a sync that did not happen.

`Connected` is now enforced rather than described. It requires the timestamp of
the probe that verified it: the only writer that can set the state refuses a
result without one, and every surface downgrades an unevidenced claim to
Awaiting Credentials. A Content Security Policy ships on the built index, and
the first load fell under 200 kB gzip for the first time.

Everything the platform cannot do it still says so about. Nothing publishes,
nothing generates, no connector is genuinely connected, and there is no account
— because a static bundle cannot hold a secret, and a sign-in with nothing
behind it would be the dishonest way to hide that.

**Production readiness: 78 / 100.** See
[`docs/reports/PRODUCTION_READINESS.md`](./docs/reports/PRODUCTION_READINESS.md).

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
| `/missions` | Mission Control | Objectives with declared and counted progress side by side, plus `mission/:id` |
| `/automations` | Automations | Local rules with approval gates and a run log, plus `rule/:id`. No scheduler, no publishing |
| `/metrics` | Business Metrics | KPIs counted from the local domain, each with its basis and sample size |
| `/analytics` | Analytics | Activity, throughput, and provenance of the local store. Nothing observes the operator |
| `/decisions` | Decision Log | Calls with their rationale and a transition table, plus `entry/:id` |
| `/knowledge` | Knowledge | Notes, insights, playbooks, and questions with local joins, plus `node/:id` |
| `/memory` | Memory | Durable facts, preferences, and constraints with review dates and provenance |
| `/documents` | Documents | Local documents rendered as text blocks, plus `doc/:id`. No upload, no hosting |
| `/research` | Research | Open questions and findings recorded by hand. No crawler, no search connector |
| `/ai` | AI Workspace | Sessions through the Agent Kernel. Refusals are recorded as refusals |
| `/prompts` | Prompt Library | Reusable instructions, browsable and editable with no provider configured |
| `/integrations` | Integration Registry | 29 connectors: Connected, Disabled, or Awaiting Credentials, plus `mcp` |
| `/sync` | Command API Sync | The adapter's state and the one probe it can run. No read-model, no write-through, no session |
| `/settings` | Settings | Which mode this build is in, local store controls, credential reality, kernel status |

`⌘K` / `Ctrl+K` opens the command palette. `/` opens global search.

Every registered module is routed. Nothing is hidden, and nothing shows a
"coming soon" page — a module either works or is not in the registry.

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

### Optional Command API probe

```bash
VITE_API_BASE_URL=https://api.example.com   # an origin serving GET /health
```

This enables one manual button on `/sync` that sends one credential-free GET to
`/health`. It does not enable sync, does not authenticate anything, and causes
no request to be made on load. The URL must be `https:` (loopback `http:` is
allowed) and must carry no userinfo, query string, or fragment — each of those
is a way a credential reaches a public bundle, and all are refused before
anything is sent.

## Start here

1. [`docs/SYSTEM_ARCHITECTURE.md`](./docs/SYSTEM_ARCHITECTURE.md) — how the running system is built
2. [`docs/DEVELOPER_GUIDE.md`](./docs/DEVELOPER_GUIDE.md) — setup, the writer contract, the honesty rules
3. [`docs/DATABASE.md`](./docs/DATABASE.md) · [`docs/API.md`](./docs/API.md) · [`docs/MCP.md`](./docs/MCP.md) — the data model and the two boundaries
4. [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) · [`docs/OPERATIONS.md`](./docs/OPERATIONS.md) — shipping it and answering for it
5. [`ARCHITECTURE_AUDIT.md`](./ARCHITECTURE_AUDIT.md) — the Wave 0 audit that set the rules
6. [`docs/MODEL_WORKFLOW.md`](./docs/MODEL_WORKFLOW.md) — Grok / Claude / GPT ownership rules
7. [`docs/waves/`](./docs/waves/) — what each wave delivered, deferred, and deviated on
8. [`docs/reviews/`](./docs/reviews/) — G2 reviews and G3 alignment gates
9. [`docs/reports/`](./docs/reports/) — readiness, debt, integrations, security, performance, matrix, roadmap

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

A Content Security Policy is injected into the built `index.html` at build time
(Pages cannot set response headers, so a meta tag is the only delivery). Full
detail, including what a meta tag cannot carry, in
[`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md).

## Rules

Incomplete features are hidden, not stubbed. Integrations are Connected,
Disabled, or Awaiting Credentials — never a hopeful green, and Connected
requires the timestamp of the probe that verified it. Demo data is badged. Every
number is counted from a stored field, with its basis and sample size. All AI
goes through one kernel. Secrets never enter this bundle.
