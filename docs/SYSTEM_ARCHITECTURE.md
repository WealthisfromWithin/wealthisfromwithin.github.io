# System Architecture

**Status:** current as of Wave 7 (Production Hardening).
**Companion:** `ARCHITECTURE_AUDIT.md` — the Wave 0 audit that set these rules.
**Scope:** this repository only. Sister repositories (ContentDone, LeadScheduler)
are named where they are relevant and described nowhere as if they were part of
this build.

This document describes the system that exists. Where something is absent, it
says so and says why, because the most common way an architecture document lies
is by describing the intended system in the present tense.

---

## 1. What this is

A single-operator business operating system that runs entirely in one browser
tab. It is a static bundle — HTML, CSS, JavaScript, and fonts — served by GitHub
Pages. There is no server in this repository, no database process, no session,
and no account.

Every record the operator sees is read from **IndexedDB in their own browser**.
Every write goes to the same place. Nothing is uploaded, and nothing is
retrieved from anywhere else, with exactly two exceptions that the operator has
to configure by hand at build time:

1. A local model endpoint on the operator's own loopback address (`/ai`).
2. A `GET /health` reachability probe against a Command API base URL (`/sync`).

Both are off in the shipped deployment. Neither carries a credential.

### The constraint that shapes everything

GitHub Pages serves files. It cannot hold a secret, run code, set a response
header, or authenticate anybody. Every `VITE_*` variable is **inlined into
JavaScript that anyone can read**, so a key placed in one is a published key.

The architecture's response is not to work around that constraint but to build
inside it: the surface holds no credential because it *cannot*, and every
capability that would need one is declared as absent rather than mocked. This is
why there is no sign-in screen. A sign-in screen with nothing behind it is the
single most dishonest thing a static bundle can ship.

---

## 2. Layer map

```
                      ┌─────────────────────────────────────┐
   browser ──────────▶│  src/app        shell, router,      │
                      │                 module registry     │
                      └──────────────┬──────────────────────┘
                                     │
                      ┌──────────────▼──────────────────────┐
                      │  src/modules/*  one folder per       │
                      │                 product surface      │
                      │                 (page + selectors)   │
                      └───────┬──────────────────┬───────────┘
                              │ reads            │ writes
                      ┌───────▼─────────┐  ┌─────▼───────────┐
                      │ src/data        │  │ src/data        │
                      │ dataset +       │  │ mutations.ts    │
                      │ repositories    │  │ (the only       │
                      │ (read path)     │  │  write path)    │
                      └───────┬─────────┘  └─────┬───────────┘
                              └────────┬─────────┘
                                       │
                              ┌────────▼─────────┐
                              │ src/data/db.ts   │
                              │ Dexie / IndexedDB│
                              └────────┬─────────┘
                                       │ validated by
                              ┌────────▼─────────┐
                              │ src/domain       │
                              │ zod entities +   │
                              │ policies         │
                              └──────────────────┘

   cross-cutting:  src/integrations  registry catalog + state model
                   src/agents        AI kernel; adapters are quarantined
                   src/search        global index and fuzzy matcher
                   src/commands      palette registry
                   src/ui            brand tokens and primitives
                   src/lib           clock, formatting, CSP, PWA registration
```

| Directory | Holds | Rule |
|-----------|-------|------|
| `src/app` | Shell, router, module registry, href allowlist, providers | The registry is the only place a route may be declared |
| `src/domain` | Zod entity schemas, transition tables, compliance policy | Every shape is defined once; modules never redefine one |
| `src/data` | Dexie schema, repositories, `mutations.ts`, demo seed | `mutations.ts` is the sole write path |
| `src/modules/*` | One folder per surface: a page plus its pure selectors | A module never imports another module's page |
| `src/integrations` | 29-connector catalog, three-state model, MCP profiles | One table of connector state, read many ways |
| `src/agents` | The kernel and its provider adapters | Provider specifics live only in `src/agents/providers` |
| `src/search` | Document index and matcher | Routing for a hit is derived from the module registry |
| `src/commands` | Command palette entries | Every target must resolve to a served route |
| `src/ui` | Brand tokens and shared primitives | Modules consume tones, never raw colours |
| `src/lib` | Clock, formatters, CSP builder, service-worker registration | No domain knowledge |
| `legacy/` | The archived static prototype | Not built, not served |

**177 TypeScript files, 27,870 lines of source, plus 11,041 lines across 68 test
files.** Tests are roughly 28% of the codebase by line count.

---

## 3. The four invariants

Everything else in this document is detail. These four are the architecture.

### 3.1 One write path

`src/data/mutations.ts` holds **50 writers** and is the only module that calls
`db.<table>.put`, `.update`, or `.delete` outside the seed. Every writer:

- runs inside a Dexie transaction covering every table it touches,
- stamps `updatedAt` **and** `touchedAt` (see §5.3),
- appends an `ActivityEvent` describing what it did,
- returns `{ ok, reason }` — or a created record — rather than throwing.

A surface cannot write to IndexedDB directly. That is what makes "every change
is recorded" a structural fact rather than a convention somebody has to
remember.

### 3.2 Connected means a verified probe

An integration is `connected` **only** if the registry row carries a
`lastProbedAt` timestamp from a probe that succeeded. This is enforced in three
places, deliberately:

- **On write** — `recordIntegrationProbe` is the only writer that can set
  `connected`, and it refuses a result with no parseable timestamp.
- **On read** — `effectiveIntegrationState` downgrades any row claiming
  `connected` without a probe to `awaiting_credentials`, and every surface,
  counter, and health derivation reads through it.
- **On gate** — `automationReadiness` asks `isUsable`, so an unevidenced claim
  cannot make a rule runnable. This is the reason the downgrade lives in
  `src/domain/integrations.ts` rather than beside the registry surface: action
  gating is a domain decision, and a helper the domain cannot import is a helper
  the domain works around.

`src/integrations/invariant.test.ts` enforces the boundary against the source
itself, failing the build when any other module reads the stored field.

The downgrade is not a throw. A row claiming a connection it cannot evidence
*is* a connection whose credentials are unverified, so reporting it as such is
both correct and visible, where an error boundary would hide it.

### 3.3 Nothing is displayed that was not counted

No figure on any surface is modelled, forecast, smoothed, or estimated. Every
number is arithmetic over a stored field, and the surfaces carry their own
provenance: a demo badge when demo rows fed a figure, the basis sentence a KPI
was counted from, the sample size, and `—` with a reason rather than a rounded
rate when the denominator is zero.

### 3.4 Incomplete features are hidden, not stubbed

A module is `enabled` (routed, in navigation, working) or `planned` (no route,
never in navigation, listed in Settings as a roadmap line only). There is no
third state and no "coming soon" page. As of Wave 7 **all 25 registered modules
are enabled**, so the roadmap list in Settings is empty and says so.

---

## 4. Runtime composition

### 4.1 Boot

```
main.tsx
  └─ providers.tsx
       ├─ opens Dexie, seeds demo data if the seed version moved or 12h elapsed
       ├─ loads every table into one in-memory SovereignDataset
       ├─ builds the search index from that dataset
       └─ renders the router inside SovereignContext + PaletteContext
```

The whole store is read into memory at boot as a single `SovereignDataset` — 30
arrays, one per table. At single-operator scale (the demo seed is roughly two
thousand rows) this is far cheaper than per-surface queries, and it is what lets
every selector be a pure function of a plain object, which is what makes them
trivially testable. `useLiveQuery` from `dexie-react-hooks` re-reads the dataset
when a mutation commits, so a write on one surface updates every other.

This is a deliberate ceiling, not an oversight. It is recorded as TD-31/TD-32
and would be revisited if the store ever held tens of thousands of rows — at
which point the answer is indexed queries per surface, not a bigger in-memory
object.

### 4.2 Routing

`src/app/modules.ts` is the single registry, and three tables build from it:

| Table | Count | Purpose |
|-------|------:|---------|
| `moduleRegistry` | 25 | Top-level modules: path, label, group, status, wave, icon |
| `subRoutes` | 6 | Nested surfaces under a hub (`/content/*`, `/integrations/mcp`) |
| `recordRoutes` | 9 | Detail routes, always `/<module>/<record-type>/:id` |

The router, the sidebar, the command palette, the search router, and the href
allowlist all derive from these tables. A route cannot exist in the router and
be missing from navigation, and a link cannot be generated to a path the router
does not serve — `src/app/router.test.tsx` mounts every enabled module,
sub-route, and record route, so a broken lazy import fails the suite rather than
the browser.

Every page except the Morning Brief is `React.lazy`. See §7.

### 4.3 Href safety

`isSafeInternalHref` in `src/app/href.ts` validates every internal link against
the registry tables plus `ALLOWED_QUERY_PARAMS`, which declares the query
parameters each surface accepts. Filter values are imported from the selector
modules' own constants, so a filter cannot exist in a module and be rejected by
the allowlist. Record hrefs validate **id shape, not id existence** (TD-23): a
link to a cleared record lands on "Not in the local store" rather than a blank
page.

---

## 5. Data architecture

Full detail is in [`DATABASE.md`](./DATABASE.md). The architectural points:

### 5.1 Local-first, and only local

**Dexie version 6**, 30 object stores plus a `meta` key-value store. There is no
remote replica, no export beyond the Settings controls, and no backup. Clearing
site data is a complete and unrecoverable delete, and the surfaces say so.

### 5.2 Validation at the boundary

Every row is parsed through a zod schema in `src/domain` when it enters the
store. The schemas are permissive about historical rows on purpose: a shape
change ships as a Dexie version with an `upgrade` that backfills, rather than as
a validation error that locks the operator out of their own data.

The connected-probe invariant is deliberately **not** a schema refinement for
this reason. A stored row that predates the invariant must still load; it is the
*reading* of it that is corrected.

### 5.3 `source` and `touchedAt`

Two fields carry provenance on every row:

- **`source`** — `demo`, `local`, or `remote`. Demo rows are badged everywhere
  they appear and are cleared by a reseed; `local` rows the operator authored
  never are. **No row has ever carried `remote`** — the value is declared for
  the day a Command API supplies one, and nothing writes it today.
- **`touchedAt`** — set by every mutation. A demo row the operator acted on
  survives the 12-hour reseed, so a demo refresh cannot reopen a decided gate or
  discard real work (TD-17).

### 5.4 The activity log

Every mutation appends an `ActivityEvent` on one of nine channels. This is the
system's audit trail and the Health Monitor's "recorded events" panel. It is
**unbounded** (TD-20) — there is no retention rule, and `automationRuns` is a
second unbounded table. Both are recorded debt rather than a solved problem.

---

## 6. Boundaries: where the system stops

The four external boundaries, and what each one actually does.

### 6.1 Command API (`/sync`) — Wave 7

The adapter in `src/modules/sync/sync.ts`. It has exactly one implemented
capability: a `GET /health` against a base URL configured at build time.

- **No `VITE_API_BASE_URL`** → state `Disabled`, and **no request is made at
  all** — not on mount, not on a timer.
- **A base URL that is unparsable, non-HTTPS on a public host, or carries
  userinfo, a query, or a fragment** → refused before any request, because each
  of those is a way a credential arrives in a public bundle.
- **A valid base URL, no successful probe** → `Awaiting Credentials`.
- **A successful probe** → `Connected`, with the timestamp, written to the
  registry through `recordIntegrationProbe`.

The probe sends `credentials: 'omit'` and no headers. There is no read-model, no
write-through, no conflict resolution, no session, and no credential vault — all
five are listed on the page as *Not implemented*, each with the reason. A 2xx
proves an origin answered; it is not authorisation and it is not a sync, and no
code path in the module can report one.

### 6.2 Local model (`/ai`) — Wave 5

The only AI provider that can run from this bundle, because it is the only one
that needs no secret. `VITE_LOCAL_AI_URL` must be **loopback** — `localhost`,
`127.0.0.1`, or `[::1]` — and anything else is refused before a request is made.
The four hosted adapters (OpenAI, Anthropic, Gemini, OpenRouter) exist behind
the same interface, report `awaiting_credentials`, name the registry row that
would fix them, and contain no code path that produces text.

All AI flows through **one kernel** (`src/agents/kernel.ts`), which orders the
adapters, applies the WITHIN policy, owns the approval flag, and returns the
most explanatory refusal. Provider specifics never leak into a module.

### 6.3 Integration registry — Wave 1, hardened in Wave 7

29 connectors, each exactly one of Connected / Disabled / Awaiting Credentials,
read through `effectiveIntegrationState`. No credential, endpoint, or token
appears on any surface, and there is no field to type one into. The shipped
catalog is **0 connected, 9 disabled, 20 awaiting credentials** — and the one
row that *can* become connected is the ContentDone API row, via the `/sync`
probe.

### 6.4 MCP — Wave 6

Five declared servers, all registry rows, surfaced at `/integrations/mcp` as a
second lens on the same table rather than a module with its own state. **No MCP
client ships**: no transport, no handshake, no tool enumeration. See
[`MCP.md`](./MCP.md).

---

## 7. Build and delivery

Full detail in [`DEPLOYMENT.md`](./DEPLOYMENT.md).

- **Vite 8 + Rolldown**, target `es2022`, no source maps in production.
- **Vendor chunking** splits React (with the router), Dexie, and Zod into three
  stable chunks, so an application change no longer invalidates ~300 kB of
  dependency bytes for returning visitors.
- **The demo seed is dynamically imported** — 60 kB raw that only loads when a
  seed actually runs.
- **First load: 639.46 kB raw / 195.60 kB gzip** across 13 chunks, plus 65.72 kB
  / 22.67 kB gzip of CSS. 42 further chunks are deferred behind routes.
- **CSP** is injected as a `<meta http-equiv>` into the built `index.html` only.
  Pages cannot set headers, so the meta tag is the only delivery available; the
  dev server is deliberately left alone because Vite's HMR client is an inline
  script a correct policy would refuse. `frame-ancestors` is emitted only in the
  header form, because browsers ignore it in a meta tag — so clickjacking
  protection on Pages is **absent**, not partial. See
  [`OPERATIONS.md`](./OPERATIONS.md).
- **`dist/404.html`** is a copy of `index.html`, which is how deep links resolve
  on Pages.

---

## 8. What the architecture deliberately does not have

| Absent | Why |
|--------|-----|
| Authentication | A static bundle cannot verify one. Auth belongs to the Command API, and a sign-in screen with nothing behind it is theatre |
| Remote persistence | No API is deployed. The `/sync` adapter declares the gap rather than filling it with a queue that never flushes |
| A scheduler | A timer in a browser tab fires only while the tab is open, which is a scheduler that lies about when it ran |
| Real-time / websockets | One operator, one tab, one store. There is nothing to synchronise |
| Server-side rendering | Pages cannot run code, and nothing here needs SEO or a fast cold TTFB |
| Multi-tenancy | Single-operator excellence first. Tenancy is a data-model decision, not a feature flag |
| Analytics beacons | Nothing observes the operator. `/analytics` counts writes to this store and states that limitation on the page |
| Error reporting | It would need an endpoint and would carry operator data off-device |

---

## 9. Testing architecture

**919 tests across 68 files.** Three layers:

1. **Pure selectors and domain logic** — plain functions over plain objects. The
   majority of tests, and the reason selectors are separated from pages.
2. **Mutations against a real IndexedDB** — `fake-indexeddb` gives every suite a
   genuine Dexie store, including a migration regression that opens a version-5
   store at version 6.
3. **Pages mounted in a real router** — Testing Library clicks through real
   components against a real store, including `router.test.tsx` which mounts
   every registered route.

There are no snapshot tests and nothing asserts on rendered CSS. The invariants
are asserted directly: `modules.test.ts` asserts every module's status against
its wave, `href.test.ts` asserts the allowlist matches the router,
`registry.test.ts` asserts every palette target resolves, `state.test.ts`
asserts the connected-probe downgrade, and `probe.mutations.test.ts` asserts the
writer refuses a probe with no timestamp.

---

## 10. Change rules

1. A new surface is a new folder under `src/modules/` plus one entry in
   `moduleRegistry`. Nothing else grants a route.
2. A new shape goes in `src/domain`, once, and reaches the store through a new
   Dexie version with an `upgrade`.
3. A new write goes in `src/data/mutations.ts` and follows the writer contract
   in §3.1.
4. A number rendered on a surface must be traceable to stored fields, and must
   carry its basis and sample size when it is a rate.
5. A capability that needs a credential is declared absent with its reason. It
   is never mocked, and never shown as available-but-erroring.

See [`DEVELOPER_GUIDE.md`](./DEVELOPER_GUIDE.md) for the working procedure.
