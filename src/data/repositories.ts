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

export async function needsSeed(database: SovereignDb, now: Date): Promise<boolean> {
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
 * Replaces seeder-owned rows with a fresh dataset. Rows the operator created are
 * left alone: only `demo` rows and ids this seeder owns are cleared.
 */
export async function seedDemoData(database: SovereignDb, now: Date): Promise<void> {
  const dataset = buildDemoDataset(now);

  await database.transaction('rw', transactionTables(database), async () => {
    for (const name of DATASET_TABLES) {
      const table = tableOf(database, name);
      const rows = dataset[name] as unknown as BaseRow[];
      const seededIds = new Set(rows.map((row) => row.id));
      const existing = await table.toArray();
      const stale = existing
        .filter((row) => row.source === 'demo' || seededIds.has(row.id))
        .map((row) => row.id);
      if (stale.length > 0) {
        await table.bulkDelete(stale);
      }
      await table.bulkAdd(rows);
    }
    await writeMeta(database, META_KEYS.seedVersion, SEED_VERSION);
    await writeMeta(database, META_KEYS.seededAt, now.toISOString());
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
  });
}

export async function resetLocalStore(database: SovereignDb = db): Promise<void> {
  await database.delete();
  await database.open();
}

export { emptyDataset };
export type { DatasetTable };
