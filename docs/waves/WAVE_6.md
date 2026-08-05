# Wave 6 — Leverage Fabric

**Implementer:** Claude (Implementation Engineer)
**Plan:** `docs/IMPLEMENTATION_PLAN_WAVE_6.md`
**Architecture:** `ARCHITECTURE_AUDIT.md` §7 Wave 6
**Predecessor:** `docs/waves/WAVE_5.md` (G3 PASS after the H1 fix pack)
**Status:** complete — awaiting review

---

## What changed

Wave 5 made what the operation *knows* operable. Wave 6 makes what it *repeats*
and what it *measures* operable: four modules moved from `planned` to routed —
Automations, Mission Control, Business Metrics, Analytics — the Integration
Registry gained a second lens for MCP servers, and two Dexie stores appeared to
hold automation rules and the log of every time one was run.

The honesty pressure is different again. Wave 4 had to avoid faking a publish and
Wave 5 had to avoid faking a thought. Wave 6 has to avoid faking **agency**: a
rule that appears to run on its own, a connector that appears to have been
reached, a KPI that appears to have come from an accounting system. So the
constraints are structural rather than editorial.

- **No scheduler exists.** A rule evaluates when the operator asks for it, and
  every run records who asked. There is no timer, no service worker, and no
  wake-up path in the bundle, so a rule that is never run has never done
  anything — and the surface says exactly that.
- **The only actions in the domain are local ones.** `notify`, `open_approval`,
  and `log_only` write to this browser. The fourth, `handoff`, is the intention
  to reach an external system and it **always refuses**, naming the integration
  that would have to carry it. There is no `publish` and no `send` action to
  disable, because neither was ever defined.
- **Gated runs stop before the effect.** A rule with `requiresApproval` writes an
  approval and nothing else; the signal is written when — and only when — a human
  clears the gate through the existing Approval Queue.
- **Connected still means a verified probe.** The MCP panel reads its states from
  the same registry row `/integrations` reads, and nothing in this bundle opens a
  transport, so no MCP server is Connected and the panel explains why rather than
  leaving the reader to infer it.
- **Counted and declared are never averaged.** A mission carries both the
  progress figure the operator typed and the figure counted from linked tasks,
  printed side by side. Business Metrics keeps recorded metric rows in their own
  group, apart from every KPI derived from the domain.

## Enabled vs hidden

| Module | Route | Group | Wave | State |
|--------|-------|-------|------|-------|
| Morning Brief | `/` | Commander | 1 | enabled |
| Approval Queue | `/approvals` | Commander | 2 | enabled |
| Health Monitor | `/health` | Commander | 2 | enabled |
| **Mission Control** | **`/missions`** | **Commander** | **6** | **enabled (new)** |
| **Business Metrics** | **`/metrics`** | **Commander** | **6** | **enabled (new)** |
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
| **Automations** | **`/automations`** | **Operator** | **6** | **enabled (new)** |
| **Analytics** | **`/analytics`** | **Operator** | **6** | **enabled (new)** |
| Integrations | `/integrations` | Operator | 1 | enabled |
| Settings | `/settings` | Operator | 1 | enabled |

Twenty-four modules are enabled. **One remains `planned`** — Command API Sync
(Wave 7) — with no route, no nav entry, and a roadmap listing in Settings only.
`src/app/modules.test.ts` asserts both halves: every Wave 6 module is enabled by
id, and every module with `wave > 6` is still `planned`, so `/sync` stays
unrouted and the catch-all returns it to the brief.

Missions and Metrics sit under Commander: an objective nothing is serving and a
KPI that moved are things the operator looks at to decide, not surfaces they work
in. Automations and Analytics are Operator surfaces — one is a workbench, the
other is instrumentation.

### The MCP panel lives under Integrations — and why

The brief allowed `/mcp` or an Integrations sub-route. It is
**`/integrations/mcp`**, a sub-route registered in `subRoutes` with the id
`integrations-mcp`, reached from an `IntegrationTabs` strip modelled on the Wave 4
Content tabs.

An MCP server *is* an integration row. Giving it a module of its own would have
meant a second table of state, or a module reading another module's registry
while pretending to own it — and the failure mode of two state tables is that one
of them eventually says Connected while the other says Awaiting Credentials.
There is now one registry, read two ways: `/integrations` filters it, and
`/integrations/mcp` is the MCP lens with the transport and purpose each server
would carry. `src/integrations/mcp.test.ts` asserts the panel adds no row the
registry does not hold.

### Record routes (two new, nine total)

| Route | Record |
|-------|--------|
| `/automations/rule/:id` | One rule: what it watches, what it would do, and its whole run log |
| `/missions/mission/:id` | One objective: both progress figures, the work linked to it, and its blockers |

Both follow the Wave 4 rule that a segment names the record type. `automationHref`
and `missionHref` validate their own output and fall back to the list route, so a
link to a cleared row lands on "Not in the local store" rather than on a blank
page.

## Domain — `src/domain/leverage.ts`

| Type | Shape and the constraint on it |
|------|-------------------------------|
| `AutomationTrigger` | Eight local conditions: overdue task, content dated today and unpublished, stalled opportunity, overdue approval, overdue decision, memory review due, overdue research question, integration awaiting credentials. Each maps to a surface href, so a rule can always be checked by hand against the page it watches. |
| `AutomationAction` | `notify` (one inbox signal), `open_approval` (one gate), `log_only` (a run record and nothing else), `handoff` (an intention that refuses). There is deliberately no publishing or sending action. |
| `AutomationRule` | Trigger, action, `enabled`, `requiresApproval`, `impact`, `requiresIntegrationId`, notes, `lastRunAt`, `runCount`, `archivedAt`. Archived, never deleted. |
| `AutomationRun` | `ruleId`, `at`, `outcome`, `matched` count with `matchedIds`, a `detail` sentence, the `notificationId` or `approvalId` it wrote, `reason` when it refused, and `invokedBy`. Every run is recorded, including the ones that did nothing. |
| `AutomationOutcome` | `applied`, `gated`, `declined`, `no_match`, `refused`. A rule that matched nothing is logged as matching nothing; a rule that could not run is logged as refusing; a gate a human rejected is `declined`. |
| `AutomationReadiness` | Derived from the rule and the registry: `runnable` plus a reason (`disabled`, `handoff`, `missing_integration`, `integration_not_connected`) and a statement written for the operator. |
| `MISSION_TRANSITIONS` | One table: `active → blocked \| paused \| complete`, `blocked → active \| paused`, `paused → active`, and **nothing out of `complete`**. A finished objective is history. |

`evaluateAutomation` is the single trigger evaluator, and both the page and
`runAutomation` call it — which is why the count a row prints is the count the
run would act on. `automationReadiness` is likewise shared, so a rule the page
shows as unable to run is a rule the mutation refuses.

Two entity changes in `src/domain/entities.ts`: `Mission` gained `dueAt` and
`successMeasure` (an objective with no measure cannot be said to have been met,
and the page says so), `Approval` gained `automationRunId`, and `Opportunity` and
`Campaign` gained `missionId` so revenue and reach can point at an objective.

## Data

**Dexie version 6** adds `automations` and `automationRuns`, re-declares
`opportunities` and `campaigns` with a `missionId` index, and runs one upgrade:
backfilling `successMeasure` to an empty string on existing missions. A version-5
store keeps every row it had.

### Seed (`SEED_VERSION = 'wave6.0'`)

Seven automation rules and seven runs, chosen so the run log shows every outcome
rather than a wall of successes: two applied runs that each wrote the inbox signal
they claim, two gated runs whose approvals are in the queue with
`automationRunId` pointing back, one `log_only` run, one `no_match` run recorded
anyway, and one `refused` hand-off naming n8n. Three missions gained due dates,
success measures, and links from tasks, projects, opportunities, campaigns, and
content — including one blocked objective whose blocker is the same n8n
credential gap the refused run names, so the two surfaces tell one story.

Two vendor MCP rows joined the catalog (`github-mcp`, `notion-mcp`), both
`disabled` **by choice** rather than awaiting anything, which keeps the
awaiting-credentials count at 20 while making the panel show the state that means
"we decided against this". The catalog is 29 connectors, 5 of them MCP.

## Mutations

`src/data/mutations.ts` is still the only write path; Wave 6 adds eight writers.
Each stamps `touchedAt`, writes an `automation`-channel event, and returns
`{ ok, reason }` or the created record.

- **Rules** — `createAutomationRule` (gated by default, `runCount: 0`),
  `setAutomationEnabled`, `archiveAutomationRule` (which also disables, and keeps
  every run).
- **Runs** — `runAutomation` and `runEnabledAutomations`. One pass, one
  transaction per rule.
- **Missions** — `captureMission` (allocating the next `MSN-0xx` code),
  `setMissionStatus` (through `canTransitionMission`, refusing `blocked` with no
  reason written), `declareMissionProgress` (clamped 0–100, and labelled as a
  declaration everywhere it is rendered).

`runAutomation` is where the fabric's honesty is enforced, and it has four exits:

1. **Cannot run** — disabled, a hand-off, or an integration that is missing or
   not connected. It writes a `refused` run naming the reason and returns. This
   is the only outcome a `handoff` rule can ever have.
2. **Nothing matched** — a `no_match` run with `matched: 0`. Recorded, because a
   fabric that silently does nothing is worse than one that says it did nothing.
3. **Gated** — an approval is written with `automationRunId`, and the run is
   `gated`. **No notification is written.** Deciding that gate is what writes it.
4. **Applied** — the local effect happens in the same transaction as the run
   record, so the log and the store cannot disagree.

The gate resolution runs through the existing queue: `decideApproval` now looks
for an approval carrying an `automationRunId` and, on approval, writes the
notification the run deferred and flips the run to `applied`; on rejection the run
becomes `declined` and nothing is written. Reopening a gate returns the run to
`gated` — unless the signal was already written, in which case it refuses with the
reason, because reopening a gate cannot unwrite what clearing it wrote. The
deferred signal repeats the summary the gate held rather than re-evaluating the
trigger, so what a human approved is what lands. **The Wave 4 content branch is
untouched** — the automation branch is a separate lookup, and
`src/data/mutations.test.ts` and `src/modules/approvals/ApprovalsPage.test.tsx`
pass unchanged.

## The four surfaces

- **`/automations`** — rules grouped runnable, cannot-run, off, with the
  matching-record count on each row and a run log underneath. The action button
  reads *Run now* or *Record the refusal* depending on readiness, so clicking it
  can never do something the row did not advertise. A panel states the four
  things a rule cannot do here: publish or send, run on a timer, write past a
  gate, or reach n8n.
- **`/missions`** — objectives with the declared and counted figures side by side,
  a "Nothing serves it" badge when no local record points at an objective, and
  the blockers of the work beneath it collected onto the objective. The counted
  figure reads `—` rather than `0%` when nothing is linked, because those are
  different facts.
- **`/analytics`** — activity by day (fourteen bars whatever the window, since a
  hundred one-pixel bars is decoration), channel mix, throughput per surface
  split into created and touched, six loop readings each carrying the sentence it
  was counted from, and the demo-versus-operator provenance of the whole store.
  The page states its own blind spots: nothing observes the operator, there is no
  beacon or session recording, and a quiet day and an unrecorded day look
  identical.
- **`/metrics`** — five KPI groups (revenue and pipeline, delivery, content
  throughput, gates and leverage, and declared metrics). Every card prints its
  basis, its sample size, a demo badge when demo rows fed it, and *too small to
  read as a trend* under five rows. Rates refuse rather than round: a win rate
  with nothing closed is `—` with the reason, and a publishing cadence over the
  all-time window is `—` because an unbounded window has no denominator.

## Integration Registry polish

Both filters live in the URL, so a filtered registry is a shareable link: state
and category compose, and an empty result says which pair matched nothing rather
than showing an empty table. Each row now prints `probed <date>` or **never
probed** — with no probe anywhere in the platform, that column reads "never
probed" for all 29 rows, which is the point. No credential, endpoint, or token
appears on either surface, and the page still says where credentials do live.

## Brief, search, and palette

- **Attention** takes automation gates as a **single aggregate line** — *N
  automation gates are waiting on you* — and excludes those approvals from the
  per-record rows, so a rule cannot flood the section it is reporting into.
  `ATTENTION_LIMIT` rose 12 → 14 to hold the aggregate without displacing the
  record-level rows Wave 4 and 5 put there.
- **Blocked** gained *N automation rules cannot run*, linking to
  `/automations?state=blocked`, and Mission Control's blocked objectives.
- **Leverage** gained *X of Y automation runs did something*, inserted after the
  insight so it survives the section's own truncation.
- **Search** gained the `automation` kind and routes missions through
  `missionHref`; MCP integration hits route to `/integrations/mcp` rather than to
  the full registry.
- **Palette** gained seven entries: two actions (*Automations that cannot run*,
  *Objectives that are blocked*) and five surfaces (Automations, Mission Control,
  Business Metrics, Analytics, MCP Servers). The parity tests still hold: every
  target resolves to a served route and passes `isSafeInternalHref`.

## Href safety and lazy routes

`ALLOWED_QUERY_PARAMS` declares `state` on `/automations`, `status` on
`/missions`, `window` on `/analytics` and `/metrics`, and adds `category`
alongside `state` on `/integrations`. Every value comes from the selector module's
own filter constant, so a filter cannot exist in a module and be rejected by the
allowlist.

All seven new pages are `React.lazy` and registered in `src/app/lazyModules.ts`.
`src/app/router.test.tsx` mounts every enabled module, sub-route, and record
route, so a broken lazy import fails the suite rather than the browser.

## Code splitting

| | Wave 5 | Wave 6 |
|---|---:|---:|
| First-load chunks | 645.71 kB / 199.57 kB gzip | 692.18 kB / ~210 kB gzip |
| Deferred route chunks | 32 chunks, 205.01 kB / 65.40 kB gzip | 40 chunks, 262.05 kB / ~85 kB gzip |

The seven new page chunks hold 54.5 kB deferred — Automations 11.2 kB, Mission
detail 8.6 kB, Missions 8.3 kB, MCP 8.0 kB, Analytics 7.8 kB, the rule detail
7.3 kB, Metrics 3.4 kB. The first load grew 46.5 kB, most of it the larger seed
and the leverage schemas, both eager because the store opens at boot. The 500 kB
advisory stands; the shared chunk is still React, React Router, Dexie, and Zod,
and only the Wave 7 vendor-chunking pass moves it.

## Verification

| Command | Result |
|---------|--------|
| `pnpm lint` | 0 errors, 0 warnings |
| `pnpm typecheck` | clean |
| `pnpm test` | **853 tests, 63 files, passing** (Wave 5: 644 / 49) |
| `pnpm build` | success — 692.18 kB first load + 40 lazy chunks, one chunk-size advisory (TD-16) |

209 tests were added, 199 of them in 14 new files:

- `src/domain/leverage.test.ts` (25) — trigger evaluation across every readiness
  state, gate helpers, hand-off refusal, stall and past-due arithmetic, and the
  mission transition table including the closed door out of `complete`.
- `src/data/leverage.mutations.test.ts` (31) — the four run exits, the
  notification a gated run defers and the approval it writes instead, the gate
  decision writing that notification and flipping the run to `applied`, rejection
  landing `declined` with nothing written, run counts and stamps, mission code
  allocation, a blocked move refused with no reason, progress clamping, and
  `touchedAt` on every writer. Includes an assertion that the Wave 4 content gate
  path is untouched.
- Selector suites — `automations` (18), `missions` (16), `analytics` (20),
  `metrics` (24), `mcp` (12): filters and grouping, run ordering, gate lookup,
  rollups that count links without double-counting, window arithmetic, medians
  over means, KPI bases and sample sizes, and the MCP state ordering.
- Page suites — Automations (8), the rule detail (7), Missions with the objective
  detail (10), Analytics (7), Metrics (8), the MCP panel (6), and the registry
  (7), all clicking through against a real IndexedDB.

The remaining 10 landed in the registry, href, router, and brief suites. **Wave
4's content approval sync (M1) and Wave 5's loopback endpoint policy (H1) are
untouched and still green:** `src/data/mutations.test.ts`,
`src/modules/approvals/ApprovalsPage.test.tsx`,
`src/agents/providers/providers.test.ts`, and
`src/modules/ai/AiWorkspacePage.localEndpoint.test.tsx` pass unchanged.

## Deferrals (intentional)

1. **No scheduler, and no groundwork for one.** Runs are operator-invoked. A
   timer in a static bundle would fire only while a tab is open, which is a
   scheduler that lies about when it ran.
2. **No live n8n publish.** The `handoff` action exists to record the intention
   and always refuses. It becomes real when the Command API can hold a
   credential (Wave 7), not before.
3. **No MCP client.** No transport, no handshake, no tool enumeration. The panel
   reports registry state and declared intent; Connected requires a probe that
   has to run somewhere able to hold a credential.
4. **No custom trigger conditions.** A rule picks from the eight triggers the
   domain declares. A predicate builder means storing an expression and
   evaluating it, which is a language and a sandbox, not a wave item.
5. **No rule chaining.** One rule, one action. A rule that fires another needs
   loop detection and a run tree, and there is nothing to gain from it while
   every run is invoked by hand.
6. **No mission forecasting.** Both progress figures are counts. Predicting
   whether an objective will be met is a model task, and no model runs here.
7. **No link editor for missions.** Seeded links are rich; the capture form
   collects the objective's own fields. Attaching a deal to an objective from the
   UI needs the same form layer TD-25 waits on.
8. **No cost, margin, or cash figures.** Nothing in the store records them, and
   `/metrics` names their absence rather than deriving a proxy.
9. **Weekly Review is not built.** It appears in the matrix at 0 and is neither
   registered nor hinted at in navigation.
10. **Command API Sync** remains registered, planned, and hidden.

## Debt movement

| ID | Movement |
|----|----------|
| TD-05 | **Held.** Automations act on the local store only; nothing here reads or writes ContentDone's JSON. |
| TD-07 | **Held, and better stated.** The MCP panel names the Command API as the only place a token can live, and the registry surfaces still hold none. |
| TD-15 | **Partly paid, further.** Named agents with roles are still absent, but there is now a rule fabric with declared triggers, declared actions, readiness derived from the registry, and a run log — the mechanism an agent would be given rather than a label. |
| TD-16 | **Held, larger.** Seven new page chunks keep 54.5 kB out of the first load, which nonetheless grew to 692.18 kB. Vendor chunking (Wave 7) still owns the advisory. |
| TD-17 | **Held.** All eight Wave 6 writers stamp `touchedAt`; a defined rule, a declared progress figure, or an opened objective survives the 12-hour reseed. |
| TD-19 | **Held.** Eight new writers in the same module, keeping the `{ ok, reason }` shape. |
| TD-20 | **Larger.** Automation runs write to the same unbounded activity log, and the run log itself is a second unbounded table. Retention remains Wave 7. |
| TD-03 | **Held.** Every KPI and reading carries its basis and sample size, refuses when the denominator is zero, and says *too small to read as a trend* under five rows. Declared metric rows are quarantined in their own group. |
| TD-21 | **Held, and more visible.** `invokedBy` on a run is the same hard-coded `Operator`. A run log is the second surface where the actor genuinely matters. |
| TD-23 | **Held.** `automationHref` and `missionHref` validate id shape, not existence. |
| TD-24 | **Larger.** The allowlist now reads filter constants from four more selector modules plus the integration category list. Same Wave 7 fix. |
| TD-26 | **Unpaid.** Nominally due this wave. No automation touches the compliance policy, and versioning it is still coupled to the content approval path. |
| TD-27 | **Unpaid.** Content readings are still assumed cumulative; `/metrics` reads them and says they were entered by hand, which makes the assumption visible without fixing it. |
| TD-28 | **Partly paid.** The MCP sub-route gets the same tab strip Content has, so a sub-route is at least visible from its module. The sidebar still highlights only the module. |
| TD-29 / TD-30 / TD-31 | **Held.** Untouched by this wave. |
| TD-10 | **Unchanged.** Still no probes. Every MCP row and every connector reads *never probed*, which is now printed rather than implied. |

## New debt

| ID | Debt | Severity | Note |
|----|------|----------|------|
| TD-32 | Automation triggers are evaluated by scanning whole tables | Low | `evaluateAutomation` filters the full collection per rule, and `runEnabledAutomations` does that once per rule in sequence. Correct and instant at demo scale; O(rules × rows) at any other. |
| TD-33 | A gated run holds its deferred effect implicitly | Low | What a gated run will write is recreated from the rule when the gate is decided, rather than stored on the run. If the rule's action or trigger is edited while its gate is open, the effect the operator approved is not necessarily the effect that lands. |
| TD-34 | Mission progress has two numbers and no reconciliation | Low | Declared and counted are printed side by side by design, but nothing prompts the operator when they diverge badly, and nothing records why they differ. |
| TD-35 | Analytics windows are computed per selector | Low | `analytics.ts` and `metrics.ts` each carry their own window parsing, start-of-window arithmetic, and median. Two implementations of the same three functions will drift. |

## Deviations from the brief

1. **The MCP panel is `/integrations/mcp`, not `/mcp`.** The brief allowed
   either. One registry read two ways cannot disagree with itself; two modules
   holding state about the same servers eventually would. The panel is a lens,
   and `src/integrations/mcp.test.ts` asserts it invents no row.
2. **`ATTENTION_LIMIT` rose from 12 to 14, and automation gates are one
   aggregate line.** Seven rules with gates would otherwise have pushed the
   stalled opportunity and the content gate out of the section. A rule reporting
   into attention must not be able to crowd out what it is reporting about.
3. **Two vendor MCP rows were added as `disabled`, not `awaiting_credentials`.**
   A vendor server the operation decided against is not a server waiting on a
   key, and inflating the awaiting count would have made the credential gap look
   larger than it is.
4. **The activity chart is fixed at fourteen days regardless of the window.**
   The window still filters every other figure on the page. Ninety one-pixel bars
   would be decoration, and the chart says which range it covers.
5. **`Mission` gained `successMeasure` as a required field with an empty
   default.** The brief did not ask for it. An objective with no stated measure
   cannot be said to have been met, and the detail page prints that sentence
   instead of implying a definition exists.
6. **`declareMissionProgress` is a separate writer from `setMissionStatus`.**
   Declaring a number and changing state are different claims, and keeping them
   apart is what lets the UI label one of them as declared.
7. **A `handoff` rule can be defined, enabled, and run.** It always refuses.
   Hiding the action would have hidden the boundary; a rule that records "n8n is
   awaiting credentials and nothing was sent" teaches the operator more than an
   action that does not appear in the list.
8. **Analytics and Metrics are two modules, not one.** Product instrumentation
   and business KPIs answer different questions, carry different caveats, and are
   read by the operator in different moods. Each links to the other.
