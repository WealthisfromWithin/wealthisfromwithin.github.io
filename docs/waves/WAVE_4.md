# Wave 4 — Content Operating System

**Implementer:** Claude (Implementation Engineer)
**Plan:** `docs/IMPLEMENTATION_PLAN_WAVE_4.md`
**Architecture:** `ARCHITECTURE_AUDIT.md` §5.8, §7 Wave 4
**Predecessor:** `docs/waves/WAVE_3.md` (G3 PASS, fix pack applied)
**Status:** complete — awaiting G2 review (GPT-5.5) and G3 gate (Grok)

---

## What changed

Wave 3 made money motion operable. Wave 4 makes **the thing that produces the
money motion** operable: `/content` is now a loop — capture, draft, gate,
schedule, record, learn — rather than a list of posts. One module became a hub
with five nested surfaces and a package detail route, seven Dexie stores
appeared, and the content status enum grew from six values to eight with an
explicit transition table behind it.

The through-line is **what the store can honestly claim**. Nothing here calls a
publishing provider, because nothing on this surface holds a credential that
could. So "publish" splits in two: a disabled *Publish now — awaiting
credentials* button that names why it cannot run, and *Record publish*, which
writes down a publish the operator performed somewhere else. Performance is a
sum over `contentMetrics` rows someone typed or the seeder wrote; an item with
no reading shows no performance instead of a zero that reads like a result. The
compliance gate is a fixed keyword list matched in the browser, and it says so
in the panel that renders it.

## Enabled vs hidden

| Module | Route | Group | Wave | State |
|--------|-------|-------|------|-------|
| Morning Brief | `/` | Commander | 1 | enabled |
| Approval Queue | `/approvals` | Commander | 2 | enabled |
| Health Monitor | `/health` | Commander | 2 | enabled |
| Inbox | `/inbox` | Operator | 2 | enabled |
| CRM | `/crm` | Operator | 3 | enabled |
| Pipeline | `/pipeline` | Operator | 3 | enabled |
| Tasks | `/tasks` | Operator | 3 | enabled |
| Projects | `/projects` | Operator | 3 | enabled |
| Calendar | `/calendar` | Operator | 3 | enabled |
| Meetings | `/meetings` | Operator | 3 | enabled |
| **Content OS** | **`/content`** | **Operator** | **4** | **enabled (new)** |
| Integrations | `/integrations` | Operator | 1 | enabled |
| Settings | `/settings` | Operator | 1 | enabled |

Thirteen modules are enabled. Nine remain `planned` (knowledge, research, ai,
decisions, missions, automations, metrics, analytics, sync): no route, no nav
entry, roadmap listing in Settings only. `src/app/modules.test.ts` asserts every
module with `wave > 4` is still `planned` and derives the expected router
children from the registry.

### Sub-routes (new registry concept)

A module with sub-routes is a **hub**: one sidebar entry, tabs on the pages
themselves. `subRoutes` in `src/app/modules.ts` is the single table the router,
the href allowlist, and `ContentTabs` all build from.

| Route | Surface |
|-------|---------|
| `/content` | Production queue, filtered by status and format |
| `/content/ideas` | Idea Vault — capture, score, promote, park |
| `/content/calendar` | Publishing calendar by publish date, plus the undated |
| `/content/campaigns` | Campaign rollups counted from the items pointing at them |
| `/content/library` | Hooks, CTAs, assets, templates behind `?type=` |
| `/content/analytics` | Recorded readings, groupings, learning, monthly windows |
| `/content/item/:id` | Package detail (record route) |

Sub-routes never appear in navigation, so the Content OS adds one nav row, not
seven. `findModuleByPath` now falls back to longest-prefix matching, so the
Topbar names the module on a sub-route or a detail page instead of falling back
to "Sovereign".

### Route consolidation choices (the brief asked for these to be documented)

1. **The four libraries are one route.** The brief offered
   `/content/assets`, `/content/templates`, `/content/hooks`, `/content/ctas`
   or a consolidated `/content/library?type=…`. Consolidated: the four tables
   are the same shape (a line of copy or a title, a note, a usage count), so
   four routes would have been four near-identical pages and four more nav
   decisions. The filter is URL-backed and declared in the href allowlist.
2. **Package detail is `/content/item/:id`, not `/content/:id`.** A bare
   `/content/:id` would make `/content/ideas` indistinguishable from a package
   whose id happens to be `ideas`, and would force `isSafeInternalHref` to
   accept any single segment under `/content`. The `item` segment keeps the
   namespace unambiguous for both the router and the allowlist.
3. **Video tracking is a format filter, not a route.** Video and short items
   carry `videoScript` and `durationSeconds` and appear in the queue under
   `?format=video|short`, with the script rendered on the package. A separate
   video route would have been the same queue with one filter pre-applied.
4. **Repurposing is a link, not a surface.** `parentId` renders as "cut from …"
   on the child and a list of cuts on the parent. There is nothing to show on a
   repurposing page that is not already on the two packages it relates.

## Domain and data

| Change | Why |
|--------|-----|
| `ContentStatus` extended | Wave 1 had `idea, drafting, review, scheduled, published, blocked`. Now `idea, drafting, in_review, approved, scheduled, published, archived, blocked`. `review → in_review` matches the brief; `drafting` and `blocked` are kept because the existing enum and seed use them, and a blocked package needs somewhere to sit. |
| `CONTENT_TRANSITIONS` + `canTransitionContent` | The status machine as one table in `src/domain/entities.ts`. Both the write path and the detail page's action bar read it, so the buttons offered and the moves permitted cannot drift apart. |
| `ContentIdea` | Vault entry with `reach`, `effort`, `confidence` (1–5), `origin`, `status`, and `promotedItemId` once it becomes a draft. |
| `Campaign` | `objective`, `goal`, `status`, `startAt`/`endAt`. Counts are never stored on it. |
| `ContentAsset`, `ContentTemplate`, `Hook`, `Cta` | Reusable material. Each carries notes and, for hooks, a `style`; performance groups by that style. |
| `PlatformVariant` | Embedded on `ContentItem` rather than a table of its own: a variant has no life outside the package, and the brief allows either. |
| `ContentMetric` | A **reading**, in its own store: `contentItemId`, `platform`, `capturedAt`, impressions/engagements/clicks/conversions, and `method` recording how it was obtained. A separate store keeps history, which is what makes a month-over-month comparison possible without inventing one. |
| `ContentItem` extended | `format`, `platform`, `body`, `videoScript`, `durationSeconds`, `ideaId`, `campaignId`, `parentId`, `templateId`, `hookId`, `ctaId`, `assetIds`, `variants`, `approvalId`, `publishedAt`, `complianceCheckedAt`, `complianceSummary`, `tags`. |
| Dexie version 4 | Seven new stores with indexes on the fields the selectors query (`contentMetrics.contentItemId`, `campaigns.status`, `contentIdeas.status`, `contentItems.format/campaignId/parentId/ideaId`). The upgrade rewrites `review` to `in_review` and defaults the new columns, so a v3 store opens without losing a row. |
| `SEED_VERSION = 'wave4.0'` | 5 ideas, 13 content items across every status, 3 campaigns, 5 hooks, 4 CTAs, 4 assets, 3 templates, 6 metric readings. |

The seed covers the whole loop rather than a snapshot of it: an idea already
promoted to the draft that references it, a package in review holding the
seeded LinkedIn approval gate, an approved package waiting on a date, two
scheduled items (one due today), a blocked newsletter whose reason is the
missing webhook credential, four published items, a short cut from a published
essay, and an archived carousel. Readings are cumulative and land in both the
current and previous 30-day windows, so the monthly comparison has two real
sides.

### Layering correction

`checkContent` and the status machine started in `src/modules/content/`, which
would have made `src/data/mutations.ts` import from a module — the first
data→module dependency in the codebase. Both moved down: the transition table
to `src/domain/entities.ts`, the keyword policy to `src/domain/compliance.ts`.
Policy is doctrine, not a view concern, and the data layer now still imports
only `db` and `domain`.

## Mutations

`src/data/mutations.ts` remains the only write path. Every content writer
returns `{ ok, reason?, compliance? }` rather than a bare boolean, because the
queue's buttons are driven by a status machine and a gate: "nothing happened"
is never a sufficient answer for a refused move.

- `setContentStatus(id, status, { blockedReason })` — the plain moves (into
  drafting, back to the vault, blocked, archived). Refuses anything the
  transition table does not allow and clears `blockedReason` on the way out of
  `blocked`.
- `submitContentForReview(id)` — moves to `in_review` **and creates a linked
  `Approval`** in the shared queue, plus a notification. Content approvals live
  where every other approval does; a second queue nobody reads would be worse
  than none.
- `approveContentItem(id, { override })` — runs `checkContent` first. A
  `critical` finding refuses the approval and hands back the findings. An
  override is permitted and **recorded** on the item's `complianceSummary` and
  in the event, rather than being silently allowed or silently forbidden.
- `scheduleContentItem(id, publishAt)` — writes a date. The event says so:
  "Nothing is queued with a provider."
- `recordContentPublished(id)` — deliberately not named `publish`.
- `captureContentIdea`, `scoreContentIdea`, `setIdeaStatus`,
  `promoteContentIdea` — the vault. Captured ideas are `source: 'local'`, so no
  reseed and no opt-out removes them; promotion creates a linked draft and
  marks the idea `promoted` exactly once.

The three moves that need more than a status — approve, schedule, publish — are
**refused by `setContentStatus`** with a message naming the writer that can make
them. That is what keeps the compliance gate un-bypassable: there is no path to
`approved` that does not run the check.

Every writer stamps `touchedAt`, so the 12-hour reseed (TD-17) cannot undo an
approval. The demo opt-out still wins: `clearDemoData` removes demo content,
ideas, campaigns, and readings whether or not they were touched, and the
mutation suite proves it after submitting and approving.

## Publishing honesty

The brief's hard line — never fake a social publish — is enforced in three
places:

1. **The package's action bar** offers a permanently disabled *Publish now —
   awaiting credentials* button beside *Record publish*. The disabled one exists
   so the absence is visible rather than merely missing.
2. **The Publishing panel** reads the integration registry for the item's
   platform and prints its real state. Even for a `connected` connector it adds
   that this surface holds no publishing credential, because connector state and
   browser capability are different facts.
3. **The event log** records "Recorded by the operator. No connector confirmed a
   publish." A future sync wave reading these events will not mistake them for
   provider confirmations.

LinkedIn, Facebook, and the n8n publishing webhook stay `awaiting_credentials`,
and Health still reports the loop as offline.

## Compliance stub

`src/domain/compliance.ts` is ten phrases with a severity and a reason —
guaranteed return, risk-free, double your, insider, act now, and so on — matched
case-insensitively across the title, body, video script, and every platform
variant. It returns the phrase, the field, an excerpt, and whether anything
`critical` matched.

The panel that renders it states its own limits: *a fixed keyword list, matched
in this browser; it does not read regulation and it is not a compliance review —
a clean result means only that no listed phrase appeared*. It is named after
ContentDone's `POST /api/compliance/check` so the two stay recognisable to each
other, and it never leaves the browser.

## Brief and inbox wiring

- **Attention** gained content in review, linked to the package rather than the
  gate list. Where a content item and its own approval would both appear, the
  generic approval row is suppressed — one decision should be one line.
- **Today** gained content whose publish date is today and which has not
  shipped, with the clock time. Content carries a publish date, not a due date,
  so it is not on the calendar's agenda and today's plan was incomplete without
  it.
- **Blocked** gained blocked packages with their recorded reason.
- **Leverage** leads with the top learning insight, because it is the only line
  in that section derived from outcomes rather than inputs.
- **Inbox** carries a seeded review signal pointing at the package and a
  due-today signal pointing at the calendar; `submitContentForReview` raises one
  more, inheriting the item's provenance so a demo gate cannot leave an
  operational-looking notification behind after the demo is cleared.

## Search and palette

- Search gained six kinds — `idea`, `campaign`, `hook`, `cta`, `asset`,
  `template` — alongside content items, each routing to the surface that can act
  on it.
- Four palette entries: *Review content awaiting approval*, *Content due to
  publish*, *Open the idea vault*, *Content performance and learning*.
- The existing parity tests now include sub-routes: every palette target must
  resolve to a route the router serves and pass `isSafeInternalHref`.

## Href safety

`enabledPaths()` now includes sub-routes, and `ALLOWED_QUERY_PARAMS` declares
the filter values each content surface accepts (`status`/`format` on the hub,
`week` on the calendar, `type` on the library, `status` on the vault).
`contentHref(id)` validates its own output and degrades to `/content`.

One hardening beyond the brief: `isSafeInternalHref` now rejects a href whose
parsed pathname differs from the literal path it was given. Previously
`/content/../content/ideas` collapsed to an allowed path and passed, and the
raw string — not the collapsed one — is what a consumer would use. A path is now
safe only if it is already written the way it resolves. `src/app/href.test.ts`
covers it.

## Code splitting

| | Wave 3 | Wave 4 |
|---|---:|---:|
| First-load chunks | 540.44 kB / 167.67 kB gzip | 582.31 kB / 181.65 kB gzip |
| Deferred route chunks | 13 chunks, 76.77 kB / 23.91 kB gzip | 21 chunks, 120.49 kB / 38.34 kB gzip |

Seven content pages ship as seven lazy chunks (48.9 kB in total, the package
detail being the largest at 13.2 kB) and the first load grew by 41.9 kB — most of
it the seed, which is eager because the store is opened at boot. The 500 kB
advisory stands; the shared chunk is still React, React Router, Dexie, and Zod,
and reducing it needs the Wave 7 vendor-chunking pass.

## Verification

| Command | Result |
|---------|--------|
| `pnpm lint` | 0 errors, 0 warnings |
| `pnpm typecheck` | clean |
| `pnpm test` | **396 tests, 31 files, passing** (Wave 3: 281 / 26) |
| `pnpm build` | success — 582.31 kB first load + 21 lazy chunks, one chunk-size advisory (TD-16) |

115 tests were added since Wave 3 — 75 of them in four new files, the rest in
the content half of the mutation suite and in the registry, href, router, and
palette suites that grew to cover the hub:

- `src/modules/content/content.test.ts` — the status machine covers every
  status, queue ordering and filters, joins, calendar weeks and undated work,
  idea scoring and ranking, campaign rollups, library usage counted through
  variants, and the daily loop on both a seeded and an empty store.
- `src/domain/compliance.test.ts` — policy shape, blocking vs warning, case
  insensitivity, excerpting, skipped empty fields, and the fields read off an
  item.
- `src/modules/content/learning.test.ts` — latest-reading-per-platform
  arithmetic, null rates for unmeasured items, group sums, insights that refuse
  to compare a single group, and the two thirty-day windows.
- `src/data/mutations.test.ts` — the content half: refused transitions, guarded
  moves routed to their writer, the gate created in the Approval Queue,
  compliance refusal and recorded override, scheduling, recorded publishes,
  vault capture surviving a reseed, promotion happening once, and the demo
  opt-out clearing every new store.
- `src/modules/content/ContentPage.test.tsx` and `ContentItemPage.test.tsx` —
  click-through against a real IndexedDB on all seven surfaces, including the
  disabled *awaiting credentials* button and the override path.

`src/app/router.test.tsx` mounts every enabled sub-route as well as every module
and record route, so a broken lazy import fails the suite rather than the
browser.

## Deferrals (intentional)

1. **No live ContentDone HTTP adapter.** Wave 7 sync. The domain was absorbed;
   the Express app was not rewritten here.
2. **No real social publishing.** LinkedIn, Facebook, and the n8n webhook stay
   `awaiting_credentials`. Recording a publish is the only honest write.
3. **No metric entry form.** `contentMetrics` is read-only in the UI and comes
   from the seed. A form is easy; what it would produce is numbers the operator
   copied from a dashboard by hand, and the surface should say where a reading
   came from before it invites more of them. `method` is on the entity ready for
   it.
4. **No content editor.** `body`, `videoScript`, and variants render; they are
   not edited here. Drafting belongs in a writing tool, and a textarea that
   round-trips to IndexedDB would invite it not to.
5. **No idea re-scoring in the UI.** `scoreContentIdea` exists and is tested;
   the vault shows the three inputs but offers capture, promote, and park only.
   Re-scoring needs the same form layer TD-25 is waiting on.
6. **No campaign or template creation.** Same reason as Wave 3's "no
   opportunity creation": CRUD needs a form layer that has not earned its keep.
7. **Wave 5+ modules** — knowledge, research, AI workspace, decisions, missions,
   automations, metrics, analytics, sync — remain registered and hidden.

## Debt movement

| ID | Movement |
|----|----------|
| TD-16 | **Held, slightly larger.** Seven more lazy chunks kept 48.9 kB out of the first load, but the seed grew and the shared vendor chunk is untouched. Wave 7. |
| TD-17 | **Held.** Every content writer stamps `touchedAt`; an approval or a recorded publish cannot be reseeded away. |
| TD-19 | **Held.** Ten new writers, same shape — although the content writers return a result object rather than a boolean, which is a shape the older writers should probably adopt. |
| TD-20 | **Larger.** Content status, idea capture, and promotion events append to the same unbounded log. Retention is still Wave 7. |
| TD-03 | **Held.** Engagement rate is engagements ÷ impressions on recorded readings; idea score is reach × confidence ÷ effort on numbers printed beside it; campaign counts are counted from items. Nothing is modelled. |
| TD-23 | **Held.** `contentHref` validates id shape, not existence; a link to a cleared package lands on "Not in the local store". |
| TD-24 | **Larger.** `href.ts` now reads content filter constants too, so more selector code lands in the shared chunk. Same Wave 7 fix. |
| TD-25 | **Held.** Content can be blocked by `setContentStatus`, but no UI supplies a reason, so a blocked package still only arrives from the seed. |

## New debt

| ID | Debt | Severity | Note |
|----|------|----------|------|
| TD-26 | The compliance policy is a hard-coded list | Low | Ten phrases in `src/domain/compliance.ts`, not editable by the operator and not versioned with the content it checked. An override is recorded, but the policy it overrode is not. Fine while the list is fixed; needs a policy record once it is not. |
| TD-27 | Readings are cumulative but nothing enforces it | Low | `itemPerformance` takes the latest reading per platform because platform metrics are cumulative. A reading entered as a delta would silently under-count. The entity needs a `basis` field, or the entry form (deferred above) needs to enforce one. |
| TD-28 | Sub-routes are not reflected in the sidebar's active state | Low | The sidebar highlights `/content` for any content surface, which is correct, but the tabs are the only indication of which one. Acceptable for a hub with a tab strip on every page; worth revisiting if a second module becomes a hub. |

## Deviations from the brief

1. **`scheduledFor` is the publish date, not a new `publishAt`.** The brief
   names `publishAt`; `ContentItem` already had `scheduledFor` carrying exactly
   that meaning, with seed data and a Dexie index behind it. Adding a second
   date field would have created two places to ask when something publishes.
2. **The status enum keeps `drafting` and `blocked`.** The brief lists
   `drafted`; the existing enum says `drafting` and the existing seed uses
   `blocked` for a package whose publishing webhook has no credentials. Both
   were kept and `in_review`, `approved`, `archived` added around them.
3. **The four libraries are one route** and **package detail is
   `/content/item/:id`** — see *Route consolidation choices*.
4. **`subRoutes` is a new registry concept.** The brief allowed tabs or nested
   routes. Nested routes needed somewhere to be declared so the router, the href
   allowlist, and the parity tests could share one source; adding each surface as
   its own module would have put seven rows in the sidebar for one module.
5. **`isSafeInternalHref` got stricter** about traversal that collapses into an
   allowed path. Not requested, but the allowlist is the mechanism the whole
   record-link design rests on.
6. **The campaign named "The Compounding Constraint" was renamed "Constraint
   series".** It shared a name with a content item inside it, which made the
   demo data ambiguous to read and to test.
7. **Content mutations return `{ ok, reason }`.** The brief did not specify;
   the surfaces need to tell the operator why a move was refused, and a boolean
   cannot.
