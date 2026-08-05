# Remaining Issues

**Last updated:** Wave 7 (Production Hardening).
**Companion:** [`TECHNICAL_DEBT.md`](./TECHNICAL_DEBT.md) for the numbered debt
register, [`PRODUCTION_READINESS.md`](./PRODUCTION_READINESS.md) for the score.

This file lists what is genuinely wrong or genuinely missing. Deliberate
absences are in §4, separated from the rest, because "we chose not to build
this" and "this is broken" are different facts and a list that mixes them is
useless for planning.

---

## 1. Blocking a business-OS claim

Each of these prevents the platform from being described as an operating system
for a business rather than a tool one person runs in one browser.

### 1.1 No authentication, and none is possible here

There is no account, no session, and no identity. `invokedBy` and `decidedBy`
are the hard-coded string `Operator` (TD-21).

This is not an oversight to schedule. GitHub Pages cannot verify a credential,
and a sign-in screen with nothing behind it is worse than none. Auth arrives
with the Command API or not at all.

**Blocks:** private data, multi-device, attribution, every credentialed
connector, MCP.

### 1.2 No remote persistence, and no export

Every record lives in one browser's IndexedDB. There is no server copy, no
second device, and — the sharper problem — **no export of any kind**. The
Settings controls delete; they do not serialise.

An operator who clears site data loses everything they authored, permanently.
Every surface says so, which makes the platform honest but does not make the
data safe.

**Note:** a JSON export is the one item in this section that needs no server. It
is genuinely available work and is the cheapest risk reduction on this list.

### 1.3 No connector can be connected

28 of the 29 registry rows have no probe path that could ever run from this
bundle, because probing them requires a credential and a static bundle cannot
hold one. Their states are declarations of intent.

Wave 7 fixed the *integrity* of this — `connected` now requires evidence, and an
unevidenced claim is downgraded everywhere it is read — without changing the
*substance*: the count of genuinely verifiable connectors went from zero to one.

**Blocks:** publishing, CRM sync, calendar sync, hosted AI, MCP, and the
automation `handoff` action, which correctly refuses every time.

### 1.4 No hosted AI

Only a loopback local model can run. The four hosted adapters exist behind the
kernel interface, report `awaiting_credentials`, name the row that would fix
them, and contain no code path that produces text. A key would have to live
server-side.

---

## 2. Real gaps that need no server

Available work, in rough order of value.

| Gap | Impact | Notes |
|-----|--------|-------|
| **No data export** | High | The only self-serve recovery an operator could have. JSON serialisation of the 30 stores; no new infrastructure |
| **No retention on `events` or `automationRuns`** (TD-20) | Medium | Both grow without bound. No cap, no pruning, no archive. "Reset the store" is the only tool that bounds them today |
| **No coverage measurement** | Medium | 919 tests and no idea what they miss. `--coverage` is one flag and one CI threshold |
| **No end-to-end suite** | Medium | Every test runs in jsdom. Nothing exercises a real browser, a real service worker, or the real CSP |
| **No version stamp in the bundle** | Low | A deployed surface cannot report which commit it is, which makes a field bug report ambiguous |
| **No performance budget in CI** | Low | The first load is measured by hand each wave. A budget would catch a regression at PR time |
| **Weekly Review unbuilt** | Low | The only module named in the audit with no registry entry at all. Scores 0 and is not hinted at in navigation |
| **No blocked-reason capture** (TD-25) | Low | `setContentStatus` can write `blocked`, but no surface collects why |
| **Duplicated window arithmetic** (TD-35) | Low | `analytics.ts` and `metrics.ts` each carry their own window parsing and median. Two implementations of the same three functions will drift |

---

## 3. Known correctness limits

Things that are correct today under assumptions that are not enforced.

| Limit | Assumption | Risk |
|-------|-----------|------|
| TD-27 | Content metric readings are cumulative | Nothing enforces it. A platform reporting deltas would be summed wrongly, and `/metrics` would show a plausible incorrect figure rather than refusing |
| TD-33 | A gated automation run recreates its deferred effect from the rule at decision time | Editing a rule while its gate is open means the effect approved is not necessarily the effect that lands |
| TD-34 | Declared and counted mission progress are printed side by side | Nothing prompts when they diverge badly and nothing records why |
| TD-23 | Record hrefs validate id shape, not existence | A link to a cleared record lands on "Not in the local store" — degraded rather than wrong, but still a dead link |
| TD-31 / TD-32 | Backlinks and automation triggers scan whole tables | Instant at demo scale, `O(rows)` per query at any other. There is no pagination or virtualisation anywhere |
| TD-26 | The compliance policy is hard-coded and unversioned | An approval recorded under one policy cannot be distinguished from one recorded under another |
| — | The in-memory dataset holds every row | The whole store is read at boot. Correct for thousands of rows, wrong for hundreds of thousands |

---

## 4. Deliberate absences — not issues

Listed so nobody schedules them as bugs.

| Absent | Why |
|--------|-----|
| Scheduler for automations | A timer in a browser tab fires only while the tab is open, which is a scheduler that lies about when it ran |
| Publishing or sending from this bundle | No `publish` or `send` action was ever defined in the domain. There is nothing to disable |
| Analytics or error beacons | Nothing observes the operator, and an error reporter would carry their data off-device |
| Server-side rendering | Pages cannot run code, and nothing here needs SEO or a fast cold TTFB |
| Multi-tenancy | Single-operator excellence first. Tenancy is a data-model decision, not a flag |
| Rule chaining, custom trigger predicates | A rule that fires another needs loop detection and a run tree; a predicate builder is a language and a sandbox |
| Mission forecasting | Both progress figures are counts. Predicting is a model task, and no model runs here |
| `'unsafe-inline'` in `script-src` | No scenario in this architecture requires it |

---

## 5. Operational and process

| Item | Owner |
|------|-------|
| **TD-18 — Pages source must be set to GitHub Actions** | Repository owner. Nothing in this repo can assert it, and until it is set the workflow succeeds while nothing ships |
| **No staging environment** | `main` is production. The four CI gates are the only barrier between a merge and the live site |
| **`frame-ancestors` cannot be delivered** | Browsers ignore it in a meta tag, so clickjacking protection on Pages is absent, not partial. Needs a CDN in front or the API host. Low risk while there is no session; **must land before private data does** |
| **No release tagging** | Waves are recorded in `docs/waves/`, but nothing tags a deploy |

---

## 6. Resolved since the Wave 0 baseline

The original nine baseline issues, for the record:

| # | Baseline issue | Status |
|--:|----------------|--------|
| 1 | No application source tree — poster only | **Resolved** W1. 177 files, 27,870 lines; the poster is archived at `legacy/` and not built |
| 2 | All navigation dead (`href="#"`) | **Resolved** W1. Every nav entry routes, and `href.test.ts` asserts the allowlist matches the router |
| 3 | Fake health / missions / approvals / pulse | **Resolved** W1–2. Health derives from the registry and reports `offline` because that is true |
| 4 | No database, auth, search, palette, agents, MCP | **Partly resolved.** Database, search, palette, agent kernel, and an MCP panel all ship. **Auth does not, and cannot here** — see §1.1 |
| 5 | Operational systems siloed in ContentDone + LeadScheduler | **Partly resolved.** Both domains are modelled once in `src/domain`. The cross-repo contract still needs the Command API |
| 6 | No CI, tests, types, lint | **Resolved** W1. Four blocking gates on every branch, PR, and deploy |
| 7 | Content OS spec not recoverable | **Resolved** W4. Reconstructed from ContentDone and the mission brief |
| 8 | Public Pages cannot hold privileged secrets | **Unchanged and unchangeable.** Now designed around rather than worked around: nothing reads a key from the environment, both URL adapters refuse credentials in a URL, and the CSP ships `connect-src 'self'` |
| 9 | Wave 0 awaiting acceptance | **Resolved.** Waves 1–6 gated; Wave 7 is this one |
