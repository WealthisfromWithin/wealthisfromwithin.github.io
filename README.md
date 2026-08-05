# Sovereign Mind Command Center

HermesBrain Sovereign Mission Command — the operating system for the business.

## Status

**Wave 1 — Foundation shell: complete.** The static poster has been replaced by a
Vite + React + TypeScript command surface with a local domain store, module
registry, command palette, and a Morning Brief that answers the six questions.
Awaiting GPT-5.5 review (G2) and the Grok architecture gate (G3) before Wave 2.

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
| `/integrations` | Integration Registry | 27 connectors: Connected, Disabled, or Awaiting Credentials |
| `/settings` | Settings | Local store controls, credential reality, kernel status, roadmap |

`⌘K` / `Ctrl+K` opens the command palette. `/` opens global search.

Seventeen further modules are registered but have no route and never appear in
navigation. See `docs/waves/WAVE_1.md`.

## Start here

1. [`ARCHITECTURE_AUDIT.md`](./ARCHITECTURE_AUDIT.md) — repository intelligence & recommended architecture
2. [`docs/MODEL_WORKFLOW.md`](./docs/MODEL_WORKFLOW.md) — Grok / Claude / GPT ownership rules
3. [`docs/IMPLEMENTATION_PLAN.md`](./docs/IMPLEMENTATION_PLAN.md) — Wave 1 brief
4. [`docs/waves/WAVE_1.md`](./docs/waves/WAVE_1.md) — what Wave 1 delivered, deferred, and deviated on
5. [`docs/reports/`](./docs/reports/) — debt, integrations, security, performance, matrix, roadmap

## Layout

```
src/app/          shell, router, module registry, providers
src/modules/      one folder per product module
src/domain/       zod entities and policies
src/data/         Dexie database, repositories, demo seed
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
