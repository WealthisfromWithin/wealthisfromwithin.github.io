import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { SovereignDb } from './db';
import { DATASET_KEYS } from './dataset';

/**
 * Version 6 is the first schema change that rewrites rows rather than only
 * adding stores, so the upgrade path is worth a regression: an upgrade that
 * throws leaves an existing operator with a store that will not open.
 */

let open: SovereignDb | undefined;

afterEach(async () => {
  if (open) {
    await open.delete();
    open.close();
    open = undefined;
  }
});

async function seedVersionFive(name: string): Promise<void> {
  const legacy = new Dexie(name);
  legacy.version(5).stores({ missions: 'id, status, source' });
  await legacy.open();
  await legacy.table('missions').add({
    id: 'msn-legacy',
    code: 'MSN-001',
    title: 'An objective written before Wave 6',
    objective: 'Still here after the upgrade.',
    status: 'active',
    progress: 40,
    source: 'local',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
  legacy.close();
}

describe('SovereignDb version 6', () => {
  it('opens at version 6 with a store for every dataset key', async () => {
    open = new SovereignDb(`sovereign-v6-${String(Date.now())}`);
    await open.open();

    expect(open.verno).toBe(6);
    const tables = new Set(open.tables.map((table) => table.name));
    for (const key of DATASET_KEYS) {
      expect(tables.has(key)).toBe(true);
    }
  });

  it('backfills the new mission field without losing the row', async () => {
    const name = `sovereign-upgrade-${String(Date.now())}`;
    await seedVersionFive(name);

    open = new SovereignDb(name);
    await open.open();

    expect(open.verno).toBe(6);
    const mission = await open.missions.get('msn-legacy');
    expect(mission?.title).toBe('An objective written before Wave 6');
    expect(mission?.progress).toBe(40);
    // Required by the schema from Wave 6 on, so an older row gets the empty
    // string rather than an absent field the page would have to guess about.
    expect(mission?.successMeasure).toBe('');
    expect(mission?.dueAt).toBeUndefined();
  });

  it('gives an upgraded store the leverage tables, empty', async () => {
    const name = `sovereign-upgrade-tables-${String(Date.now())}`;
    await seedVersionFive(name);

    open = new SovereignDb(name);
    await open.open();

    expect(await open.automations.count()).toBe(0);
    expect(await open.automationRuns.count()).toBe(0);
  });
});
