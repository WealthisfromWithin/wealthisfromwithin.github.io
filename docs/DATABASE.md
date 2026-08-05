# Database

**Status:** current as of Wave 7. **Schema version: Dexie 6.**
**Engine:** IndexedDB, via [Dexie 4](https://dexie.org/), in the operator's own
browser.

There is no server database. There is no replica, no backup, and no export
beyond the controls in `/settings`. **Clearing site data is a complete and
unrecoverable delete.** Every surface that could mislead an operator about this
says so on the page.

---

## 1. Shape

One Dexie database, `sovereign-command`, holding **30 domain object stores plus
a `meta` key-value store**.

Every domain row shares a base defined once in `src/domain/common.ts`:

```ts
{
  id: string;              // primary key on every store
  source: 'demo' | 'local' | 'remote';
  createdAt: string;       // ISO 8601
  updatedAt: string;       // ISO 8601
  touchedAt?: string;      // present once the operator authored or changed it
}
```

Three fields do load-bearing work:

| Field | Why it exists |
|-------|---------------|
| `source` | Provenance. `demo` rows are badged in every surface that renders them and are cleared by a reseed. `local` is a row the operator authored. **`remote` has never been written** — it is declared for the day a Command API supplies a row, and no code path produces it today |
| `touchedAt` | Survival. The reseeder preserves any row carrying it, so a demo record the operator acted on is never silently reverted (TD-17) |
| `updatedAt` | Ordering and staleness arithmetic across every surface |

### Store inventory

| Store | Wave | Indexes beyond `id` |
|-------|-----:|---------------------|
| `people` | 1 | `name`, `companyId`, `source` |
| `companies` | 1 | `name`, `status`, `source` |
| `tasks` | 1 | `status`, `priority`, `dueAt`, `missionId`, `projectId`, `opportunityId`, `personId`, `source` |
| `projects` | 3 | `status`, `dueAt`, `companyId`, `source` |
| `meetings` | 3 | `startsAt`, `companyId`, `opportunityId`, `source` |
| `missions` | 1 | `code`, `status`, `source` |
| `approvals` | 1 | `status`, `risk`, `dueAt`, `source` |
| `opportunities` | 1 | `stage`, `nextStepAt`, `companyId`, `personId`, `missionId`, `source` |
| `contentItems` | 1 | `status`, `format`, `scheduledFor`, `campaignId`, `parentId`, `ideaId`, `source` |
| `contentIdeas` | 4 | `status`, `campaignId`, `source` |
| `campaigns` | 4 | `status`, `startAt`, `missionId`, `source` |
| `contentAssets` | 4 | `kind`, `source` |
| `contentTemplates` | 4 | `format`, `source` |
| `hooks` | 4 | `style`, `source` |
| `ctas` | 4 | `intent`, `source` |
| `contentMetrics` | 4 | `contentItemId`, `platform`, `capturedAt`, `source` |
| `knowledgeNodes` | 5 | `kind`, `pinned`, `companyId`, `opportunityId`, `contentItemId`, `source` |
| `memoryEntries` | 5 | `kind`, `scope`, `pinned`, `reviewAt`, `personId`, `companyId`, `source` |
| `documents` | 5 | `kind`, `status`, `companyId`, `opportunityId`, `projectId`, `meetingId`, `source` |
| `decisions` | 5 | `status`, `dueAt`, `decidedAt`, `opportunityId`, `projectId`, `source` |
| `prompts` | 5 | `intent`, `lastUsedAt`, `source` |
| `researchItems` | 5 | `status`, `priority`, `dueAt`, `opportunityId`, `source` |
| `agentSessions` | 5 | `lastActivityAt`, `promptId`, `source` |
| `agentMessages` | 5 | `sessionId`, `at`, `outcome`, `source` |
| `automations` | 6 | `trigger`, `action`, `enabled`, `source` |
| `automationRuns` | 6 | `ruleId`, `at`, `outcome`, `approvalId`, `source` |
| `notifications` | 2 | `read`, `severity`, `createdAt`, `source` |
| `events` | 1 | `at`, `channel`, `source` |
| `metrics` | 1 | `label`, `source` |
| `integrations` | 1 | `state`, `category`, `source` |
| `meta` | 1 | keyed by `key` (not an entity table) |

`meta` holds three keys: `seed.version`, `seed.at`, and `seed.optOut`.

---

## 2. Migrations

Dexie versions are additive and every one that changes an existing row shape
carries an `upgrade` that backfills it. **No migration has ever dropped a store
or deleted a row.**

| Version | Wave | Change | Upgrade |
|--------:|-----:|--------|---------|
| 1 | 1 | 12 stores: the attention and relationship core | — |
| 2 | 2 | `approvals` gains a `status` index | Backfills `status: 'pending'` on rows written before the column existed |
| 3 | 3 | `projects` and `meetings` added; `tasks` and `opportunities` gain local join indexes | Backfills `companies.status: 'prospect'` |
| 4 | 4 | Eight Content OS stores | Renames `contentItems.status` `review` → `in_review`; defaults `format`, `body`, `videoScript`, `complianceSummary`, `assetIds`, `variants`, `tags` |
| 5 | 5 | Eight cognition stores | None needed — every table is new, so a version-4 store keeps every row it had |
| 6 | 6 | `automations`, `automationRuns`; `missionId` on `opportunities` and `campaigns` | Backfills `missions.successMeasure: ''` |

**Wave 7 adds no schema version.** The connected-probe invariant needed no new
column: `Integration.lastProbedAt` has existed since version 1 and was simply
never written. This is why the invariant is enforced at read time as well as
write time — see §4.

`src/data/db.test.ts` holds a migration regression that creates a store at
version 5, opens it at version 6, and asserts the mission survives with
`successMeasure` backfilled and the two leverage tables present and empty.

### Adding a version

1. Add the shape to `src/domain` first, with the new field optional if existing
   rows lack it.
2. Add `this.version(n).stores({...})` in `src/data/db.ts`, re-declaring **only**
   the stores whose indexes change.
3. If any existing row needs a value, add `.upgrade()` and backfill it. Never
   assume a column exists.
4. Add a regression to `src/data/db.test.ts` that opens a store created at
   `n - 1`.

---

## 3. Read and write paths

### Read

The entire store is loaded into memory at boot as one `SovereignDataset` — 30
arrays, one per store, listed in `DATASET_KEYS`. `useLiveQuery` re-reads it when
a mutation commits, so a write on one surface refreshes every other.

Selectors are therefore pure functions of a plain object, which is why the
majority of the 919 tests need no database at all.

This is a deliberate single-operator trade. At demo scale (roughly two thousand
rows) reading everything is cheaper than 30 indexed queries per navigation. It
would not survive tens of thousands of rows, and that ceiling is recorded as
TD-31 and TD-32 rather than being presented as a solved problem.

### Write

**`src/data/mutations.ts` is the only write path** — 50 writers, and the only
module outside the seeder that calls `put`, `update`, or `delete`. Every writer:

1. Opens a Dexie transaction covering every table it touches, so a partial write
   is impossible.
2. Stamps `updatedAt` and `touchedAt`.
3. Appends an `ActivityEvent` on one of nine channels.
4. Returns `{ ok, reason }` or the created record. Writers refuse; they do not
   throw.

The refusal path matters as much as the success path. `runAutomation` has four
exits and three of them write a record of *not* acting, because a fabric that
silently does nothing is worse than one that says it did nothing.

---

## 4. The connected-probe invariant

`Integration.lastProbedAt` is the field the honesty of the whole integration
model rests on, so it is worth stating precisely how it is enforced.

**Rule:** an integration is `connected` only if it carries a `lastProbedAt`
timestamp that parses.

**Write side** — `recordIntegrationProbe` is the only writer that can set
`connected`. It refuses a result whose `at` is empty or unparseable:

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

It also refuses to probe a row that is `disabled`, because a connector turned
off deliberately is not a connector waiting to be checked. On success it writes
`connected`; on failure it writes `awaiting_credentials` — **and records
`lastProbedAt` either way**, because "we asked and it did not answer" is a
measurement worth keeping.

**Read side** — `effectiveIntegrationState` in `src/integrations/state.ts`
downgrades any row claiming `connected` without a probe to
`awaiting_credentials`, and every consumer reads through it: the registry page,
the MCP panel, `countByState`, `isUsable`, `deriveSubstrateHealth`, blocked
capabilities, and the search index.

**Why both.** The writer contract governs rows written from now on. The read-time
downgrade governs rows already in an operator's browser, rows a future writer
might set carelessly, and rows a hand-edited IndexedDB could contain. Enforcing
it as a zod refinement instead would have been worse: a stored row that failed
validation would lock the operator out of their own store, and the failure mode
of that is an error boundary hiding the problem rather than a surface showing
it.

---

## 5. The demo seed

`SEED_VERSION = 'wave6.0'`, held in `src/data/seedVersion.ts` — a file of its
own so `repositories.ts` can compare the version without pulling in the seed's
60 kB of fixtures.

### When it runs

`ensureSeeded` reseeds when any of these hold:

- the stored `seed.version` differs from `SEED_VERSION`, or
- there is no `seed.at`, or
- `seed.at` is more than **12 hours** old,

**and** the operator has not opted out. Demo timestamps go stale, so a brief
built from week-old demo rows would show nothing due and nothing overdue, which
is a worse lie than refreshed fixtures.

### What it preserves

`seedDemoData` clears a row only if it is `source: 'demo'` **or** its id belongs
to the seed, **and** it carries no `touchedAt`. So:

- A demo approval the operator decided → **kept**.
- A demo task nobody touched → **replaced**.
- Anything the operator created → **kept**, always.

### Deferred loading

The seed module is loaded through a dynamic `import()` inside `seedDemoData`, so
its 60.35 kB (17.57 kB gzip) stays out of the first load. A boot that does not
need to reseed — a reload inside the 12-hour window, or a store where demo data
was cleared — never fetches the chunk.

### Operator controls (`/settings`)

| Control | Effect |
|---------|--------|
| Refresh demo data | Reseeds now, revoking any opt-out |
| Clear demo data | Deletes every `demo` row and records the opt-out, so reloads leave the store demo-free |
| Reset store | Drops the database entirely, opt-out included; the store returns to first-run state |

---

## 6. Known limits

| ID | Limit |
|----|-------|
| TD-20 | `events` and `automationRuns` are **unbounded**. There is no retention rule, no cap, and no pruning. An operator using the surface heavily for a long time accumulates rows indefinitely |
| TD-17 | The 12-hour reseed timer is a fixed constant. `touchedAt` protects real work, but demo timestamps still move under a reader who did not expect it |
| TD-31 / TD-32 | Backlink and automation-trigger evaluation scan whole tables. Instant at demo scale, `O(rows)` per query at any other |
| TD-21 | Actor fields (`decidedBy`, `invokedBy`) are the hard-coded string `Operator`. There is one identity because there is no auth |
| TD-27 | Content metric readings are assumed cumulative and nothing enforces it |
| — | No export format. The Settings controls delete; they do not serialise. A JSON export is unbuilt |

---

## 7. Inspecting the store

Dexie exposes the database at `sovereign-command` in the browser's Application →
IndexedDB panel. It is readable and writable by hand, which is worth knowing for
two reasons: it is the fastest way to inspect a bug, and it is why the
read-time invariant in §4 exists.

For tests, `fake-indexeddb` provides a real Dexie store per suite — the mutation
and page suites exercise genuine transactions rather than a mock.
