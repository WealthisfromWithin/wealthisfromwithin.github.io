# Performance Report

**Last updated:** Wave 7 (Production Hardening).
**Baseline section:** Wave 0, retained below for the record.

---

# Wave 7 measurements

All figures below were measured, not estimated. The Wave 6 comparison is a
**rebuild of commit `cf8c64d` on the current toolchain**, so the two columns are
the same Vite version, the same Rolldown, and the same machine — a like-for-like
comparison rather than a figure copied from an older wave note.

**Method.** Raw sizes are `stat` on the emitted files; gzip sizes are `gzip -c |
wc -c` at the default level. "First load" is the set of chunks referenced by
`dist/index.html` as either the entry script or a `modulepreload`, which is what
a browser actually fetches before first paint — not the whole `dist/assets`
directory. Vite's own build log reports gzip figures 1–2% higher because it
compresses at a different level; that difference is consistent across both
columns and does not affect the deltas.

## Headline

| | Wave 6 (rebuilt) | Wave 7 | Δ |
|---|---:|---:|---:|
| First-load JS, raw | 692.21 kB | **639.46 kB** | **−52.75 kB (−7.6%)** |
| First-load JS, gzip | 210.16 kB | **195.60 kB** | **−14.56 kB (−6.9%)** |
| First-load chunks | 9 | 13 | +4 |
| Deferred chunks | 40 | 42 | +2 |
| Total JS chunks | 49 | 55 | +6 |
| CSS | 65.72 kB / 22.67 kB gzip | unchanged | — |

**The Wave 1 target of < 200 kB gzip on the critical path is met for the first
time**, and met in the wave that also added a module. Every prior wave moved
this number up.

## First load, chunk by chunk

| Chunk | Raw | Gzip | Contents |
|-------|----:|-----:|----------|
| `vendor-react` | 274.28 kB | 86.21 kB | React, React DOM, React Router, scheduler |
| `index` | 127.42 kB | 37.26 kB | Shell, router, brief, selectors pulled in by the href allowlist |
| `vendor-dexie` | 103.92 kB | 33.87 kB | Dexie |
| `vendor-zod` | 64.64 kB | 17.23 kB | Zod |
| `mutations` | 35.72 kB | 8.94 kB | The 50 writers |
| `domain` | 14.82 kB | 4.43 kB | Entity schemas and policies |
| `content` | 6.33 kB | 2.30 kB | Shared content selectors |
| `db` | 3.18 kB | 1.08 kB | Dexie schema |
| `primitives` | 3.13 kB | 1.31 kB | UI primitives |
| `calendar` | 2.69 kB | 1.28 kB | Shared date arithmetic |
| `state` | 1.65 kB | 0.76 kB | Integration state model |
| `clock` | 1.09 kB | 0.54 kB | Time helpers |
| `rolldown-runtime` | 0.59 kB | 0.40 kB | Module runtime |

**Deferred: 42 chunks, 336.99 kB raw / 108.89 kB gzip.** Every route except the
Morning Brief, plus the demo seed.

## What produced the reduction

### 1. Deferring the demo seed — the whole of the win

`src/data/seed.ts` is 60.35 kB raw (17.57 kB gzip) of demo fixtures. It was
eagerly imported by `repositories.ts`, which needed only one constant from it:
`SEED_VERSION`, read on every boot to decide whether to reseed.

The fix was to extract that constant into `src/data/seedVersion.ts` — a
ten-line file — and load the fixtures through a dynamic `import()` inside
`seedDemoData`, which was already `async` and already awaited by every caller:

```82:88:src/data/repositories.ts
export async function seedDemoData(database: SovereignDb, now: Date): Promise<void> {
  // Imported here rather than at module scope so the ~80 KB of demo fixtures
  // stays out of the first load (TD-16). A boot that does not need to reseed —
  // a reload inside the seed's 12-hour window, or a store the operator cleared
  // — never fetches this chunk at all.
  const { buildDemoDataset } = await import('./seed');
```

The behavioural effect is better than the number suggests:

| Visit | Before | After |
|-------|--------|-------|
| First ever | 60 kB blocking the initial parse | 60 kB fetched **in parallel** with rendering |
| Reload inside the 12-hour window | 60 kB re-parsed | **Not fetched at all** |
| Operator cleared demo data | 60 kB re-parsed | **Not fetched at all** |

The second and third rows are the common cases for anyone actually using the
surface.

### 2. Vendor chunking — caching, not size

`manualChunks` splits React (with the router and scheduler), Dexie, and Zod into
three chunks. Split by **package**, not by size: things that version together
belong in one chunk, and things that do not each get their own.

This moves no bytes off the first load — it is the same code in four files
instead of one. What it changes is invalidation. Before, editing one selector
changed the hash of a single chunk containing 442.84 kB of dependencies. Now:

| Change | Re-downloaded before | Re-downloaded now |
|--------|---------------------:|------------------:|
| A module's code | ~365 kB | ~127 kB |
| A React upgrade | ~365 kB | ~274 kB |
| A Zod upgrade | ~365 kB | ~65 kB |

For a returning operator — which is every operator after the first day — that is
the more useful of the two wins.

## TD-16 — status

**Substantially paid, and reframed.**

TD-16 was filed at Wave 0 as "single ~508 kB JS chunk (no route splitting)", and
tracked the 500 kB chunk-size advisory. Three findings:

1. **Route splitting was paid over Waves 3–6.** 42 deferred chunks holding
   336.99 kB raw.
2. **Vendor chunking is paid in Wave 7.** Dependencies are separately cacheable.
3. **The advisory does not fire, and did not fire at Wave 6 either.** Rebuilding
   `cf8c64d` on the current toolchain emits no chunk-size warning, because the
   largest chunk was 364.83 kB — under the 500 kB default. The "one chunk-size
   advisory (TD-16)" recorded in `docs/waves/WAVE_6.md` and in the Wave 6 debt
   paydown **does not reproduce**. It was most likely carried forward from an
   earlier wave's build rather than re-observed, and it is corrected here rather
   than repeated.

What remains under TD-16 is not a build-config problem:

- **`vendor-react` is 274.28 kB / 86.21 kB gzip**, 44% of the first load. Only a
  smaller framework would move it, and that is not a wave item.
- **`vendor-zod` is 64.64 kB / 17.23 kB gzip**, eager because every schema is
  parsed as the store opens. Deferring validation per surface is possible and is
  the next real saving.
- **`index` is 127.42 kB / 37.26 kB gzip**, inflated by TD-24: the href
  allowlist imports filter constants from a dozen selector modules, dragging
  their sibling code into the shared chunk. Fixing TD-24 — declaring filter
  values as data rather than importing them — is the other real saving.

Together those two are worth an estimated 30–50 kB gzip. **Neither is urgent**:
the target is met, and the honest position is that further optimisation is now
speculative rather than needed.

## Runtime characteristics

| Area | Behaviour |
|------|-----------|
| Store read | The entire store loads into memory at boot as one `SovereignDataset`. ~2,000 demo rows across 30 arrays; imperceptible |
| Re-render | `useLiveQuery` re-reads on commit and re-renders subscribers. Selectors are `useMemo`'d over the dataset |
| Selectors | Pure functions, no memo cache across renders. Table scans (TD-31, TD-32) are instant at this scale and `O(rows)` at any other |
| Lists | **No virtualisation anywhere.** Correct at demo scale; the first long CRM table will need it |
| Fonts | Self-hosted woff2, `font-src 'self'`. No CDN, no FOIT from a third-party |
| Service worker | Network-first with cache fallback. A repeat visit is cache-warm; navigations resolve to the app shell offline |

**Not measured:** no Lighthouse run, no field data, no RUM. Nothing observes the
operator, deliberately, so every figure here is a build measurement rather than
an experience measurement. Treat bundle size as a proxy, not as proof.

## Anti-patterns still rejected

- Loading all module pages eagerly
- Recomputing the Morning Brief on every keystroke
- Provider SDKs in the client bundle (ESLint-enforced)
- Unvirtualized long tables without pagination — *acceptable only while the
  store is small; this is the one on this list that will eventually be violated
  by data rather than by a change*

## Next, in value order

1. **A performance budget in CI.** First-load gzip is measured by hand each
   wave. A CI threshold would catch a regression at PR time. Cheapest item here
2. **TD-24 — filter constants as data**, shrinking the eager `index` chunk
3. **Deferred zod validation** per surface, shrinking eager `vendor-zod`
4. **Virtualisation**, when a real store first makes a table slow — not before

---
---

# Performance Report (Wave 0 baseline)

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

| Area | Target | Status at Wave 7 |
|------|--------|------------------|
| Initial JS (gzip) | &lt; 200 KB critical path | **Met** — 195.60 kB |
| Route-level code splitting | All modules except shell + Brief | **Met** — 42 deferred chunks |
| CSS | Tailwind purge via Vite; no 275KB inline blob | **Met** — 65.72 kB / 22.67 kB gzip |
| Search index | Build incrementally; defer semantic until embed provider connected | **Partly** — built once at boot from the in-memory dataset; no semantic layer, and no provider to build one with |
| Dexie queries | Indexes on status, dueAt, updatedAt | **Met** on the schema; **unused in practice**, because the whole store is read into memory rather than queried |
| API batching | Dashboard brief = one aggregate endpoint later | **N/A** — no API |
| Images | None required for Brief; avoid decorative weight | **Met** — no raster images ship; the favicon is an inline SVG |
| Service worker | Precache shell only; network-first for API | **Met** |

## Anti-patterns to reject

- Loading all module pages eagerly
- Recomputing Morning Brief on every keystroke
- Provider SDKs in the client bundle
- Unvirtualized long CRM tables without pagination

Performance work after Wave 1 is a **Grok gate**, not an implementer side quest.
