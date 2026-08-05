import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SovereignDb } from './db';
import { countDemoRows } from './dataset';
import {
  approveContentItem,
  captureContentIdea,
  createTask,
  decideApproval,
  markAllNotificationsRead,
  promoteContentIdea,
  recordContentPublished,
  saveMeetingNotes,
  scheduleContentItem,
  scoreContentIdea,
  setContentStatus,
  setIdeaStatus,
  setNotificationRead,
  setOpportunityStage,
  setTaskPriority,
  setTaskStatus,
  submitContentForReview,
} from './mutations';
import {
  clearDemoData,
  ensureSeeded,
  isDemoOptedOut,
  readDataset,
  seedDemoData,
} from './repositories';
import { buildMorningBrief } from '@/modules/dashboard/brief';
import { approvalCounts, selectApprovals } from '@/modules/approvals/queue';
import { selectOpportunities } from '@/modules/pipeline/pipeline';
import { contentDueToday, selectIdeas } from '@/modules/content/content';
import { selectTasks, taskCounts } from '@/modules/tasks/tasks';
import { projectProgress } from '@/modules/projects/projects';
import { DAY_MS } from '@/lib/clock';

const PENDING_GATE = 'apr-outreach';
const OPEN_TASK = 't-brief-truoak';
const OPPORTUNITY = 'opp-truoak';
const PAST_MEETING = 'mtg-kestrel-checkin';
const DRAFT_ITEM = 'c-substrate';
const REVIEW_ITEM = 'c-constraint';
const APPROVED_ITEM = 'c-renewal-proof';
const SCHEDULED_ITEM = 'c-advisory-loop';
const VAULT_IDEA = 'idea-leverage-inventory';

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

describe('task status', () => {
  it('persists a completion across a reload and a reseed', async () => {
    const now = new Date();
    expect(await setTaskStatus(OPEN_TASK, 'done', database, now)).toBe(true);

    const reopened = await reload();
    await seedDemoData(reopened, new Date(now.getTime() + DAY_MS));

    const task = await reopened.tasks.get(OPEN_TASK);
    expect(task?.status).toBe('done');
    expect(task?.completedAt).toBeDefined();
    expect(task?.touchedAt).toBeDefined();
  });

  it('clears the completion stamp when the task is reopened', async () => {
    await setTaskStatus(OPEN_TASK, 'done', database);
    expect(await setTaskStatus(OPEN_TASK, 'todo', database)).toBe(true);

    const task = await database.tasks.get(OPEN_TASK);
    expect(task?.status).toBe('todo');
    expect(task?.completedAt).toBeUndefined();
  });

  it('clears the blocked stamp and reason when the task starts moving again', async () => {
    const before = await database.tasks.get('t-publish-loop');
    expect(before?.blockedReason).toBeDefined();

    expect(await setTaskStatus('t-publish-loop', 'in_progress', database)).toBe(true);

    const after = await database.tasks.get('t-publish-loop');
    expect(after?.blockedSince).toBeUndefined();
    expect(after?.blockedReason).toBeUndefined();
  });

  it('reports no change for an unknown id or a repeated status', async () => {
    expect(await setTaskStatus('t-does-not-exist', 'done', database)).toBe(false);
    await setTaskStatus(OPEN_TASK, 'done', database);
    expect(await setTaskStatus(OPEN_TASK, 'done', database)).toBe(false);
  });

  it('records the movement as an execution event with the task provenance', async () => {
    await setTaskStatus(OPEN_TASK, 'done', database);

    const events = (await readDataset(database)).events.filter((event) =>
      event.id.startsWith(`e-task-${OPEN_TASK}`),
    );
    expect(events[0]?.title).toContain('Task completed');
    expect(events[0]?.channel).toBe('execution');
    expect(events[0]?.source).toBe('demo');
  });

  it('drops the task out of the open list and off the project count', async () => {
    const before = await readDataset(database);
    const openBefore = taskCounts(before, new Date()).open;
    const progressBefore = projectProgress(before, 'prj-truoak-renewal');

    await setTaskStatus(OPEN_TASK, 'done', database);

    const after = await readDataset(database);
    expect(taskCounts(after, new Date()).open).toBe(openBefore - 1);
    expect(projectProgress(after, 'prj-truoak-renewal').done).toBe(progressBefore.done + 1);
    expect(
      selectTasks(after, { status: 'open', priority: 'all' }).map((task) => task.id),
    ).not.toContain(OPEN_TASK);
  });

  it('leaves the Brief today section once it is done', async () => {
    const now = new Date();
    const before = buildMorningBrief(await readDataset(database), now);
    expect(
      before.sections
        .find((section) => section.id === 'today')
        ?.items.some((item) => item.id === `task:${OPEN_TASK}`),
    ).toBe(true);

    await setTaskStatus(OPEN_TASK, 'done', database, now);

    const after = buildMorningBrief(await readDataset(database), now);
    expect(
      after.sections
        .find((section) => section.id === 'today')
        ?.items.some((item) => item.id === `task:${OPEN_TASK}`),
    ).toBe(false);
  });

  it('stamps a priority change without touching status', async () => {
    expect(await setTaskPriority(OPEN_TASK, 'low', database)).toBe(true);
    const task = await database.tasks.get(OPEN_TASK);
    expect(task?.priority).toBe('low');
    expect(task?.status).toBe('todo');
    expect(task?.touchedAt).toBeDefined();
  });
});

describe('task creation', () => {
  it('creates an operator-owned task that survives a reseed', async () => {
    const now = new Date();
    const created = await createTask({ title: 'Call the auditor' }, database, now);
    expect(created?.source).toBe('local');
    expect(created?.touchedAt).toBeDefined();

    await seedDemoData(database, new Date(now.getTime() + DAY_MS));

    const stored = await database.tasks.get(created!.id);
    expect(stored?.title).toBe('Call the auditor');
  });

  it('trims the title and refuses an empty one', async () => {
    const created = await createTask({ title: '  Write the memo  ' }, database);
    expect(created?.title).toBe('Write the memo');
    expect(await createTask({ title: '   ' }, database)).toBeNull();
  });

  it('keeps the links the operator supplied', async () => {
    const created = await createTask(
      { title: 'Send pricing', personId: 'p-aldridge', opportunityId: OPPORTUNITY, priority: 'high' },
      database,
    );
    expect(created?.personId).toBe('p-aldridge');
    expect(created?.opportunityId).toBe(OPPORTUNITY);
    expect(created?.priority).toBe('high');
  });

  it('records creation as an execution event owned by the operator', async () => {
    const created = await createTask({ title: 'Draft the note' }, database);
    const event = (await readDataset(database)).events.find((row) =>
      row.id.startsWith(`e-task-${String(created?.id)}`),
    );
    expect(event?.title).toBe('Task created: Draft the note');
    expect(event?.source).toBe('local');
  });

  it('is removed by neither a reseed nor a demo opt-out', async () => {
    const created = await createTask({ title: 'Operator work' }, database);
    await clearDemoData(database);

    const dataset = await readDataset(database);
    expect(dataset.tasks.map((task) => task.id)).toEqual([created?.id]);
    expect(countDemoRows(dataset)).toBe(0);
  });
});

describe('opportunity stages', () => {
  it('persists a stage move across a reload and a reseed', async () => {
    const now = new Date();
    expect(await setOpportunityStage(OPPORTUNITY, 'proposal', database, now)).toBe(true);

    const reopened = await reload();
    await seedDemoData(reopened, new Date(now.getTime() + DAY_MS));

    const opportunity = await reopened.opportunities.get(OPPORTUNITY);
    expect(opportunity?.stage).toBe('proposal');
    expect(opportunity?.stageChangedAt).toBeDefined();
    expect(opportunity?.touchedAt).toBeDefined();
  });

  it('settles the probability of a closed deal and leaves an open one alone', async () => {
    const before = await database.opportunities.get(OPPORTUNITY);

    await setOpportunityStage(OPPORTUNITY, 'proposal', database);
    expect((await database.opportunities.get(OPPORTUNITY))?.probability).toBe(before?.probability);

    await setOpportunityStage(OPPORTUNITY, 'won', database);
    expect((await database.opportunities.get(OPPORTUNITY))?.probability).toBe(100);

    await setOpportunityStage(OPPORTUNITY, 'lost', database);
    expect((await database.opportunities.get(OPPORTUNITY))?.probability).toBe(0);
  });

  it('reports no change for an unknown id or the stage it is already in', async () => {
    expect(await setOpportunityStage('opp-nobody', 'won', database)).toBe(false);
    expect(await setOpportunityStage(OPPORTUNITY, 'negotiation', database)).toBe(false);
  });

  it('records the move as a pipeline event naming the stage it left', async () => {
    await setOpportunityStage(OPPORTUNITY, 'won', database);
    const event = (await readDataset(database)).events.find((row) =>
      row.id.startsWith(`e-opportunity-${OPPORTUNITY}`),
    );
    expect(event?.title).toContain('Stage moved to won');
    expect(event?.detail).toContain('negotiation');
    expect(event?.channel).toBe('pipeline');
  });

  it('leaves the open pipeline and the Brief once it is closed', async () => {
    const now = new Date();
    await setOpportunityStage(OPPORTUNITY, 'lost', database, now);

    const dataset = await readDataset(database);
    expect(selectOpportunities(dataset, 'open').map((row) => row.id)).not.toContain(OPPORTUNITY);

    const brief = buildMorningBrief(dataset, now);
    expect(
      brief.sections
        .find((section) => section.id === 'opportunities')
        ?.items.some((item) => item.id === `opportunity:${OPPORTUNITY}`),
    ).toBe(false);
  });
});

describe('meeting notes', () => {
  it('persists notes across a reload and a reseed', async () => {
    const now = new Date();
    expect(await saveMeetingNotes(PAST_MEETING, 'Budget owner named at last.', database, now)).toBe(
      true,
    );

    const reopened = await reload();
    await seedDemoData(reopened, new Date(now.getTime() + DAY_MS));

    expect((await reopened.meetings.get(PAST_MEETING))?.notes).toBe('Budget owner named at last.');
  });

  it('reports no change for an unknown id or identical notes', async () => {
    expect(await saveMeetingNotes('mtg-nobody', 'text', database)).toBe(false);
    const existing = await database.meetings.get(PAST_MEETING);
    expect(await saveMeetingNotes(PAST_MEETING, existing?.notes ?? '', database)).toBe(false);
  });

  it('records the note as a relationship event', async () => {
    await saveMeetingNotes(PAST_MEETING, 'Deferred again.', database);
    const event = (await readDataset(database)).events.find((row) =>
      row.id.startsWith(`e-meeting-${PAST_MEETING}`),
    );
    expect(event?.title).toContain('Meeting notes recorded');
    expect(event?.channel).toBe('relationship');
  });
});

describe('content status machine (W4)', () => {
  it('moves a draft back to the vault and stamps the write', async () => {
    const result = await setContentStatus(DRAFT_ITEM, 'idea', {}, database);
    expect(result.ok).toBe(true);

    const item = await database.contentItems.get(DRAFT_ITEM);
    expect(item?.status).toBe('idea');
    expect(item?.touchedAt).toBeDefined();
  });

  it('refuses a move the machine does not allow, and says which one', async () => {
    const result = await setContentStatus(DRAFT_ITEM, 'archived', {}, database);
    expect(result.ok).toBe(true);

    const backwards = await setContentStatus(DRAFT_ITEM, 'in_review', {}, database);
    expect(backwards.ok).toBe(false);
    expect(backwards.reason).toContain('cannot move straight to');
  });

  it('sends the three guarded moves to the writer that can make them', async () => {
    expect((await setContentStatus(REVIEW_ITEM, 'approved', {}, database)).reason).toContain(
      'approveContentItem',
    );
    expect((await setContentStatus(APPROVED_ITEM, 'scheduled', {}, database)).reason).toContain(
      'scheduleContentItem',
    );
    expect((await setContentStatus(SCHEDULED_ITEM, 'published', {}, database)).reason).toContain(
      'recordContentPublished',
    );
  });

  it('records a block with its reason and clears it on the way out', async () => {
    await setContentStatus(DRAFT_ITEM, 'blocked', { blockedReason: 'Legal is reading it.' }, database);
    expect((await database.contentItems.get(DRAFT_ITEM))?.blockedReason).toBe(
      'Legal is reading it.',
    );

    await setContentStatus(DRAFT_ITEM, 'drafting', {}, database);
    expect((await database.contentItems.get(DRAFT_ITEM))?.blockedReason).toBeUndefined();
  });

  it('reports no change for an unknown id or the status it is already in', async () => {
    expect((await setContentStatus('c-nobody', 'idea', {}, database)).reason).toContain('No content');
    expect((await setContentStatus(DRAFT_ITEM, 'drafting', {}, database)).reason).toContain(
      'Already',
    );
  });

  it('writes a content event carrying the status it left', async () => {
    await setContentStatus(DRAFT_ITEM, 'idea', {}, database);
    const event = (await readDataset(database)).events.find((row) =>
      row.id.startsWith(`e-content-${DRAFT_ITEM}`),
    );
    expect(event?.title).toContain('Content returned to the vault');
    expect(event?.detail).toContain('drafting');
    expect(event?.channel).toBe('content');
  });
});

describe('content review gate (W4)', () => {
  it('opens an Approval row in the shared queue rather than a second queue', async () => {
    expect((await submitContentForReview(DRAFT_ITEM, database)).ok).toBe(true);

    const item = await database.contentItems.get(DRAFT_ITEM);
    expect(item?.status).toBe('in_review');
    expect(item?.approvalId).toBe(`apr-content-${DRAFT_ITEM}`);

    const dataset = await readDataset(database);
    const approval = dataset.approvals.find((row) => row.id === `apr-content-${DRAFT_ITEM}`);
    expect(approval?.status).toBe('pending');
    expect(approval?.kind).toBe('content');
    expect(selectApprovals(dataset, 'pending').map((row) => row.id)).toContain(approval?.id);
  });

  it('raises a signal that inherits the item provenance', async () => {
    await submitContentForReview(DRAFT_ITEM, database);
    const notification = await database.notifications.get(`n-content-review-${DRAFT_ITEM}`);

    expect(notification?.read).toBe(false);
    expect(notification?.href).toBe('/approvals');
    expect(notification?.source).toBe('demo');
  });

  it('refuses to open a gate on an item that is already through it', async () => {
    const result = await submitContentForReview(APPROVED_ITEM, database);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('cannot move straight to');
  });

  it('persists the gate across a reload and a reseed', async () => {
    const now = new Date();
    await submitContentForReview(DRAFT_ITEM, database, now);

    const reopened = await reload();
    await seedDemoData(reopened, new Date(now.getTime() + DAY_MS));

    expect((await reopened.contentItems.get(DRAFT_ITEM))?.status).toBe('in_review');
    expect((await reopened.approvals.get(`apr-content-${DRAFT_ITEM}`))?.status).toBe('pending');
  });
});

describe('content approval runs the local compliance check (W4)', () => {
  it('approves clean copy and closes the linked gate', async () => {
    const result = await approveContentItem(REVIEW_ITEM, {}, database);

    expect(result.ok).toBe(true);
    expect(result.compliance?.clean).toBe(true);

    const item = await database.contentItems.get(REVIEW_ITEM);
    expect(item?.status).toBe('approved');
    expect(item?.complianceCheckedAt).toBeDefined();
    expect(item?.complianceSummary).toContain('Local keyword policy');
    expect((await database.approvals.get('apr-linkedin'))?.status).toBe('approved');
  });

  it('refuses blocking language and leaves the item in review', async () => {
    await database.contentItems.update(REVIEW_ITEM, {
      body: 'A risk-free way to double your revenue.',
    });

    const result = await approveContentItem(REVIEW_ITEM, {}, database);

    expect(result.ok).toBe(false);
    expect(result.compliance?.blocking).toBe(true);
    expect(result.compliance?.findings.map((finding) => finding.id)).toContain('risk-free');
    expect((await database.contentItems.get(REVIEW_ITEM))?.status).toBe('in_review');
  });

  it('records an override on the item instead of hiding it', async () => {
    await database.contentItems.update(REVIEW_ITEM, { body: 'A risk-free launch.' });

    const result = await approveContentItem(REVIEW_ITEM, { override: true }, database);

    expect(result.ok).toBe(true);
    const item = await database.contentItems.get(REVIEW_ITEM);
    expect(item?.status).toBe('approved');
    expect(item?.complianceSummary).toContain('operator override');

    const event = (await readDataset(database)).events.find((row) =>
      row.id.startsWith(`e-content-${REVIEW_ITEM}`),
    );
    expect(event?.detail).toContain('operator override');
  });

  it('cannot be reached by the plain status writer', async () => {
    await database.contentItems.update(REVIEW_ITEM, { body: 'A risk-free launch.' });

    expect((await setContentStatus(REVIEW_ITEM, 'approved', {}, database)).ok).toBe(false);
    expect((await database.contentItems.get(REVIEW_ITEM))?.status).toBe('in_review');
  });
});

describe('content scheduling and publishing (W4)', () => {
  it('writes a date, and says that no provider was queued', async () => {
    const publishAt = new Date(Date.now() + 2 * DAY_MS).toISOString();
    expect((await scheduleContentItem(APPROVED_ITEM, publishAt, database)).ok).toBe(true);

    const item = await database.contentItems.get(APPROVED_ITEM);
    expect(item?.status).toBe('scheduled');
    expect(item?.scheduledFor).toBe(publishAt);

    const event = (await readDataset(database)).events.find((row) =>
      row.id.startsWith(`e-content-${APPROVED_ITEM}`),
    );
    expect(event?.detail).toContain('Nothing is queued with a provider');
  });

  it('refuses a date it cannot read and an item that is not approved', async () => {
    expect((await scheduleContentItem(APPROVED_ITEM, 'next tuesday', database)).ok).toBe(false);
    expect((await scheduleContentItem(DRAFT_ITEM, new Date().toISOString(), database)).ok).toBe(
      false,
    );
  });

  it('records a publish the operator performed elsewhere, never one it made', async () => {
    const result = await recordContentPublished(SCHEDULED_ITEM, database);
    expect(result.ok).toBe(true);

    const item = await database.contentItems.get(SCHEDULED_ITEM);
    expect(item?.status).toBe('published');
    expect(item?.publishedAt).toBeDefined();

    const event = (await readDataset(database)).events.find((row) =>
      row.id.startsWith(`e-content-${SCHEDULED_ITEM}`),
    );
    expect(event?.detail).toContain('No connector confirmed a publish');
  });

  it('will not record a publish on a draft that skipped the gate', async () => {
    const result = await recordContentPublished(DRAFT_ITEM, database);
    expect(result.ok).toBe(false);
    expect((await database.contentItems.get(DRAFT_ITEM))?.publishedAt).toBeUndefined();
  });

  it("leaves today's plan once it is published", async () => {
    const now = new Date();
    const before = await readDataset(database);
    expect(contentDueToday(before, now).map((row) => row.id)).toContain(SCHEDULED_ITEM);
    const todayBefore = buildMorningBrief(before, now).sections.find(
      (section) => section.id === 'today',
    );

    await recordContentPublished(SCHEDULED_ITEM, database, now);

    const after = await readDataset(database);
    expect(contentDueToday(after, now).map((row) => row.id)).not.toContain(SCHEDULED_ITEM);

    const todayAfter = buildMorningBrief(after, now).sections.find(
      (section) => section.id === 'today',
    );
    expect(todayAfter?.total).toBe((todayBefore?.total ?? 0) - 1);
    expect(todayAfter?.items.some((row) => row.id === `content:${SCHEDULED_ITEM}`)).toBe(false);
  });
});

describe('idea vault writes (W4)', () => {
  it('captures an operator-owned idea that survives a reseed and an opt-out', async () => {
    const now = new Date();
    const idea = await captureContentIdea({ title: '  Three failure modes  ' }, database, now);

    expect(idea?.title).toBe('Three failure modes');
    expect(idea?.source).toBe('local');
    expect(idea?.status).toBe('captured');
    expect(idea?.touchedAt).toBeDefined();

    await seedDemoData(database, new Date(now.getTime() + DAY_MS));
    expect((await database.contentIdeas.get(idea!.id))?.title).toBe('Three failure modes');

    await clearDemoData(database);
    expect((await readDataset(database)).contentIdeas.map((row) => row.id)).toEqual([idea!.id]);
  });

  it('refuses an empty title', async () => {
    expect(await captureContentIdea({ title: '   ' }, database)).toBeNull();
  });

  it('clamps a score to the one-to-five band it prints', async () => {
    const idea = await captureContentIdea({ title: 'Scored', reach: 99, effort: 0 }, database);
    expect(idea?.reach).toBe(5);
    expect(idea?.effort).toBe(1);

    expect(await scoreContentIdea(idea!.id, { confidence: -4 }, database)).toBe(true);
    expect((await database.contentIdeas.get(idea!.id))?.confidence).toBe(1);
    expect(await scoreContentIdea('idea-nobody', { reach: 2 }, database)).toBe(false);
  });

  it('parks an idea without promoting it', async () => {
    expect(await setIdeaStatus(VAULT_IDEA, 'parked', database)).toBe(true);
    expect((await database.contentIdeas.get(VAULT_IDEA))?.status).toBe('parked');
  });

  it('promotes an idea into a linked draft, once', async () => {
    const promoted = await promoteContentIdea(VAULT_IDEA, database);

    expect(promoted?.item.status).toBe('drafting');
    expect(promoted?.item.ideaId).toBe(VAULT_IDEA);
    expect(promoted?.item.source).toBe('local');
    expect((await database.contentIdeas.get(VAULT_IDEA))?.status).toBe('promoted');
    expect((await database.contentIdeas.get(VAULT_IDEA))?.promotedItemId).toBe(promoted?.item.id);

    expect(await promoteContentIdea(VAULT_IDEA, database)).toBeNull();
  });

  it('drops the promoted idea out of the vault list', async () => {
    const before = selectIdeas(await readDataset(database)).map((idea) => idea.id);
    expect(before).toContain(VAULT_IDEA);

    await promoteContentIdea(VAULT_IDEA, database);

    expect(selectIdeas(await readDataset(database)).map((idea) => idea.id)).not.toContain(
      VAULT_IDEA,
    );
  });
});

describe('demo opt-out is still absolute (M1)', () => {
  it('removes rows the operator acted on and keeps them gone across a reload', async () => {
    await decideApproval(PENDING_GATE, 'approved', database);
    await markAllNotificationsRead(database);
    await setTaskStatus(OPEN_TASK, 'done', database);
    await setOpportunityStage(OPPORTUNITY, 'won', database);
    await saveMeetingNotes(PAST_MEETING, 'Closed out.', database);
    await submitContentForReview(DRAFT_ITEM, database);
    await approveContentItem(REVIEW_ITEM, {}, database);

    await clearDemoData(database);
    const reopened = await reload();
    await ensureSeeded(reopened, new Date());

    const dataset = await readDataset(reopened);
    expect(await isDemoOptedOut(reopened)).toBe(true);
    expect(countDemoRows(dataset)).toBe(0);
    expect(dataset.approvals).toHaveLength(0);
    expect(dataset.notifications).toHaveLength(0);
    expect(dataset.tasks).toHaveLength(0);
    expect(dataset.opportunities).toHaveLength(0);
    expect(dataset.meetings).toHaveLength(0);
    expect(dataset.contentItems).toHaveLength(0);
    expect(dataset.contentIdeas).toHaveLength(0);
    expect(dataset.contentMetrics).toHaveLength(0);
    expect(dataset.campaigns).toHaveLength(0);
  });
});
