# Performance Report (Baseline)

**Owner:** Performance Engineer / Architect (Grok 4.5)  
**Date:** 2026-08-05

## Current measurements (static)

| Asset | Size | Note |
|-------|------|------|
| `index.html` | ~303 KB | Mostly inlined Tailwind CSS |
| `404.html` | ~303 KB | Exact duplicate |
| `sw.js` | &lt;1 KB | Cache-first offline shell |
| JS logic | &lt;1 KB | Hover + beat timer |

**Bottleneck today:** shipping a full utility CSS universe inside HTML, duplicated twice. Not React re-renders — there is no app.

## Targets for Wave 1+

| Area | Target |
|------|--------|
| Initial JS (gzip) | &lt; 200 KB critical path |
| Route-level code splitting | All modules except shell + Brief |
| CSS | Tailwind purge via Vite; no 275KB inline blob |
| Search index | Build incrementally; defer semantic until embed provider connected |
| Dexie queries | Indexes on status, dueAt, updatedAt |
| API batching | Dashboard brief = one aggregate endpoint later |
| Images | None required for Brief; avoid decorative weight |
| Service worker | Precache shell only; network-first for API |

## Anti-patterns to reject

- Loading all module pages eagerly  
- Recomputing Morning Brief on every keystroke  
- Provider SDKs in the client bundle  
- Unvirtualized long CRM tables without pagination  

Performance work after Wave 1 is a **Grok gate**, not an implementer side quest.
