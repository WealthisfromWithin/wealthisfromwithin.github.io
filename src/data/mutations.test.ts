import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SovereignDb } from './db';
import { countDemoRows } from './dataset';
import { decideApproval, markAllNotificationsRead, setNotificationRead } from './mutations';
import {
  clearDemoData,
  ensureSeeded,
  isDemoOptedOut,
  readDataset,
  seedDemoData,
} from './repositories';
import { buildMorningBrief } from '@/modules/dashboard/brief';
import { approvalCounts, selectApprovals } from '@/modules/approvals/queue';
import { DAY_MS } from '@/lib/clock';

const PENDING_GATE = 'apr-outreach';

let dbName = '';
let database: SovereignDb;

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
  await ensureSeeded(database, new Date());
});

afterEach(async () => {
  await database.delete();
  database.close();
});

describe('approval decisions', () => {
  it('persists an approval across a reload', async () => {
    expect(await decideApproval(PENDING_GATE, 'approved', database)).toBe(true);

    const reopened = await reload();
    await ensureSeeded(reopened, new Date());

    const approval = await reopened.approvals.get(PENDING_GATE);
    expect(approval?.status).toBe('approved');
    expect(approval?.decidedAt).toBeDefined();
    expect(approval?.decidedBy).toBe('Operator');
  });

  it('persists a rejection across a reload', async () => {
    await decideApproval(PENDING_GATE, 'rejected', database);

    const reopened = await reload();
    const approval = await reopened.approvals.get(PENDING_GATE);

    expect(approval?.status).toBe('rejected');
  });

  it('survives a demo reseed rather than being silently reopened', async () => {
    const now = new Date();
    await decideApproval(PENDING_GATE, 'approved', database, now);

    await seedDemoData(database, new Date(now.getTime() + DAY_MS));

    const approval = await database.approvals.get(PENDING_GATE);
    expect(approval?.status).toBe('approved');
    expect(countDemoRows(await readDataset(database))).toBeGreaterThan(0);
  });

  it('can be reopened, which clears the decision stamp', async () => {
    await decideApproval(PENDING_GATE, 'approved', database);
    expect(await decideApproval(PENDING_GATE, 'pending', database)).toBe(true);

    const approval = await database.approvals.get(PENDING_GATE);
    expect(approval?.status).toBe('pending');
    expect(approval?.decidedAt).toBeUndefined();
    expect(approval?.decidedBy).toBeUndefined();
  });

  it('reports no change for an unknown id or a repeated decision', async () => {
    expect(await decideApproval('apr-does-not-exist', 'approved', database)).toBe(false);

    await decideApproval(PENDING_GATE, 'approved', database);
    expect(await decideApproval(PENDING_GATE, 'approved', database)).toBe(false);
  });

  it('records the decision as an activity event with the gate provenance', async () => {
    const before = (await readDataset(database)).events.length;
    await decideApproval(PENDING_GATE, 'approved', database);

    const dataset = await readDataset(database);
    const recorded = dataset.events.filter((event) => event.id.startsWith('e-approval-'));

    expect(dataset.events.length).toBe(before + 1);
    expect(recorded[0]?.title).toContain('Approval granted');
    expect(recorded[0]?.source).toBe('demo');
  });

  it('moves the gate out of the Brief attention section', async () => {
    const now = new Date();
    const before = buildMorningBrief(await readDataset(database), now);
    expect(
      before.sections
        .find((section) => section.id === 'attention')
        ?.items.some((item) => item.id === `approval:${PENDING_GATE}`),
    ).toBe(true);

    await decideApproval(PENDING_GATE, 'approved', database, now);

    const after = buildMorningBrief(await readDataset(database), now);
    expect(
      after.sections
        .find((section) => section.id === 'attention')
        ?.items.some((item) => item.id === `approval:${PENDING_GATE}`),
    ).toBe(false);
  });

  it('drops the gate out of the pending queue', async () => {
    const dataset = await readDataset(database);
    const pendingBefore = selectApprovals(dataset, 'pending').length;

    await decideApproval(PENDING_GATE, 'approved', database);

    const after = await readDataset(database);
    expect(selectApprovals(after, 'pending')).toHaveLength(pendingBefore - 1);
    expect(approvalCounts(after).approved).toBeGreaterThan(0);
  });
});

describe('notification read state', () => {
  it('persists a single mark-read across a reload', async () => {
    const [first] = (await readDataset(database)).notifications.filter(
      (notification) => !notification.read,
    );
    expect(first).toBeDefined();

    expect(await setNotificationRead(first!.id, true, database)).toBe(true);

    const reopened = await reload();
    await ensureSeeded(reopened, new Date());
    const stored = await reopened.notifications.get(first!.id);

    expect(stored?.read).toBe(true);
    expect(stored?.readAt).toBeDefined();
  });

  it('marks a read signal unread again and clears the read stamp', async () => {
    const read = (await readDataset(database)).notifications.find(
      (notification) => notification.read,
    );
    expect(read).toBeDefined();

    await setNotificationRead(read!.id, false, database);
    const stored = await database.notifications.get(read!.id);

    expect(stored?.read).toBe(false);
    expect(stored?.readAt).toBeUndefined();
  });

  it('marks every unread signal read and reports the count', async () => {
    const unread = (await readDataset(database)).notifications.filter(
      (notification) => !notification.read,
    ).length;
    expect(unread).toBeGreaterThan(0);

    expect(await markAllNotificationsRead(database)).toBe(unread);
    expect(await markAllNotificationsRead(database)).toBe(0);

    const dataset = await readDataset(database);
    expect(dataset.notifications.every((notification) => notification.read)).toBe(true);
  });

  it('survives a demo reseed', async () => {
    const now = new Date();
    await markAllNotificationsRead(database, now);

    await seedDemoData(database, new Date(now.getTime() + DAY_MS));

    const dataset = await readDataset(database);
    expect(dataset.notifications.every((notification) => notification.read)).toBe(true);
  });
});

describe('demo opt-out is still absolute (M1)', () => {
  it('removes rows the operator acted on and keeps them gone across a reload', async () => {
    await decideApproval(PENDING_GATE, 'approved', database);
    await markAllNotificationsRead(database);

    await clearDemoData(database);
    const reopened = await reload();
    await ensureSeeded(reopened, new Date());

    const dataset = await readDataset(reopened);
    expect(await isDemoOptedOut(reopened)).toBe(true);
    expect(countDemoRows(dataset)).toBe(0);
    expect(dataset.approvals).toHaveLength(0);
    expect(dataset.notifications).toHaveLength(0);
  });
});
