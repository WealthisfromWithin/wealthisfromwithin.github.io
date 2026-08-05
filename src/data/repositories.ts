import type { EntityTable, Table } from 'dexie';
import { db, META_KEYS, type SovereignDb } from './db';
import { buildDemoDataset, SEED_VERSION } from './seed';
import { emptyDataset, type SovereignDataset } from './dataset';
import type { DataSource } from '@/domain';
import { DAY_MS } from '@/lib/clock';

/** Demo timestamps go stale; refresh them so the brief keeps meaning something. */
const SEED_MAX_AGE_MS = DAY_MS / 2;

const DATASET_TABLES = [
  'people',
  'companies',
  'tasks',
  'projects',
  'meetings',
  'missions',
  'approvals',
  'opportunities',
  'contentItems',
  'notifications',
  'events',
  'metrics',
  'integrations',
] as const;

type DatasetTable = (typeof DATASET_TABLES)[number];

interface BaseRow {
  id: string;
  source: DataSource;
  /** Present once the operator authored or mutated the row. */
  touchedAt?: string;
}

/** All dataset tables share a primary key and a provenance column. */
function tableOf(database: SovereignDb, name: DatasetTable): EntityTable<BaseRow, 'id'> {
  return database[name] as EntityTable<BaseRow, 'id'>;
}

export async function readDataset(database: SovereignDb = db): Promise<SovereignDataset> {
  const [
    people,
    companies,
    tasks,
    projects,
    meetings,
    missions,
    approvals,
    opportunities,
    contentItems,
    notifications,
    events,
    metrics,
    integrations,
  ] = await Promise.all([
    database.people.toArray(),
    database.companies.toArray(),
    database.tasks.toArray(),
    database.projects.toArray(),
    database.meetings.toArray(),
    database.missions.toArray(),
    database.approvals.toArray(),
    database.opportunities.toArray(),
    database.contentItems.toArray(),
    database.notifications.toArray(),
    database.events.toArray(),
    database.metrics.toArray(),
    database.integrations.toArray(),
  ]);

  return {
    people,
    companies,
    tasks,
    projects,
    meetings,
    missions,
    approvals,
    opportunities,
    contentItems,
    notifications,
    events,
    metrics,
    integrations,
  };
}

async function readMeta(database: SovereignDb, key: string): Promise<string | undefined> {
  const row = await database.meta.get(key);
  return row?.value;
}

async function writeMeta(database: SovereignDb, key: string, value: string): Promise<void> {
  await database.meta.put({ key, value });
}

const DEMO_OPT_OUT = 'true';

/**
 * True when the operator removed demo rows. The flag outlives the session, so
 * `ensureSeeded` must not undo the choice on the next mount.
 */
export async function isDemoOptedOut(database: SovereignDb = db): Promise<boolean> {
  return (await readMeta(database, META_KEYS.demoOptOut)) === DEMO_OPT_OUT;
}

export async function needsSeed(database: SovereignDb, now: Date): Promise<boolean> {
  if (await isDemoOptedOut(database)) return false;

  const version = await readMeta(database, META_KEYS.seedVersion);
  if (version !== SEED_VERSION) return true;

  const seededAt = await readMeta(database, META_KEYS.seededAt);
  if (!seededAt) return true;

  const age = now.getTime() - Date.parse(seededAt);
  return Number.isNaN(age) || age > SEED_MAX_AGE_MS;
}

function transactionTables(database: SovereignDb): Table[] {
  return [
    ...DATASET_TABLES.map((name) => tableOf(database, name) as Table),
    database.meta as Table,
  ];
}

/**
 * Replaces seeder-owned rows with a fresh dataset. Rows the operator created or
 * acted on are left alone: only untouched `demo` rows and ids this seeder owns
 * are cleared, so an approval decision survives a reseed. Calling this is an
 * explicit request for demo data, so it also revokes any demo opt-out.
 */
export async function seedDemoData(database: SovereignDb, now: Date): Promise<void> {
  const dataset = buildDemoDataset(now);

  await database.transaction('rw', transactionTables(database), async () => {
    for (const name of DATASET_TABLES) {
      const table = tableOf(database, name);
      const rows = dataset[name] as unknown as BaseRow[];
      const seededIds = new Set(rows.map((row) => row.id));
      const existing = await table.toArray();
      const preserved = new Set(
        existing.filter((row) => row.touchedAt !== undefined).map((row) => row.id),
      );
      const stale = existing
        .filter((row) => row.source === 'demo' || seededIds.has(row.id))
        .filter((row) => !preserved.has(row.id))
        .map((row) => row.id);
      if (stale.length > 0) {
        await table.bulkDelete(stale);
      }
      await table.bulkAdd(rows.filter((row) => !preserved.has(row.id)));
    }
    await writeMeta(database, META_KEYS.seedVersion, SEED_VERSION);
    await writeMeta(database, META_KEYS.seededAt, now.toISOString());
    await database.meta.delete(META_KEYS.demoOptOut);
  });
}

export async function ensureSeeded(
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<void> {
  if (await needsSeed(database, now)) {
    await seedDemoData(database, now);
  }
}

/**
 * Removes every demo row and records the opt-out, so reloads and `ensureSeeded`
 * leave the store demo-free until "Refresh demo data" or "Reset store".
 */
export async function clearDemoData(database: SovereignDb = db): Promise<void> {
  await database.transaction('rw', transactionTables(database), async () => {
    for (const name of DATASET_TABLES) {
      const table = tableOf(database, name);
      const demoIds = (await table.toArray())
        .filter((row) => row.source === 'demo')
        .map((row) => row.id);
      if (demoIds.length > 0) {
        await table.bulkDelete(demoIds);
      }
    }
    await database.meta.delete(META_KEYS.seedVersion);
    await database.meta.delete(META_KEYS.seededAt);
    await writeMeta(database, META_KEYS.demoOptOut, DEMO_OPT_OUT);
  });
}

/** Drops the whole database, opt-out included: the store returns to first-run state. */
export async function resetLocalStore(database: SovereignDb = db): Promise<void> {
  await database.delete();
  await database.open();
}

export { emptyDataset };
export type { DatasetTable };
