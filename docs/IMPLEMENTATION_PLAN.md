# Wave 1 Implementation Brief — Foundation (Claude)

**Status:** Ready for implementation **only after** product owner accepts `ARCHITECTURE_AUDIT.md`.  
**Implementer:** Claude Opus / Sonnet  
**Reviewer:** GPT-5.5  
**Architecture gate:** Grok 4.5  

This brief is the handoff contract. Do not invent new top-level architecture. Refine within the audit.

---

## Objective

Replace the static HTML poster with a maintainable Command Surface:

1. Vite + React + TypeScript + Tailwind source tree  
2. Brand tokens preserved (obsidian / sovereign gold / Caslon / JetBrains)  
3. App shell with Commander / Operator IA  
4. Module registry that **hides** unfinished routes  
5. Local domain store (Dexie) + **badged** demo seed  
6. Command Palette (`⌘K` / `Ctrl+K`) + Global Search skeletons  
7. Morning Brief route that answers the six questions from local data  
8. Integration Registry with Connected | Disabled | Awaiting Credentials  
9. Production build still deployable to GitHub Pages  
10. Preserve PWA manifest + service worker (bump cache bust)

**Out of scope for Wave 1:** remote API sync, real OAuth, full Content OS port, MCP server implementations, multi-provider live AI calls.

---

## Suggested tree

```
/
├── ARCHITECTURE_AUDIT.md
├── docs/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html                 # Vite entry (not the old 303KB poster)
├── public/
│   ├── manifest.webmanifest
│   ├── sw.js
│   └── icons…
└── src/
    ├── main.tsx
    ├── app/
    │   ├── App.tsx
    │   ├── router.tsx
    │   ├── shell/             # Sidebar, Topbar, layout
    │   └── providers.tsx
    ├── modules/
    │   ├── dashboard/         # Morning Brief (enabled)
    │   ├── missions/          # hidden or minimal if not ready
    │   ├── integrations/      # registry UI (enabled)
    │   └── settings/          # enabled
    ├── domain/                # zod schemas + types
    ├── data/                  # dexie db + repos + seed
    ├── commands/              # palette registry
    ├── search/                # fuzzy index + recent/pinned
    ├── integrations/          # status model
    ├── agents/                # Kernel interface only (stub provider)
    ├── ui/                    # tokens, primitives
    └── lib/
```

Legacy `index.html` / `404.html` poster: move to `legacy/poster.html` for reference, do not ship as app.

---

## Design constraints (non-negotiable)

- Dark-first; preserve existing Sovereign identity.  
- High information density; quiet; keyboard-first.  
- No purple-glow / generic AI dashboard look.  
- No card spam in hero/brief; cards only when interaction requires a container.  
- Demo data always badged.  
- Incomplete modules hidden from nav.

---

## Acceptance tests (Wave 1)

- [ ] `pnpm install && pnpm lint && pnpm typecheck && pnpm test && pnpm build` succeed  
- [ ] `pnpm preview` serves SPA; refresh on deep link works via Pages `404.html` strategy  
- [ ] Sidebar shows only enabled modules  
- [ ] `/` Morning Brief renders six question sections from local store  
- [ ] `⌘K` opens palette; can navigate to Brief, Integrations, Settings  
- [ ] Search finds seeded people/tasks/content titles  
- [ ] Integrations page shows each entry in exactly one legal state  
- [ ] No console errors on happy path  
- [ ] No fake “Healthy” for unverified integrations  

---

## Handoff artifacts Claude must produce in the PR

- Short subsystem notes under `docs/waves/WAVE_1.md`  
- Updated Feature Completion Matrix deltas  
- List of intentional deferrals  

Then stop for GPT-5.5 review and Grok G3 gate.
