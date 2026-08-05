# Wave 1 GPT-5.5 Review

## Verdict: APPROVE WITH CHANGES

## Summary (5-8 sentences)

Wave 1 replaces the static poster with a real Vite/React/TypeScript command surface that is well aligned to the approved architecture and the Wave 1 implementation plan. The implementation stays inside foundation scope: only Morning Brief, Integrations, and Settings are routed, while later-wave modules remain hidden from navigation and are exposed only as a roadmap in Settings. Security posture is appropriate for a public static demo surface: I found no unsafe HTML rendering, no browser token storage, no provider SDK calls from UI code, and no private keys in `VITE_*` variables. Integration status is honest in the shipped catalog: there are zero Connected connectors, the UI uses only Connected/Disabled/Awaiting Credentials, and no fake Healthy state is presented from unprobed systems. Morning Brief is implemented as pure selectors over the local store and answers all six required questions, with seeded records badged as Demo and empty states rendered honestly. Lint, typecheck, tests, and build all pass locally; the only build warning is the documented 508.49 KB raw / 158.41 KB gzip single JS chunk, which is fair to keep as low debt for Wave 1. I recommend approval for the Wave 1 gate with the non-blocking changes below queued before Wave 2 expands the data and interaction surface.

## Findings

### Critical

None.

### High

None.

### Medium

#### M1 - "Remove demo rows" is not durable across reload

- **File refs:** `src/modules/settings/SettingsPage.tsx:65-74`, `src/data/repositories.ts:141-154`, `src/data/useDataset.ts:17-29`
- **Issue:** The Settings action says "Remove demo rows" and `clearDemoData` deletes demo rows plus seed metadata, but the next app mount calls `ensureSeeded()`, sees missing seed metadata, and reseeds demo data automatically. That makes removal a temporary in-session state rather than an operator preference, which is surprising for the Settings control and weakens demo provenance controls.
- **Recommended fix:** Add an explicit demo-mode/seed opt-out metadata value, or rename the action to make its temporary behavior clear. If durable removal is intended, `ensureSeeded` should respect the opt-out until the operator chooses "Refresh demo data" or "Reset store."
- **Blocking:** No, but should be fixed before Wave 2 adds more operator-facing store controls.

#### M2 - Service worker does not reliably cache built JS/CSS for offline reloads

- **File refs:** `public/sw.js:1-60`, `scripts/postbuild.mjs:11-18`, `vite.config.ts:16-19`
- **Issue:** The worker precaches `/`, `/index.html`, the manifest, and icons, but not Vite's hashed JS/CSS/font assets. On a fresh production visit, those assets load before the service worker controls the page, so an offline reload can receive the cached app shell but fail to load the hashed bundle unless the browser HTTP cache happens to have it.
- **Recommended fix:** Generate a small asset manifest during postbuild and inject/cache `dist/assets/*` in the service worker, or adopt a minimal Workbox/Vite PWA strategy. Add an offline reload smoke test for `/`, `/integrations`, and `/settings`.
- **Blocking:** No for online GitHub Pages correctness; yes before claiming robust PWA offline support.

#### M3 - Production source maps and CSP hardening need an explicit decision before private data

- **File refs:** `vite.config.ts:16-19`, `index.html:3-35`, `docs/reports/SECURITY_REPORT.md:23-34`
- **Issue:** Production builds emit source maps and the app does not define a Content Security Policy. The source is public, so source maps are not a secret leak today, and React escaping keeps current XSS risk low. However, this should be deliberate before remote data, markdown, credentials UI, or auth enter the product.
- **Recommended fix:** Disable production source maps unless they are needed for a public debugging workflow, and add a CSP appropriate for a static Pages SPA (`default-src 'self'`, constrained script/style/font/img/connect directives). Revisit the policy when Command API sync is introduced.
- **Blocking:** No for Wave 1 public demo mode; blocking before private data or remote content.

### Low / Nits

#### L1 - Provider SDK import guard is narrower than the architecture rule

- **File refs:** `eslint.config.js:35-49`, `src/agents/kernel.ts:1-74`
- **Issue:** ESLint blocks `openai` and `@anthropic-ai/sdk`, and current source does not import provider SDKs. The architecture rule is broader: UI should not import any provider SDK directly, including Gemini/OpenRouter/AI SDK variants that are not currently restricted.
- **Recommended fix:** Expand `no-restricted-imports` with patterns for likely provider packages, or enforce a folder boundary rule that only `src/agents` may depend on provider adapters when they exist.
- **Blocking:** No.

#### L2 - Command palette works, but accessibility/test coverage is still skeleton-level

- **File refs:** `src/app/shell/AppShell.tsx:18-40`, `src/app/shell/CommandPalette.tsx:114-214`, `src/search/fuzzy.test.ts:44-73`
- **Issue:** Keyboard shortcuts, arrows, Enter, and Escape are implemented, but there is no focus trap, no focus restoration to the opener, and no `aria-activedescendant`/option semantics for the active row. Tests cover fuzzy ranking and route safety, not the rendered palette interaction.
- **Recommended fix:** Add component or Playwright tests for `Ctrl+K`, `/`, arrows, Enter, Escape, click-outside close, and route execution. Consider dialog/listbox semantics or a small accessible command palette primitive before palette usage expands.
- **Blocking:** No for Wave 1 skeleton; should be improved as command density grows.

#### L3 - Future Connected states should require probe evidence, not just enum value

- **File refs:** `src/integrations/state.ts:59-112`, `src/integrations/catalog.ts:18-241`, `src/integrations/state.test.ts:93-105`
- **Issue:** The current catalog has zero Connected entries and the test enforces that, so Wave 1 is honest. The generic helper will report degraded/operational if a row is marked `connected`, without checking `lastProbedAt` or probe freshness.
- **Recommended fix:** When real probes land, make `connected` rows carry verified probe metadata and have `deriveSubstrateHealth` require that metadata/freshness before counting them as usable.
- **Blocking:** No.

#### L4 - Brief time is fixed for the page lifetime

- **File refs:** `src/modules/dashboard/MorningBriefPage.tsx:86-90`, `src/data/repositories.ts:8-9`, `src/data/seed.ts:20-27`
- **Issue:** `MorningBriefPage` captures `now` once. If the app remains open across midnight or the operator refreshes demo data after a long session, due-today and overnight selectors can be calculated against a stale page-load time.
- **Recommended fix:** Recompute the brief on a slow clock tick, or centralize the clock in context so seed refresh and brief generation share the same current time.
- **Blocking:** No.

#### L5 - Data-provided links should be normalized to enabled internal routes

- **File refs:** `src/modules/dashboard/brief.ts:51-64`, `src/modules/dashboard/MorningBriefPage.tsx:42-50`, `src/search/index.ts:131-140`
- **Issue:** Current seed notification links are safe, and planned-module routes are not generally exposed. The domain still allows arbitrary notification `href` strings, and Brief/Search will navigate to those values if future local/remote rows provide them.
- **Recommended fix:** Add a route allowlist helper that maps unknown, external, or unbuilt-module hrefs back to `/` or `/integrations`.
- **Blocking:** No.

## Security posture

- No secrets were found in the source, and `.gitignore` excludes `.env`/`.env.*` while allowing `.env.example`.
- No `dangerouslySetInnerHTML`, `innerHTML`, `eval`, token-bearing `localStorage`/`sessionStorage`, or direct model-provider imports were found in `src/`.
- `import.meta.env` is used only for `DEV` service-worker registration gating; no private `VITE_*` key/token/secret pattern was found.
- Integration credentials are consistently described as belonging to a future Command API, not to the Pages bundle.
- The archived `legacy/poster.html` still contains the old fake `href="#"` and Healthy strings, but it is ignored by ESLint and not part of the Vite build; keeping it as reference is acceptable.
- Remaining security work before private data: CSP, source-map decision, auth/session design, sanitized markdown/content rendering, API-side secret vault, audit log, CSRF/rate-limit posture.

## Architecture alignment

- Strong alignment with `ARCHITECTURE_AUDIT.md` section 5 and Wave 1 scope.
- The app shape follows the recommended `src/app`, `modules`, `domain`, `data`, `agents`, `integrations`, `search`, `commands`, `ui`, and `lib` boundaries.
- No Wave 2+ feature implementation leaks into routed UI. Later modules are registered as `planned`, omitted from nav, omitted from router children, and listed only as roadmap context in Settings.
- Morning Brief is a selector over the local store and answers the six architecture questions directly.
- Agent Kernel exists as a UI boundary and refuses honestly with `no_provider`; UI does not call providers.
- Integration Registry has exactly the legal states and no shipped Connected connector.
- GitHub Pages base path and SPA fallback strategy are correct for a user site served from `/`.

## Test gaps

- No rendered React/component tests for Morning Brief, Integrations filters, Settings store controls, Sidebar nav, Topbar buttons, or CommandPalette behavior.
- No browser smoke test in CI for deep links and GitHub Pages 404 fallback.
- No service-worker/offline reload test.
- No tests around durable demo removal or seed opt-out semantics.
- No CSP/source-map/build-output assertion.
- No lint boundary test for provider packages beyond the two restricted import names.
- No accessibility tests for the command palette dialog/list behavior.

Verification run locally:

```text
pnpm lint       -> pass
pnpm typecheck  -> pass
pnpm test       -> pass (38 tests, 5 files)
pnpm build      -> pass, with Vite chunk warning at 508.49 KB raw / 158.41 KB gzip
```

## Acceptance vs IMPLEMENTATION_PLAN

- **Vite + React + TypeScript + Tailwind:** Met.
- **Brand tokens preserved:** Met, with tokens centralized in `src/ui/theme.css`.
- **App shell with Commander / Operator IA:** Met.
- **Module registry hides unfinished routes:** Met and tested.
- **Local domain store + badged demo seed:** Met, with M1 noted for removal persistence.
- **Command Palette + Global Search skeletons:** Met; accessibility and UI tests should be expanded.
- **Morning Brief answers six questions from local data:** Met and unit-tested.
- **Integration Registry with Connected | Disabled | Awaiting Credentials:** Met and unit-tested.
- **Production build deployable to GitHub Pages:** Met for online Pages deployment; PWA offline asset caching needs M2.
- **Preserve manifest + service worker:** Met at baseline, but not robust offline.
- **Acceptance command chain:** Met locally.
- **No fake Healthy:** Met in active source/build; only legacy archive/docs retain historical references.

## Recommended follow-ups before Wave 2

1. Make demo-data removal durable or relabel it as temporary.
2. Improve service-worker asset caching and add offline/deep-link smoke coverage.
3. Add component/e2e tests for the command palette, nav, filters, and Settings store actions.
4. Add a route allowlist for any data-provided href before remote records are introduced.
5. Decide on production source maps and add a CSP before private data or remote content.
6. Broaden provider SDK import restrictions so future UI code cannot bypass the Agent Kernel.
7. Define probe metadata/freshness requirements before any integration can become Connected.
8. Keep TD-16 as low until real route modules land; revisit code splitting when Waves 3-4 add heavier screens.
