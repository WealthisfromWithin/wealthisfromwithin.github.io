# Sovereign Mind Command Center

HermesBrain Sovereign Mission Command — the operating system for the business.

## Status

**Wave 1 — Foundation shell: complete** (G2 approve-with-changes, G3 pass, fix
pack applied). **Wave 2 — Attention OS: complete, awaiting review.** The surface
can now be acted on: approvals are granted or refused, signals are marked read,
and both persist in the local store. Health is projected from the Integration
Registry and still reports the truth — no probe has run.

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
| `/integrations` | Integration Registry | 27 connectors: Connected, Disabled, or Awaiting Credentials |
| `/settings` | Settings | Local store controls, credential reality, kernel status, roadmap |

`⌘K` / `Ctrl+K` opens the command palette. `/` opens global search.

Fourteen further modules are registered but have no route and never appear in
navigation. See `docs/waves/WAVE_2.md`.

## Start here

1. [`ARCHITECTURE_AUDIT.md`](./ARCHITECTURE_AUDIT.md) — repository intelligence & recommended architecture
2. [`docs/MODEL_WORKFLOW.md`](./docs/MODEL_WORKFLOW.md) — Grok / Claude / GPT ownership rules
3. [`docs/IMPLEMENTATION_PLAN.md`](./docs/IMPLEMENTATION_PLAN.md) — Wave 1 brief
4. [`docs/IMPLEMENTATION_PLAN_WAVE_2.md`](./docs/IMPLEMENTATION_PLAN_WAVE_2.md) — Wave 2 brief
5. [`docs/waves/WAVE_1.md`](./docs/waves/WAVE_1.md) — what Wave 1 delivered, deferred, and deviated on
6. [`docs/waves/WAVE_2.md`](./docs/waves/WAVE_2.md) — what Wave 2 delivered, deferred, and deviated on
7. [`docs/reports/`](./docs/reports/) — debt, integrations, security, performance, matrix, roadmap

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
