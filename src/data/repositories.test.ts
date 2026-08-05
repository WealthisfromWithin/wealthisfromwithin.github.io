import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { META_KEYS, SovereignDb } from './db';
import { countDemoRows } from './dataset';
import {
  clearDemoData,
  ensureSeeded,
  isDemoOptedOut,
  needsSeed,
  readDataset,
  resetLocalStore,
  seedDemoData,
} from './repositories';
import { DAY_MS } from '@/lib/clock';

let dbName = '';
let database: SovereignDb;

async function demoRowCount(instance: SovereignDb): Promise<number> {
  return countDemoRows(await readDataset(instance));
}

/** Closes the instance and opens a fresh one on the same data, as a page reload does. */
async function reload(): Promise<SovereignDb> {
  database.close();
  database = new SovereignDb(dbName);
  await database.open();
  return database;
}

beforeEach(async () => {
  dbName = `sovereign-test-${String(Date.now())}-${Math.random().toString(36).slice(2)}`;
  database = new SovereignDb(dbName);
  await database.open();
});

afterEach(async () => {
  await database.delete();
  database.close();
});

describe('demo seeding', () => {
  it('seeds badged demo rows on a first-run store', async () => {
    expect(await demoRowCount(database)).toBe(0);

    await ensureSeeded(database, new Date());

    expect(await demoRowCount(database)).toBeGreaterThan(0);
    expect(await isDemoOptedOut(database)).toBe(false);
  });

  it('reseeds when the seed is stale and the operator has not opted out', async () => {
    const now = new Date();
    await ensureSeeded(database, now);
    await database.meta.put({
      key: META_KEYS.seededAt,
      value: new Date(now.getTime() - DAY_MS).toISOString(),
    });

    expect(await needsSeed(database, now)).toBe(true);
  });
});

describe('durable demo opt-out (M1)', () => {
  it('records the opt-out when demo rows are removed', async () => {
    await ensureSeeded(database, new Date());

    await clearDemoData(database);

    expect(await demoRowCount(database)).toBe(0);
    expect(await isDemoOptedOut(database)).toBe(true);
  });

  it('keeps demo rows gone across a reload', async () => {
    await ensureSeeded(database, new Date());
    await clearDemoData(database);

    const reopened = await reload();
    await ensureSeeded(reopened, new Date());

    expect(await isDemoOptedOut(reopened)).toBe(true);
    expect(await demoRowCount(reopened)).toBe(0);
  });

  it('does not reseed a stale opted-out store', async () => {
    const now = new Date();
    await ensureSeeded(database, now);
    await clearDemoData(database);

    expect(await needsSeed(database, new Date(now.getTime() + DAY_MS))).toBe(false);

    await ensureSeeded(database, new Date(now.getTime() + DAY_MS));

    expect(await demoRowCount(database)).toBe(0);
  });

  it('leaves operator-owned rows untouched when demo rows are removed', async () => {
    await ensureSeeded(database, new Date());
    const stamp = new Date().toISOString();
    await database.companies.add({
      id: 'co-operator',
      name: 'Operator Holdings',
      segment: 'Operator-owned',
      status: 'active',
      source: 'local',
      createdAt: stamp,
      updatedAt: stamp,
    });

    await clearDemoData(database);
    const reopened = await reload();
    await ensureSeeded(reopened, new Date());

    const dataset = await readDataset(reopened);
    expect(dataset.companies.map((company) => company.id)).toEqual(['co-operator']);
  });

  it('restores demo rows when the operator refreshes demo data', async () => {
    await ensureSeeded(database, new Date());
    await clearDemoData(database);

    await seedDemoData(database, new Date());

    expect(await isDemoOptedOut(database)).toBe(false);
    expect(await demoRowCount(database)).toBeGreaterThan(0);

    const reopened = await reload();
    await ensureSeeded(reopened, new Date());
    expect(await demoRowCount(reopened)).toBeGreaterThan(0);
  });

  it('restores demo rows when the operator resets the store', async () => {
    await ensureSeeded(database, new Date());
    await clearDemoData(database);

    await resetLocalStore(database);

    expect(await isDemoOptedOut(database)).toBe(false);

    await ensureSeeded(database, new Date());
    expect(await demoRowCount(database)).toBeGreaterThan(0);
  });
});
