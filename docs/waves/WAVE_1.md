# Wave 1 — Foundation (Command Surface)

**Implementer:** Claude (Implementation Engineer)
**Plan:** `docs/IMPLEMENTATION_PLAN.md`
**Architecture:** `ARCHITECTURE_AUDIT.md` §5
**Status:** complete, awaiting G2 (GPT-5.5 review) and G3 (Grok architecture gate)

---

## What changed

The GitHub Pages property is no longer a 303 KB static poster. It is a Vite +
React + TypeScript + Tailwind single-page application with a local domain store,
a module registry, a command palette, and a Morning Brief that answers the six
questions from real local data.

The old prototype is preserved at `legacy/poster.html` for visual reference and
is not part of the build.

## Source tree

```
/
├── index.html                     # Vite entry (replaces the poster)
├── vite.config.ts                 # base '/', React, Tailwind, vitest
├── tsconfig.{json,app,node}.json  # strict, noUncheckedIndexedAccess
├── eslint.config.js               # type-aware flat config
├── scripts/postbuild.mjs          # writes dist/404.html SPA fallback
├── legacy/poster.html             # archived prototype
├── public/                        # manifest, sw.js (sovereign-v2), icons, .nojekyll
├── .github/workflows/             # ci.yml (branches/PRs), deploy.yml (Pages)
└── src/
    ├── main.tsx
    ├── app/
    │   ├── App.tsx, router.tsx, providers.tsx, context.ts
    │   ├── modules.ts             # module registry (enabled vs planned)
    │   └── shell/                 # AppShell, Sidebar, Topbar, CommandPalette
    ├── modules/
    │   ├── dashboard/             # brief.ts selectors + MorningBriefPage
    │   ├── integrations/          # IntegrationsPage
    │   └── settings/              # SettingsPage
    ├── domain/                    # zod schemas: common.ts, entities.ts
    ├── data/                      # db.ts (Dexie), repositories.ts, seed.ts, dataset.ts
    ├── integrations/              # catalog.ts (inventory), state.ts (state model)
    ├── search/                    # fuzzy.ts, index.ts
    ├── commands/                  # registry.ts (palette commands)
    ├── agents/                    # kernel.ts (interface + honest stub)
    ├── ui/                        # theme.css (brand tokens), primitives.tsx
    └── lib/                       # clock.ts, format.ts, cn.ts, pwa.ts
```

## Enabled vs hidden

| Module | Route | State |
|--------|-------|-------|
| Morning Brief (Commander) | `/` | enabled |
| Integrations (Operator) | `/integrations` | enabled |
| Settings (Operator) | `/settings` | enabled |

Seventeen modules are registered as `planned` (missions, approvals, health,
inbox, crm, pipeline, tasks, calendar, content, knowledge, research, ai,
decisions, automations, metrics, analytics, sync). They have **no route** and
**never appear in navigation**. `src/app/modules.test.ts` enforces this: the
router children must be exactly the enabled modules plus a catch-all that
redirects to the brief. The roadmap is legible in Settings without pretending
the software exists.

## Brand tokens

All tokens live in one place, `src/ui/theme.css`, as a Tailwind `@theme` layer.

| Token | Value |
|-------|-------|
| `--color-obsidian` | `#16130b` |
| `--color-surface` / `-high` / `-highest` | `rgb(35 31 23)` / `rgb(46 42 33)` / `rgb(57 52 43)` |
| `--color-gold` | `rgb(201 162 39)` (`#c9a227`) |
| `--color-ivory` / `--color-on-surface` | `rgb(245 241 232)` / `rgb(234 225 212)` |
| `--color-sentinel` | `#2a9d8f` |
| `--color-alert` | `rgb(230 57 70)` |
| `--font-display` | Libre Caslon Text |
| `--font-mono` | JetBrains Mono |
| `--font-sans` | DM Sans |

Inter is gone. DM Sans is the intentional UI sans; Caslon carries display and
JetBrains Mono carries all numeric and machine data. Fonts are self-hosted via
`@fontsource`, so the PWA has no CDN dependency and works offline.

Design posture: dark-first, dense, quiet, keyboard-first. Rules and type
hierarchy carry structure instead of nested cards; a `Panel` is used only where
an interactive group needs a container (Settings). No purple glow, no gradient
hero, no card spam.

## Data layer

- `src/domain/entities.ts` — zod schemas for Person, Company, Task, Mission,
  Approval, Opportunity, ContentItem, Notification, ActivityEvent,
  LeverageMetric, Integration. Every record carries
  `source: 'demo' | 'local' | 'remote'` plus `createdAt` / `updatedAt`.
- `src/data/db.ts` — Dexie (IndexedDB) database `sovereign-command`, version 1,
  indexed on the fields the brief and registry actually query.
- `src/data/seed.ts` — versioned demo dataset built relative to `now`, so the
  brief stays legible whenever the surface is opened. `SEED_VERSION` bumps force
  a reseed; the seed also refreshes when older than 12 hours.
- `src/data/repositories.ts` — `readDataset`, `ensureSeeded`, `seedDemoData`,
  `clearDemoData`, `resetLocalStore`. Reseeding only deletes rows the seeder
  owns.

Demo provenance is visible, not implied: the topbar shows a `DEMO` badge with a
live row count, every seeded row in the brief and palette carries its own badge,
and Settings can refresh, remove, or reset demo data.

Integration rows are seeded as `source: 'local'`, not `demo`, because their
states are literally true rather than fabricated. Badging them `DEMO` would
imply the states themselves are made up.

## Morning Brief — the six questions

`src/modules/dashboard/brief.ts` is a pure function over the dataset, so it is
unit-tested and can be repointed at a remote read-model without touching the UI.

| # | Question | Source |
|---|----------|--------|
| 1 | What needs attention? | Unread non-info notifications, non-info approvals, overdue tasks, and the derived integration credential gap |
| 2 | What opportunities exist? | Open opportunities ranked by value × probability |
| 3 | What should I do today? | Tasks in progress or due before midnight, by priority |
| 4 | What changed overnight? | Activity events in the last 24 hours |
| 5 | What is blocked? | Blocked tasks, missions, and content — each with its recorded reason |
| 6 | What is producing leverage? | Leverage metrics ordered by absolute change |

Empty sections render an explicit empty message. The brief never fabricates a
row to fill space.

## Integration Registry

`src/integrations/catalog.ts` transcribes the inventory from
`docs/reports/INTEGRATION_REPORT.md`: 27 connectors, 20 Awaiting Credentials, 7
Disabled, **0 Connected**. Nothing can be Connected in Wave 1 because no health
probe exists on this surface, and a test asserts the catalog ships no
`connected` entry.

Substrate health is derived from registry truth by
`deriveSubstrateHealth`, which reports `offline` when nothing is verified. The
sidebar and brief both say "No substrate connection is verified. 5 awaiting
credentials." There is no cosplay Sentinel green anywhere in the build.

## Palette, search, kernel

- `⌘K` / `Ctrl+K` opens the command palette; `/` opens the same surface in
  search mode. Both are shell-level, not modules.
- Commands cover navigation to enabled modules only, plus local-store actions
  (refresh demo data, reset store) and a jump to the credential gap.
- `src/search/fuzzy.ts` is a subsequence scorer with word-start and run bonuses,
  a per-break penalty, and a score floor that keeps technically-true but useless
  matches out of the palette.
- `src/search/index.ts` flattens the store into one index across people,
  companies, tasks, missions, opportunities, content, integrations, and signals.
  A test asserts no document routes at an unbuilt module.
- `src/agents/kernel.ts` defines the `AgentKernel` / `LLMProvider` interface and
  ships a stub that returns `{ ok: false, reason: 'no_provider' }`. ESLint blocks
  direct imports of provider SDKs from the UI.

## Deployment

- `vite base: '/'` — this is the user site root, and absolute asset URLs are
  required for deep links such as `/integrations` to resolve.
- `pnpm build` emits `dist/`, then `scripts/postbuild.mjs` copies
  `dist/index.html` to `dist/404.html` (the GitHub Pages SPA fallback) and
  ensures `.nojekyll`.
- `.github/workflows/deploy.yml` builds on `main` and publishes `dist/` with
  `actions/deploy-pages`. **Action required by the repository owner:** set Pages
  → Build and deployment → Source to **GitHub Actions**. Until then the site
  continues serving whatever is on the Pages branch. Build artifacts are
  deliberately not committed, which is the whole point of retiring TD-01.
- PWA preserved: `public/manifest.webmanifest` (root scope) and `public/sw.js`
  with cache `sovereign-v2`. The worker now resolves navigations to the app
  shell so deep links work offline, and it ignores cross-origin requests.

## Verification

| Command | Result |
|---------|--------|
| `pnpm install` | clean |
| `pnpm lint` | 0 errors, 0 warnings |
| `pnpm typecheck` | clean |
| `pnpm test` | 38 tests, 5 files, passing |
| `pnpm build` | success (one chunk-size advisory, see debt) |
| `pnpm preview` | serves `/`, `/integrations`, `/settings`, `sw.js`, `manifest.webmanifest` |

Headless Chrome smoke run against the preview build confirmed: six question
headings present, nav shows exactly three modules, 26 demo badges on the brief,
`Ctrl+K` opens the palette, `/` opens global search, an exact record outranks
command noise, 27 integration rows in only Disabled / Awaiting Credentials
states, `/missions` redirects to the brief, and **zero console errors or
warnings**.

## Deferrals (intentional, per plan)

1. Remote API sync and the ContentDone adapter — Wave 7.
2. OAuth, auth gate, credential vault — needs an API; nothing can be stored in a
   Pages bundle.
3. Health probes. Without them, honesty requires `offline`, which is what ships.
4. Live model calls. The kernel interface exists; every provider is Awaiting
   Credentials and the stub refuses.
5. Content OS port, CRM, pipeline, tasks, calendar, knowledge, automations,
   analytics — Waves 3–6, registered as `planned` with no route.
6. MCP servers — registry entries only, per `INTEGRATION_REPORT.md`.
7. Notification read/write mutations. Wave 1 repositories are read-plus-seed;
   mutation flows land with the Inbox and Approval Queue in Wave 2.

## New debt introduced

| ID | Debt | Severity | Note |
|----|------|----------|------|
| TD-16 | Single JS chunk ~508 KB raw / ~158 KB gzip | Low | React + router + Dexie + zod in one chunk. Route-level code splitting becomes worthwhile once Waves 3–4 add real modules. |
| TD-17 | Demo seed refreshes on a 12-hour timer | Low | Keeps the brief legible, but means "overnight" is relative to the seed, not to lived history. Disappears when the API supplies real events. |
| TD-18 | Pages source must be switched to GitHub Actions by the owner | Medium | Deploy workflow is inert until then. |
| TD-19 | Repositories are read-plus-seed only | Medium | No mutation path yet, so the brief cannot be acted on from the surface. Lands with the Inbox and Approval Queue in Wave 2. |

## Deviations from the brief

1. **`vite base: '/'` rather than `'./'`.** Relative asset URLs break on a deep
   link like `/integrations`, where the browser would resolve `./assets/...`
   against `/integrations/`. This is a user site served at the domain root, so
   `'/'` is both correct and necessary for the 404.html SPA strategy.
2. **Build output is not committed.** The brief asked for a deployable
   production build; a GitHub Actions Pages deployment delivers that without
   reintroducing "compiled artifact as source" (TD-01/TD-02). The owner action
   above is the cost of that choice.
3. **Integration rows are `source: 'local'`, not `'demo'`.** Their states are
   true. Badging them as demo would misrepresent honest data as fabricated.
4. **No stub modules for palette demos.** The brief allowed minimal stubs; none
   were needed, so none exist. Three real modules give the palette enough to do.
5. **`titleCase` helper removed.** It rendered `crm` as "Crm" and `ai` as "Ai".
   An explicit category label map replaced it.
