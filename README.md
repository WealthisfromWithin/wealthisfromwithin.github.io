# Sovereign Mind Command Center

HermesBrain Sovereign Mission Command — the operating system for the business.

## Status

**Wave 1 — Foundation shell** and **Wave 2 — Attention OS** are complete and
gated. **Wave 3 — Revenue & Relationships** shipped CRM, Pipeline, Tasks,
Projects, Calendar, and Meetings with three record detail routes. **Wave 4 —
Content Operating System: complete, awaiting review.** `/content` is a
production loop: capture, draft, gate, schedule, record, learn. Nothing
publishes from this bundle — no connector here holds a credential, and the
surface says so rather than implying otherwise. Health is still projected from
the Integration Registry; no probe has run.

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
| `/integrations` | Integration Registry | 27 connectors: Connected, Disabled, or Awaiting Credentials |
| `/settings` | Settings | Local store controls, credential reality, kernel status, roadmap |

`⌘K` / `Ctrl+K` opens the command palette. `/` opens global search.

Nine further modules are registered but have no route and never appear in
navigation. See `docs/waves/WAVE_4.md`.

## Start here

1. [`ARCHITECTURE_AUDIT.md`](./ARCHITECTURE_AUDIT.md) — repository intelligence & recommended architecture
2. [`docs/MODEL_WORKFLOW.md`](./docs/MODEL_WORKFLOW.md) — Grok / Claude / GPT ownership rules
3. [`docs/IMPLEMENTATION_PLAN.md`](./docs/IMPLEMENTATION_PLAN.md) — Wave 1 brief
   (Waves 2–4 have their own `IMPLEMENTATION_PLAN_WAVE_*.md`)
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
src/agents/       Agent Kernel interface (stub provider only)
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
