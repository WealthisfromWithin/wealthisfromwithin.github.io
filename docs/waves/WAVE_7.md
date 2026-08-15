# Wave 7 — Production Hardening

**Implementer:** Claude (Implementation Engineer + Documentation Engineer)
**Plan:** `docs/IMPLEMENTATION_PLAN_WAVE_7.md`
**Architecture:** `ARCHITECTURE_AUDIT.md` §7 Wave 7, Phase 17 doc list
**Predecessor:** `docs/waves/WAVE_6.md` (G3 PASS after the M1 fix pack)
**Status:** complete — fix pack applied for G3 H1 + H2 (see the last section)

---

## What changed

Every wave until now added capability. Wave 7 mostly added *enforcement*, and
the difference is the point of it.

Waves 1–6 built twenty-four modules on a set of honesty rules — no fake
telemetry, no unbadged demo data, no number that was not counted, no integration
green without a probe. Those rules held because everyone remembered them. Wave 7
picks the one that was load-bearing and makes it structural, then ships the
first surface in the platform's history that can actually run a probe.

Four deliverables:

1. **`/sync` is routed** — the Command API adapter, with three honest states and
   exactly one implemented capability.
2. **The connected-probe invariant is enforced** on write and on read, closing
   Wave 6 review finding L1.
3. **Settings distinguishes two things that were being conflated** — the demo
   seed, which the operator controls, and demo-*local*, which no switch in this
   bundle can change.
4. **The build got smaller and safer** — a CSP on the built index, vendor
   chunking, and a deferred demo seed.

Plus the seven Phase 17 documents, which closed the last open item in the
audit's own definition of done.

### The honesty pressure this time

Wave 4 had to avoid faking a publish, Wave 5 a thought, Wave 6 agency. Wave 7
has to avoid faking a **connection** — which is harder, because for the first
time the platform can genuinely make one.

A module named "Sync" that talks to a server is one commit away from a spinner
that says *Syncing…*, a row count it did not fetch, and a green badge for an
origin that returned a 200. Every constraint below exists to make that commit
impossible rather than merely discouraged.

- **No probe, no request.** With no `VITE_API_BASE_URL`, nothing is fetched —
  not on mount, not on a timer, not at all. The state is `Disabled`, which means
  *never switched on*, not *broken*.
- **No credential can travel.** The probe is a plain GET with `credentials:
  'omit'` and no headers. There is nothing in this bundle to send.
- **No credential can arrive either.** A base URL carrying userinfo, a query
  string, or a fragment is refused before any request, because each is a way an
  API key reaches a public bundle.
- **A 2xx is reachability, and the page says so.** It is not authorisation and
  it is not a sync. There is no code path in the module that can report a record
  having moved.
- **Five of six capabilities are printed as `Not implemented`**, each with the
  reason it is absent.

## Enabled vs hidden

| Module | Route | Group | Wave | State |
|--------|-------|-------|------|-------|
| Morning Brief | `/` | Commander | 1 | enabled |
| Approval Queue | `/approvals` | Commander | 2 | enabled |
| Health Monitor | `/health` | Commander | 2 | enabled |
| Mission Control | `/missions` | Commander | 6 | enabled |
| Business Metrics | `/metrics` | Commander | 6 | enabled |
| Decision Log | `/decisions` | Commander | 5 | enabled |
| Inbox | `/inbox` | Operator | 2 | enabled |
| CRM | `/crm` | Operator | 3 | enabled |
| Pipeline | `/pipeline` | Operator | 3 | enabled |
| Tasks | `/tasks` | Operator | 3 | enabled |
| Projects | `/projects` | Operator | 3 | enabled |
| Calendar | `/calendar` | Operator | 3 | enabled |
| Meetings | `/meetings` | Operator | 3 | enabled |
| Content OS | `/content` | Operator | 4 | enabled |
| Knowledge | `/knowledge` | Operator | 5 | enabled |
| Memory | `/memory` | Operator | 5 | enabled |
| Documents | `/documents` | Operator | 5 | enabled |
| Research | `/research` | Operator | 5 | enabled |
| AI Workspace | `/ai` | Operator | 5 | enabled |
| Prompt Library | `/prompts` | Operator | 5 | enabled |
| Automations | `/automations` | Operator | 6 | enabled |
| Analytics | `/analytics` | Operator | 6 | enabled |
| Integrations | `/integrations` | Operator | 1 | enabled |
| **Command API Sync** | **`/sync`** | **Operator** | **7** | **enabled (new)** |
| Settings | `/settings` | Operator | 1 | enabled |

**Twenty-five modules are enabled and none remains `planned`** — the first wave
in which the registry has no hidden entries. `src/app/modules.test.ts` was
updated from `WAVE_6_ENABLED` to `WAVE_7_ENABLED` and still asserts both halves
of the rule: every Wave 7 module is enabled by id, and every module with
`wave > 7` would still be `planned`. The assertion now guards an empty set,
which is the correct way for it to fail if somebody adds a Wave 8 entry and
routes it early.

Sync sits between Integrations and Settings rather than last. The registry's
declaration order drives both navigation and the router, and *integrations →
sync → settings* is the order an operator actually reads them in: what is
connected, what connects it, what controls it.

Sub-routes (6) and record detail routes (9) are unchanged. `/sync` adds neither
— it has one page, no filters, and no record to link to.

## The connected-probe invariant (W6 L1)

The Wave 6 GPT review's L1 finding: `connected` was **defined** as "credentials
verified by a health probe" in `integrationStateMeta` and **enforced** by
nothing. It had never mattered, because nothing in the platform could write the
state. `/sync` can, so it had to.

It is enforced in two places, and both are necessary.

### On write — one gate

`recordIntegrationProbe` is the only writer that can set `connected`:

```2610:2617:src/data/mutations.ts
  const at = result.at.trim();
  if (at.length === 0 || Number.isNaN(Date.parse(at))) {
    return {
      ok: false,
      reason:
        'A probe result must carry the time it ran. Connected without a probe timestamp is refused.',
    };
  }
```

It also refuses a row that is deliberately `disabled` — a connector turned off
on purpose is not one waiting to be checked — and it writes `lastProbedAt` on
**failure as well as success**, because "we asked and it did not answer" is a
measurement worth keeping. A failed probe lands `awaiting_credentials` with a
timestamp, not a silent no-op.

### On read — one downgrade, everywhere

```90:92:src/integrations/state.ts
export function effectiveIntegrationState(integration: Integration): IntegrationState {
  return isUnverifiedConnectedClaim(integration) ? 'awaiting_credentials' : integration.state;
}
```

Every consumer was moved onto it: `countByState`, `isUsable`,
`deriveSubstrateHealth` (via `isUsable`), `verifiedIntegrations` and
`blockedCapabilities` in the Health Monitor, `mcpServers` in the MCP lens, the
registry page's filter, sort, and pill, and the search index's subtitle.

### Why both, and why not a schema refinement

The writer contract governs rows written from now on. The read-time downgrade
governs rows already sitting in an operator's browser — and **IndexedDB is
hand-editable from devtools**, so a write-side check alone is not an invariant,
it is a convention with better manners.

A zod refinement was considered and rejected. A stored row failing validation
would lock the operator out of their own store, which hides the problem behind
an error boundary instead of showing it. The downgrade is the honest response:
a row claiming a connection it cannot evidence *is* a connection whose
credentials are unverified, which is precisely what `awaiting_credentials`
means.

### What it changes in practice

Nothing visible today — every catalog row ships as `awaiting_credentials` or
`disabled`, so no row is downgraded. That is the correct outcome for an
invariant: it should be invisible until something tries to violate it. Six new
tests in `state.test.ts` violate it deliberately.

## The Sync module

### `src/modules/sync/sync.ts` — the pure half

| Export | What it does |
|--------|-------------|
| `resolveApiBaseUrl` | Parses `VITE_API_BASE_URL` into `absent`, `refused`, or `configured`. Four refusals: unparsable, non-HTTPS on a public host, userinfo, query-or-fragment. An accepted base is rebuilt as `origin + pathname` with trailing slashes stripped |
| `probeCommandApi` | One `GET /health`, `credentials: 'omit'`, no headers, `cache: 'no-store'`, 8-second timeout. Returns a `ProbeRecord` whose `at` is **always** present, including on failure |
| `syncStatus` | Maps config + probe to `connected` / `disabled` / `awaiting_credentials`, with the sentence the page prints verbatim so the copy cannot drift from the state |
| `syncCapabilities` | The six capabilities as data. Exactly one is `implemented: true`, so the page cannot claim a capability the code does not have |

`refused` is reported as loudly as a failed probe. A build that configured
something this adapter will not call is a misconfiguration the operator needs to
see, not a silent fallback to `Disabled`.

Loopback `http:` is permitted, matching the exception the local model adapter
already makes: that is the operator's own machine, and refusing it would make
local development impossible for no security gain.

### `SyncPage.tsx` — the surface

Three states, one button, one recorded result, and a list of what it cannot do.
Five panels: the probe, the registry row it writes to, the six capabilities,
*Where the data actually is* (with a live count of demo rows), and *Why there is
no sign-in*.

The button is disabled when `canProbe` is false, and the text beside it names
the variable that would enable it. The state pill, the host, and `never probed`
sit in one strip under the header, so the three facts that matter are readable
without scrolling.

**The page never prints a record count it pulled, a last-sync time, or the word
*synced* about anything.** A test asserts the rendered DOM contains no *last
sync*, *records synced*, *sync complete*, or *up to date*.

## Settings — two different things called "demo mode"

"Demo mode" had come to mean two things across six waves: *there are badged seed
rows in the store*, and *there is no backend behind any of this*. Conflating
them is how an operator ends up believing their own records are somewhere else.

The new `ModePanel` separates them, and states plainly that only the first is a
switch they control:

- Two pills — `Demo-local` or `Local-first · API configured`, and `Demo seed on`
  or `Demo seed off` — which move independently.
- A live count: *N demo · M yours*.
- **Where records live** — this browser's IndexedDB and nowhere else; clearing
  site data is permanent.
- **What the demo seed is** — badged, illustrative, and removable.
- **What the Command API would change** — with a configured base URL, that
  pointing is *all* it does; without one, that nothing is waiting on a login,
  and this deployment says so rather than showing a sign-in that leads nowhere.

The `RoadmapPanel` also needed an honest empty state, because for the first time
`plannedModules()` returns nothing. It now reads *25 routed, 0 planned* and
explains **why** the list is empty — the last entry shipped, rather than unbuilt
work being quietly removed from it — then points at the roadmap and notes that
what comes next is mostly not modules.

`CredentialsPanel` gained one sentence: Connected means a recorded probe, and
the only probe this bundle can run is the one on `/sync`.

## Performance — TD-16

Measured against a **rebuild of `cf8c64d` on the current toolchain**, so both
columns are the same Vite, the same Rolldown, and the same machine.

| | Wave 6 (rebuilt) | Wave 7 |
|---|---:|---:|
| First-load JS | 692.21 kB / 210.16 kB gzip | **639.46 kB / 195.60 kB gzip** |
| First-load chunks | 9 | 13 |
| Deferred | 40 chunks | 42 chunks, 336.99 kB / 108.89 kB gzip |

**−52.75 kB raw, −14.56 kB gzip — and the Wave 1 target of under 200 kB gzip is
met for the first time**, in the wave that also added a module.

### Where it came from

**Deferring the demo seed is the entire win.** `seed.ts` is 60.35 kB of fixtures
that `repositories.ts` was importing eagerly for one constant: `SEED_VERSION`,
read on every boot to decide whether to reseed. Extracting that constant into a
ten-line `seedVersion.ts` and loading the fixtures through a dynamic `import()`
inside the already-`async` `seedDemoData` moves the whole chunk off the critical
path. A reload inside the seed's 12-hour window, or a store where demo data was
cleared, **never fetches it at all**.

**Vendor chunking moves no bytes** — it is the same code in four files instead
of one. What it changes is invalidation: editing a selector used to change the
hash of a chunk containing 442.84 kB of dependencies, and now re-downloads
~127 kB instead of ~365 kB. For a returning operator that is the more useful of
the two wins.

### One correction

The Wave 6 note and the Wave 6 debt paydown both record "one chunk-size
advisory (TD-16)". **Rebuilding `cf8c64d` emits no such warning**, because its
largest chunk was 364.83 kB — under Rollup's 500 kB default. The claim does not
reproduce and appears to have been carried forward from an earlier wave rather
than re-observed. It is corrected in `PERFORMANCE_REPORT.md` rather than
repeated here.

What remains under TD-16 is `vendor-react` at 86.21 kB gzip (only a smaller
framework moves it) and eager zod validation at 17.23 kB. Neither is urgent now
the target is met.

## CSP

GitHub Pages serves static files and lets nobody set a response header, so a
`<meta http-equiv>` in the built `index.html` is the only delivery available.

`src/lib/csp.ts` builds the policy as a pure function; the `sovereign-csp` Vite
plugin injects it. The plugin is `apply: 'build'` — **the dev server is
deliberately left alone**, because Vite's HMR client and the React Refresh
preamble are inline scripts that a correct `script-src 'self'` policy would
rightly refuse.

```
default-src 'self'; base-uri 'self'; script-src 'self';
style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self';
connect-src 'self'; manifest-src 'self'; worker-src 'self';
object-src 'none'; frame-src 'none'; form-action 'none'
```

The threat this is actually aimed at is **exfiltration, not XSS** — which was
already low, since nothing renders raw HTML. `connect-src 'self'` means a
compromised dependency has nowhere to send to.

`connect-src` is derived from the same `VITE_*` variables the adapters read
**and run through the same acceptance function** (`src/lib/endpoints.ts`), so
the policy and the code cannot disagree. Origins only, never paths, because CSP
matches path prefixes loosely and a policy naming a path looks narrower than it
is. As first shipped this section over-claimed — see the fix pack at the end of
this note.

Two things stated rather than glossed:

- **`style-src` keeps `'unsafe-inline'`** for the inline `<style>` in
  `index.html` that paints the background before the stylesheet arrives.
  Hashing it would move a silent white-flash regression onto whoever next edits
  that block, and inline *style* cannot execute.
- **`frame-ancestors` is emitted only in the header form.** Browsers ignore it
  in a meta tag, so clickjacking protection on Pages is **absent, not partial**.
  `csp.test.ts` asserts the meta form omits it, and `OPERATIONS.md` §6 documents
  the CDN or API-host options that would deliver it.

## Brief, search, and palette

- **Search** — an integration hit's subtitle now reads the *effective* state, so
  a search result and the registry row cannot disagree about whether something
  is connected. The Command API row routes to `/sync` rather than the full
  registry, following the Wave 6 rule that a row is read where it is explained.
- **Palette** — one entry, *Check the Command API adapter*. The surface entry
  for `/sync` is generated from `enabledModules()` automatically; this is the
  intent-phrased one. Parity tests still require every target to resolve to a
  served route and pass `isSafeInternalHref`.
- **Brief** — unchanged. A probe is not an attention item, a blocker, or
  leverage, and manufacturing a line for it would be the fake-inventory problem
  in miniature.

## Phase 17 documentation

Seven documents under `docs/`, written against measured facts rather than
intent — 30 stores, six migrations, 50 writers, two outbound `fetch` call sites,
639.46 kB first load, 29 connectors at 0/9/20.

| Document | Covers |
|----------|--------|
| `SYSTEM_ARCHITECTURE.md` | Layer map, the four invariants, boot and routing, the four boundaries, and a table of what the architecture deliberately does not have |
| `DATABASE.md` | Dexie 6 store inventory, all six migrations with their backfills, read/write paths, both halves of the probe invariant, the seed, and the known limits |
| `API.md` | The two outbound calls in full, then the Command API contract — marked as not built on every section |
| `MCP.md` | Five declared servers, zero clients, three independent reasons no MCP client can live here, and the target topology |
| `DEPLOYMENT.md` | The Pages pipeline, measured bundle composition, CSP delivery, service worker, verification checklist, and rollback |
| `OPERATIONS.md` | What can actually go wrong, runbooks, the honest security posture, and how to deliver CSP headers properly |
| `DEVELOPER_GUIDE.md` | Setup, adding a module end to end, the writer contract, the honesty rules, the invariant suites, and a review checklist |

This closes item 8 of `ARCHITECTURE_AUDIT.md` §10 — *docs listed in Phase 17
exist and match the running system* — and pays TD-12.

## Reports

All eight refreshed, and one discrepancy fixed rather than carried.

**Two readiness series had been running in parallel** — this repository's
`PRODUCTION_READINESS.md` headline and the `FEATURE_COMPLETION_MATRIX.md`
aggregate — and they had drifted **fourteen points apart** by Wave 6 (78 versus
64). A gap like that between two documents describing the same platform is the
exact failure the product refuses everywhere else.

Both series are retired. A per-category table that sums to its own total
replaces them, with Wave 6 rescored on the same basis so the delta means
something: **Wave 6 = 71, Wave 7 = 78.** Earlier waves are left blank rather
than back-fitted, because rescoring a wave nobody can re-measure would be
inventing history.

The +7: architecture clarity 9→10 (Phase 17), integrations honesty 7→9 (the
invariant), auth & security 2→4 (CSP and the adapter guards), quality gates 8→9
(+62 tests), docs/ops 4→5.

**It is not the ≥ 85 the roadmap targeted**, and the report says why rather than
adjusting to fit: that threshold was always gated on auth and live integrations,
both of which need a server. Of the remaining 22 points, roughly 20 are blocked
on the Command API.

## Verification

| Command | Result |
|---------|--------|
| `pnpm lint` | 0 errors, 0 warnings |
| `pnpm typecheck` | clean |
| `pnpm test` | **919 tests, 68 files, passing** (Wave 6: 857 / 64) — 945 / 69 after the fix pack |
| `pnpm build` | success — 639.46 kB first load, 42 lazy chunks, **no chunk-size advisory** |

62 tests were added, 48 of them in 4 new files:

- **`src/modules/sync/sync.test.ts` (20)** — every base-URL refusal
  (unparsable, plaintext on a public host, userinfo, query, fragment), loopback
  `http:` accepted, trailing-slash normalisation, the probe's request options,
  2xx / non-2xx / network-failure / no-fetch outcomes, a timestamp present on
  every result including failures, and the three-state mapping including a
  configured-but-unprobed build reading `Awaiting Credentials`.
- **`src/data/probe.mutations.test.ts` (9)** — the writer refuses an empty or
  unparseable timestamp, refuses an unknown id, refuses a `disabled` row, writes
  `connected` with `lastProbedAt` on success, writes `awaiting_credentials`
  **with the timestamp** on failure, stamps `touchedAt`, and writes the activity
  event.
- **`src/lib/csp.test.ts` (10)** — directive content, `frame-ancestors` present
  in the header form and absent from the meta form, connect sources appended and
  deduplicated, origin-only extraction, and non-HTTP schemes ignored.
- **`src/modules/sync/SyncPage.test.tsx` (9)** — Disabled with the button off and
  no fetch attempted, Awaiting Credentials for a configured build, Connected only
  after a successful probe, a failed probe staying Awaiting Credentials, the
  registry row rendering the effective state, and the no-fake-sync-language
  assertion.

The other 14 landed in existing suites: `state.test.ts` (+6, the downgrade in
every direction), `IntegrationsPage.test.tsx` (+2), `fuzzy.test.ts` (+2),
`mcp.test.ts` (+1), `health.test.ts` (+1), `registry.test.ts` (+1), and one from
`router.test.tsx`, whose `it.each` over `enabledModules()` expands to mount
`/sync` automatically.

Several existing fixtures had to be corrected rather than the invariant relaxed:
tests that built a `connected` row without `lastProbedAt` were asserting
behaviour the platform had just declared impossible. Each was given a real
probe timestamp where a genuine connection was intended, and new tests cover the
downgrade where it was not.

**Wave 4's content approval sync (M1), Wave 5's loopback endpoint policy (H1),
and Wave 6's metrics window fix (M1) are untouched and still green:**
`src/data/mutations.test.ts`, `src/modules/approvals/ApprovalsPage.test.tsx`,
`src/agents/providers/providers.test.ts`,
`src/modules/ai/AiWorkspacePage.localEndpoint.test.tsx`, and
`src/modules/metrics/metrics.test.ts` all pass unmodified.

## Deferrals (intentional)

1. **No authentication, and no groundwork for one.** Pages cannot verify a
   credential. A sign-in screen with nothing behind it is the single most
   dishonest thing a static bundle can ship, and a token store would be a
   published token store.
2. **No read-model.** Pulling records needs an API that serves them and a
   session that authorises the read. Neither exists, and **no remote record has
   ever entered this store.**
3. **No write-through and no offline queue.** A queue that never flushes is a
   pending-sync state that lies. It arrives with the endpoint that drains it.
4. **No conflict resolution.** One writer, one store, no conflicts. A second
   writer needs record versions and a merge policy *decided before* it exists.
5. **No credential vault, and no field to type one into.** Connector secrets
   belong on the Command API.
6. **No MCP client.** Three independent blockers, any one sufficient — see
   `MCP.md` §5.
7. **No `frame-ancestors`.** Undeliverable from Pages. Documented with the two
   options that would deliver it.
8. **No data export.** The largest genuinely available gap, and it needs no
   server. Named as the top item in the roadmap's *available now* section rather
   than left implicit.
9. **No retention on the activity log** (TD-20). Two unbounded tables, now with
   a third writer feeding one of them.
10. **Weekly Review is still not built** and is now the only audit-named module
    with no registry entry at all.

## Debt movement

| ID | Movement |
|----|----------|
| TD-16 | **Substantially paid.** Under the 200 kB gzip target for the first time. The advisory this item tracked does not fire and did not fire at Wave 6 either — corrected rather than repeated. |
| TD-12 | **Paid.** Seven Phase 17 documents, written against measured facts. |
| TD-10 | **Partly paid — the first probe in the platform's history.** Capped at 1 of 29 connectors, because the other 28 need a credential this bundle cannot hold. |
| TD-07 | **Partly paid, further.** The credential model is enforced, not asserted: both URL adapters refuse before sending, and only the host of a base URL is ever printed. |
| TD-03 | **Held, and reinforced.** The invariant removes the last place a *state* could be displayed without evidence. |
| TD-17 | **Held.** The probe writer stamps `touchedAt`. `SEED_VERSION` stays at `wave6.0` — nothing about the seed changed. |
| TD-19 | **Held.** One new writer, same shape, and the first that is also a gate. |
| TD-20 | **Larger, marginally.** Probes append to the same unbounded log. Highest-value unpaid item needing no server. |
| TD-21 | **Held.** A probe records `system` rather than `Operator`, arguably the first honest actor value in the codebase. Everywhere else is unchanged. |
| TD-24 | **Held, and now measured.** `index` is 127.42 kB raw / 37.26 kB gzip; declaring filter values as data is the largest remaining build win. |
| TD-13 | **Held.** `DEPLOYMENT.md` now exists here and is accurate here. |
| TD-18 | **Unchanged, owner-blocked.** |
| TD-05 / TD-06 / TD-08 / TD-09 / TD-15 | **Held.** All five need the Command API. Wave 7 built the adapter's boundary and declared what sits on the far side; it did not cross it. |
| TD-23 / TD-25 through TD-35 | **Held.** Untouched. |

**No new debt was filed.** One module, one writer, one build plugin, and ~850
lines of source, all built against existing contracts rather than beside them.
The one item that grew (TD-20) grew because an existing mechanism was used more.

## Deviations from the brief

1. **`/sync` is Operator, positioned between Integrations and Settings.** The
   brief did not specify placement. Declaration order drives nav and the router,
   and *what is connected → what connects it → what controls it* is the reading
   order.

2. **The invariant is enforced at read time as well as write time.** The brief
   asked for "connected requires `lastProbedAt`; tests reject
   connected-without-probe", which a writer check alone would satisfy. IndexedDB
   is hand-editable and rows already exist in operators' browsers, so a
   write-only check would have been a convention with better manners rather than
   an invariant.

3. **A schema refinement was rejected in favour of a read-time downgrade.**
   Refusing to load a row would lock an operator out of their own store, hiding
   the problem behind an error boundary rather than showing it.

4. **A failed probe writes `lastProbedAt` too.** The brief implies the timestamp
   is evidence *for* Connected. It is equally evidence that a check happened and
   failed, and dropping it would make a probed-and-broken connector
   indistinguishable from one never checked.

5. **`refused` is a distinct config state, reported as loudly as a failed
   probe.** A build that configured a base URL this adapter will not call is a
   misconfiguration the operator must see, not a silent fall-through to
   `Disabled`.

6. **The CSP is applied only to production builds.** A dev-server policy would
   break HMR, and a policy relaxed enough to permit HMR would not be the policy
   that ships.

7. **`SEED_VERSION` was not bumped.** Every prior wave bumped it. Wave 7 changed
   nothing about the seed's shape, and bumping would force every operator's
   store to rebuild its demo rows for no reason.

8. **Two readiness series were reconciled rather than continued.** The brief
   asked for an honest score. Producing one on top of two mutually contradictory
   histories was not possible, so both were retired and Wave 6 was rescored on
   the new basis.

9. **The performance claim about a chunk-size advisory was corrected.** Wave 6's
   record of it does not reproduce on rebuild. Repeating an unverified figure in
   a hardening wave would have been the wrong kind of continuity.

## Fix pack — the probe invariant reaches the action path, and the CSP stops out-running the adapters (G3 H1 + H2)

`docs/reviews/WAVE_7_GPT_REVIEW.md` held the wave on two findings. Both were the
same mistake in different clothes: Wave 7 claimed an invariant was structural
when it was still two copies of a rule that happened to agree.

### H1 — `automationReadiness` could run a rule from an unprobed row

The read-time downgrade shipped, and most consumers used it. Four did not, and
the serious one was not a pill:

```
src/domain/leverage.ts        automationReadiness  — action gate
src/data/mutations.ts         runAutomation        — via automationReadiness
src/modules/health/HealthPage.tsx        substrate pills
src/modules/content/ContentItemPage.tsx  publishing copy
```

`automationReadiness()` compared `integration?.state !== 'connected'`, so any
non-handoff rule naming a connector became **runnable** the moment a registry
row said `connected` — with or without the probe that is supposed to be the
whole meaning of the word. The same function drives the Automation Center
selector *and* `runAutomation`, so this was not display copy: a hand-edited
IndexedDB row could let a rule write a notification or open a gate on the
strength of a connection nobody verified, while `/integrations` three clicks
away showed the same row as Awaiting Credentials.

Two changes, one behavioural and one structural.

**The invariant moved into the domain.** `hasVerifiedProbe`,
`isUnverifiedConnectedClaim`, `effectiveIntegrationState`, and `isUsable` now
live in `src/domain/integrations.ts`; `src/integrations/state.ts` re-exports
them, so every existing import is unchanged. The move is the point: readiness
and action gating are domain decisions, `src/integrations/state.ts` imports
`@/domain`, and a helper the domain cannot import without a cycle is a helper
the domain quietly works around — which is exactly what happened.

`automationReadiness` now asks `isUsable`, and names the *effective* state in
its refusal. The credential-gap trigger, the Health substrate pills, the
publishing panel, `deriveSubstrateHealth`'s disabled filter, and the probe
writer's disabled guard all read through `effectiveIntegrationState` too.

**And the source is scanned.** A bypass reads perfectly naturally — nobody
reviewing `integrationStateMeta[integration.state]` sees a bug — so
`src/integrations/invariant.test.ts` globs every module under `src/`, strips
comments, and fails if anything but `src/domain/integrations.ts` reads
`integration.state`. `src/data/seed.ts` is the single listed exemption, because
seeding writes a state in rather than reading one out. Verified by
reintroducing the HealthPage bypass: the scan names the file.

### H2 — the CSP accepted origins the adapters refuse

`connectSourcesFromEnv()` ran the two `VITE_*` URLs through `originOf()`, a
local helper that accepted any parseable `http:` or `https:` URL. Both adapters
are stricter, so a configured build could put an origin in `connect-src` that
nothing in the app would ever request:

| Value | Adapter | Old `connect-src` |
|-------|---------|-------------------|
| `http://api.example.com` | refused — plaintext on a public host | `http://api.example.com` |
| `https://user:pw@api.example.com` | refused — userinfo | `https://api.example.com` |
| `https://api.example.com?api_key=abc` | refused — query string | `https://api.example.com` |
| `https://models.example.com` (local AI) | refused — not loopback | `https://models.example.com` |

The public no-env build was always `connect-src 'self'`, so nothing shipped
wrong. What was wrong was the claim: the docs said the policy and the code
cannot disagree, and a misconfigured hardened build would have handed a
compromised dependency a remote destination the app itself refuses to call —
the precise threat `connect-src` exists to close.

`originOf` is gone. The two acceptance rules now live in `src/lib/endpoints.ts`
as `acceptApiBaseUrl` and `acceptLoopbackEndpoint`, which return either an
accepted origin/base/host or a typed refusal reason. `resolveApiBaseUrl` and
`resolveLocalEndpoint` keep their wording and nothing else — each maps a reason
to the sentence it already printed — and `connectSourcesFromEnv` takes the
origin of an accepted check and nothing otherwise. There is one decision now,
asked in three places, rather than three checks that had to be kept in step by
inspection.

`src/lib/csp.ts` imports `./endpoints.ts` with its extension, and
`tsconfig.app.json` allows that for this one import: `vite.config.ts` loads the
CSP builder directly to write the policy at build time, and Vite's native config
loader requires every import beneath a config file to name its file.

### Verification

| Command | Result |
|---------|--------|
| `pnpm lint` | 0 errors, 0 warnings |
| `pnpm typecheck` | clean |
| `pnpm test` | **945 tests, 69 files, passing** (919 / 68 before the fix pack) |
| `pnpm build` | success, no chunk-size advisory |

26 regressions, one new file:

- **`src/lib/csp.test.ts` (+14)** — eight refused Command API values and five
  refused local-AI values, each asserted against *both* the adapter and the
  policy in the same case, so the two cannot drift apart again; plus origin-only
  extraction, the loopback exception, a half-refused build keeping its accepted
  half, and a policy built from a secret-bearing URL containing neither the
  secret nor the origin.
- **`src/domain/leverage.test.ts` (+4)** — a rule naming a `connected` row with
  no `lastProbedAt` is not runnable, nor one whose timestamp will not parse; the
  same rule *is* runnable once the row carries a real probe; and an unverified
  claim counts as a credential gap like everywhere else. The suite's fixture now
  gives a `connected` row a probe by default, so a test has to opt into the
  unevidenced shape.
- **`src/data/leverage.mutations.test.ts` (+2)** — `runAutomation` against a
  store row edited to `connected` with no probe records a `refused` run with
  reason `awaiting_credentials`, matches nothing, and writes no notification;
  the same rule applies once the row carries a probe.
- **`src/modules/health/HealthPage.test.tsx` (+2)** — every substrate row pills
  as Awaiting Credentials when the dataset claims Connected with no probe, and
  the header statement stays `offline`.
- **`src/modules/content/ContentItemPage.test.tsx` (+2)** — the publishing panel
  reads an unprobed LinkedIn row as Awaiting Credentials, and still refuses to
  publish when the row carries a verified probe.
- **`src/integrations/invariant.test.ts` (+2, new)** — the source scan above,
  plus a guard that the scan is actually looking at the source tree.

No product behaviour was added. The only user-visible change is that two
surfaces and one gate now agree with the registry about what Connected means.
