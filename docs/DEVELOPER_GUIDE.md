# Developer Guide

**Status:** current as of Wave 7.
**Read first:** [`SYSTEM_ARCHITECTURE.md`](./SYSTEM_ARCHITECTURE.md) — this guide
assumes the four invariants in its §3.

---

## 1. Setup

```bash
pnpm install
pnpm dev          # http://localhost:5173
```

Node 22+, pnpm 10+. There is no database to provision, no `.env` to create, and
no service to start. The store opens itself and seeds demo data on first load.

### The four gates

```bash
pnpm lint         # eslint — 0 errors and 0 warnings required
pnpm typecheck    # tsc -b --noEmit
pnpm test         # vitest run — 919 tests across 68 files
pnpm build        # typecheck + vite build + postbuild
```

CI runs all four on every branch and PR, and the deploy workflow runs them
again. Run them locally before pushing; a broken gate does not ship.

`pnpm test:watch` for the loop. `pnpm preview` serves `dist/` — the only way to
see the production CSP, since it is deliberately not applied in dev.

---

## 2. Where things go

| I want to… | Touch |
|------------|-------|
| Add a surface | `src/modules/<name>/` + one entry in `src/app/modules.ts` |
| Add a shape | `src/domain/` + a Dexie version in `src/data/db.ts` |
| Add a write | `src/data/mutations.ts` — nowhere else |
| Add a derived figure | A pure selector in the module's own folder |
| Add a palette entry | `src/commands/registry.ts` |
| Add a connector | `src/integrations/catalog.ts` |
| Add a shared component | `src/ui/primitives.tsx` |
| Change the CSP | `src/lib/csp.ts` — never `index.html` |

**A module never imports another module's page.** Share through `src/domain`,
`src/data`, or `src/ui`. If two modules need the same selector, it belongs in
one of those three.

---

## 3. Adding a module, end to end

### 3.1 Register it

```ts
// src/app/modules.ts
{
  id: 'weekly-review',
  path: '/weekly-review',
  label: 'Weekly Review',
  group: 'commander',
  status: 'planned',        // 'enabled' only when it actually works
  wave: 8,
  summary: 'One sentence. What it does, and what it does not.',
  icon: CalendarCheck,
}
```

`planned` gets no route and never appears in navigation — it is a roadmap line
in Settings and nothing else. There is no "coming soon" page in this codebase
and there will not be one.

### 3.2 Selectors before the page

Put the logic in `src/modules/weekly-review/weeklyReview.ts` as pure functions
of `SovereignDataset`. This is not a style preference: it is what makes the
logic testable without a DOM, and it is why most of the 919 tests run in
milliseconds.

```ts
export function weeklyRollup(dataset: SovereignDataset, now: Date): Rollup {
  // arithmetic over stored fields — nothing modelled, nothing estimated
}
```

### 3.3 The page

```tsx
export function WeeklyReviewPage() {
  const { dataset, ready } = useSovereign();
  const rollup = useMemo(() => weeklyRollup(dataset, new Date()), [dataset]);
  // render
}
```

Use `src/ui/primitives.tsx` (`Panel`, `StatePill`, `SectionLabel`, `DemoBadge`,
`EmptyLine`) and semantic tones, never raw colours.

### 3.4 Route it

Add to `src/app/lazyModules.ts` and `src/app/router.tsx`, then flip `status` to
`'enabled'` and update `src/app/modules.test.ts`. `router.test.tsx` mounts every
enabled route, so a broken lazy import fails the suite rather than the browser.

### 3.5 Query parameters

Any filter that lives in the URL must be declared in `ALLOWED_QUERY_PARAMS` in
`src/app/href.ts`, and its values must come from the selector module's own
constant — so a filter cannot exist in a module and be rejected by the
allowlist.

---

## 4. The writer contract

Every function in `src/data/mutations.ts` follows the same shape. Deviating from
it breaks guarantees other parts of the system depend on.

```ts
export async function doTheThing(
  id: string,
  input: Input,
  database: SovereignDb = db,      // injectable for tests
  now: Date = new Date(),          // injectable for tests
): Promise<{ ok: boolean; reason?: string }> {
  return database.transaction('rw', [database.things, database.events], async () => {
    const row = await database.things.get(id);
    if (!row) return { ok: false, reason: 'Not in the local store.' };

    // Refuse before writing, with a sentence a human can act on.
    if (!allowed(row)) return { ok: false, reason: whyNot(row) };

    const stamp = now.toISOString();
    await database.things.update(id, { ...changes, updatedAt: stamp, touchedAt: stamp });
    await database.events.put(activityFor(row, 'kind', 'channel', title, detail, now));
    return { ok: true };
  });
}
```

Non-negotiable:

| Rule | Why |
|------|-----|
| One transaction covering every table touched | A partial write is not recoverable in a store with no backup |
| Stamp `updatedAt` **and** `touchedAt` | `touchedAt` is what protects the row from the reseeder (TD-17) |
| Write an `ActivityEvent` | The log is the audit trail. A silent write is an unauditable one |
| Return `{ ok, reason }`, do not throw | The reason is rendered to the operator. An exception is not |
| Inject `database` and `now` | Every mutation test depends on it |

**Record refusals.** `runAutomation` writes a run record when it declines,
matches nothing, or refuses a hand-off. A system that silently does nothing is
worse than one that says it did nothing.

---

## 5. Honesty rules

These are the rules a reviewer will actually reject a change over.

### 5.1 No number that was not counted

Every figure is arithmetic over stored fields. Nothing is modelled, forecast,
smoothed, or estimated.

- Carry the **basis** — the sentence the figure was counted from.
- Carry the **sample size**.
- Badge **demo provenance** when demo rows fed it.
- Return `—` **with the reason** when the denominator is zero. Never `0%`.
- Say *too small to read as a trend* under five rows.

`—` and `0%` are different facts and must not render the same.

### 5.2 Connected requires a probe

Read integration state through `effectiveIntegrationState`, never
`integration.state`. Write it only through `recordIntegrationProbe`. See
[`DATABASE.md`](./DATABASE.md) §4.

### 5.3 No secret in the bundle

Every `VITE_*` value is inlined into public JavaScript. Nothing in the codebase
reads an API key from the environment, and nothing should start. A URL variable
is checked before use: the local AI endpoint must be loopback, and the Command
API base URL must be HTTPS with no userinfo, query, or fragment.

### 5.4 Hidden, not stubbed

A capability that needs something absent is **declared absent with its reason**.
It is never mocked, never shown as available-but-erroring, and never behind a
disabled button with no explanation.

### 5.5 One kernel for AI

All model calls go through `src/agents/kernel.ts`. Provider specifics live only
in `src/agents/providers/`, and ESLint enforces this: importing a provider SDK
elsewhere is an error, and importing an adapter from `src/app`, `src/modules`,
or `src/ui` is an error with its own message.

---

## 6. Testing

**919 tests, 68 files.** Three layers, and you should know which one you are
writing.

### Pure logic — most tests

```ts
it('refuses a rate with no denominator', () => {
  expect(winRate(datasetWithNothingClosed()).value).toBeUndefined();
});
```

No DOM, no database. Fast, and where the majority of behaviour is proven.

### Mutations against a real store

`fake-indexeddb` gives every suite a genuine Dexie database, so transactions and
migrations are exercised for real.

```ts
const database = new SovereignDb(`test-${crypto.randomUUID()}`);
await database.things.put(fixture);
const result = await doTheThing('id', input, database, new Date('2026-01-01'));
expect(result.ok).toBe(true);
```

### Pages in a real router

Testing Library, real components, real store, real clicks. Assert on text the
operator sees, not on implementation details.

### Invariant tests

Some suites exist to protect an architectural rule rather than a feature. Do not
weaken one to make a change pass:

| Suite | Protects |
|-------|----------|
| `src/app/modules.test.ts` | Module status matches its wave; planned modules stay unrouted |
| `src/app/router.test.tsx` | Every registered route mounts |
| `src/app/href.test.ts` | The allowlist matches the router |
| `src/commands/registry.test.ts` | Every palette target resolves to a served route |
| `src/integrations/state.test.ts` | The connected-probe downgrade |
| `src/data/probe.mutations.test.ts` | The writer refuses a probe with no timestamp |
| `src/data/db.test.ts` | A version-5 store opens at 6 with rows intact |
| `src/lib/csp.test.ts` | `frame-ancestors` is omitted from the meta form |

### Prior-wave invariants

Four suites encode fixes that earlier reviews held a wave on. **They must stay
green, and a change that touches their area needs them checked explicitly:**

| Invariant | Suite |
|-----------|-------|
| W4 M1 — content approval writes through to the content row | `src/data/mutations.test.ts`, `src/modules/approvals/ApprovalsPage.test.tsx` |
| W5 H1 — the local AI endpoint is loopback-only | `src/agents/providers/providers.test.ts`, `src/modules/ai/AiWorkspacePage.localEndpoint.test.tsx` |
| W6 M1 — content KPIs honour the selected metrics window | `src/modules/metrics/metrics.test.ts` |

There are no snapshot tests and nothing asserts on rendered CSS. Both are
deliberate: a snapshot proves a component did not change, not that it is right.

---

## 7. Conventions

| Area | Convention |
|------|-----------|
| Imports | `@/` maps to `src/`. Type imports inline: `import { type Foo }` |
| Naming | Selectors are verbs (`buildHealthReport`), predicates read as questions (`isUsable`, `hasVerifiedProbe`) |
| Dates | ISO 8601 strings everywhere. Never a `Date` in a stored row |
| Time | Inject `now: Date = new Date()` into anything time-dependent |
| Errors | Refuse and return a reason. Reserve throwing for genuine programmer error |
| Copy | Write for the operator. "No probe has run" beats "Status: unknown" |
| Comments | Explain the constraint or the trade-off. Never narrate the code |

### On the comment rule

The comments in this codebase are unusually dense, and they are load-bearing
because most of the design is about what is deliberately *absent*. A future
reader can see what the code does; they cannot see that a non-loopback URL is
refused before a request is built **because** the adapter reports
`external: false` to the kernel. Write that kind of comment. Do not write
`// increment the counter`.

---

## 8. Common tasks

### Add a connector

Add a row to `src/integrations/catalog.ts` with the correct state. It is
`awaiting_credentials` if the operation wants it and has not configured it;
`disabled` if the operation decided against it. **Never `connected`** — that
requires a probe, and only `/sync` can run one.

### Add a Dexie version

See [`DATABASE.md`](./DATABASE.md) §2. Additive stores, backfilling upgrades,
and a regression in `src/data/db.test.ts` that opens a store created at the
previous version.

### Change the CSP

Edit `src/lib/csp.ts`, add a case to `src/lib/csp.test.ts`, and verify with
`pnpm build && pnpm preview` — the policy is not applied in dev, on purpose,
because Vite's HMR client is an inline script it would correctly refuse.

### Bump the seed

Change `SEED_VERSION` in `src/data/seedVersion.ts` **only** when the seed's shape
changes. Bumping it forces a reseed for every operator, which rebuilds demo rows
they may have been reading — untouched ones, at least. Wave 7 deliberately left
it at `wave6.0` because nothing about the seed changed.

---

## 9. Review checklist

- [ ] Four gates green: lint, typecheck, test, build
- [ ] Every displayed number traceable to stored fields, with basis and sample size
- [ ] No `VITE_*` secret; no credential field; no key read from the environment
- [ ] Integration state read via `effectiveIntegrationState`
- [ ] New writers follow the contract in §4 and are in `mutations.ts`
- [ ] New routes registered in `modules.ts`, and the href allowlist updated
- [ ] Absent capabilities declared with a reason, not stubbed
- [ ] Prior-wave invariant suites (§6) still green
- [ ] Comments explain constraints, not mechanics
- [ ] Docs updated when behaviour changed — this file included
