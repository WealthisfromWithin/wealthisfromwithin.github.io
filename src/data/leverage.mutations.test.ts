import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isSafeInternalHref } from '@/app/href';
import { SovereignDb } from './db';
import { ensureSeeded, readDataset } from './repositories';
import {
  archiveAutomationRule,
  captureMission,
  createAutomationRule,
  declareMissionProgress,
  decideApproval,
  runAutomation,
  runEnabledAutomations,
  setAutomationEnabled,
  setMissionStatus,
} from './mutations';

/** Seeded rules, one per branch the run engine can take. */
const UNGATED_NOTIFY = 'aut-overdue-tasks';
const GATED_NOTIFY = 'aut-content-today';
const GATE_ONLY = 'aut-stalled-deals';
const LOG_ONLY = 'aut-credential-watch';
const HANDOFF = 'aut-publish-fanout';
const DISABLED = 'aut-research-due';

/** A seeded registry row a rule can name. Seeded as Awaiting Credentials. */
const GATED_INTEGRATION = 'n8n';

const SEEDED_CONTENT_GATE = 'apr-automation-content';
const SEEDED_CONTENT_RUN = 'run-content-today';

const ACTIVE_MISSION = 'msn-042';
const BLOCKED_MISSION = 'msn-043';
const PAUSED_MISSION = 'msn-044';

let dbName = '';
let database: SovereignDb;

beforeEach(async () => {
  dbName = `sovereign-leverage-${String(Date.now())}-${Math.random().toString(36).slice(2)}`;
  database = new SovereignDb(dbName);
  await database.open();
  await ensureSeeded(database, new Date());
});

afterEach(async () => {
  await database.delete();
  database.close();
});

describe('defining automation rules', () => {
  it('creates a rule as local, gated, and never run', async () => {
    const rule = await createAutomationRule(
      { name: '  Watch the stalled deals  ', trigger: 'opportunity_stalled', action: 'notify' },
      database,
    );

    expect(rule?.name).toBe('Watch the stalled deals');
    expect({
      source: rule?.source,
      gated: rule?.requiresApproval,
      enabled: rule?.enabled,
      runs: rule?.runCount,
      touched: rule?.touchedAt === rule?.createdAt,
    }).toEqual({ source: 'local', gated: true, enabled: true, runs: 0, touched: true });

    const events = await database.events.toArray();
    expect(events.some((event) => event.title.startsWith('Automation defined:'))).toBe(true);
  });

  it('refuses a rule with no name rather than writing an unnamed row', async () => {
    expect(await createAutomationRule({ name: '  ', trigger: 'task_overdue', action: 'notify' }, database)).toBeNull();
  });

  it('toggles and archives without deleting the record of what ran', async () => {
    expect(await setAutomationEnabled(UNGATED_NOTIFY, false, database)).toBe(true);
    // Nothing changed is reported as nothing changed, not as a write.
    expect(await setAutomationEnabled(UNGATED_NOTIFY, false, database)).toBe(false);
    expect((await database.automations.get(UNGATED_NOTIFY))?.enabled).toBe(false);

    expect(await archiveAutomationRule(UNGATED_NOTIFY, true, database)).toBe(true);
    const archived = await database.automations.get(UNGATED_NOTIFY);
    expect(archived?.archivedAt).toBeDefined();
    expect((await database.automationRuns.where('ruleId').equals(UNGATED_NOTIFY).count()) > 0).toBe(
      true,
    );

    expect(await archiveAutomationRule(UNGATED_NOTIFY, false, database)).toBe(true);
    expect((await database.automations.get(UNGATED_NOTIFY))?.archivedAt).toBeUndefined();
  });
});

describe('running an automation', () => {
  it('writes one signal for an ungated notify rule, and links it to a safe route', async () => {
    const before = await database.notifications.count();
    const result = await runAutomation(UNGATED_NOTIFY, database);

    expect({ ok: result.ok, outcome: result.outcome }).toEqual({ ok: true, outcome: 'applied' });
    expect(await database.notifications.count()).toBe(before + 1);

    const notification = await database.notifications.get(result.run?.notificationId ?? '');
    expect(notification?.origin).toBe('Automation');
    expect(notification?.body).toContain('nothing was sent anywhere');
    expect(isSafeInternalHref(notification?.href ?? '')).toBe(true);
    // One signal per run, summarising what matched — never one per matched record.
    expect(notification?.title).toContain(String(result.run?.matched));
  });

  it('opens a gate and writes nothing when the rule is gated', async () => {
    const before = await database.notifications.count();
    const result = await runAutomation(GATED_NOTIFY, database);

    expect(result.outcome).toBe('gated');
    expect(await database.notifications.count()).toBe(before);

    const gate = await database.approvals.get(result.run?.approvalId ?? '');
    expect({ kind: gate?.kind, status: gate?.status, run: gate?.automationRunId }).toEqual({
      kind: 'automation',
      status: 'pending',
      run: result.run?.id,
    });
    expect(gate?.summary).toContain('nothing is published or sent either way');
  });

  it('records a run that matched nothing as a run, not as a silent skip', async () => {
    await database.tasks.toCollection().modify({ status: 'done' });
    const result = await runAutomation(UNGATED_NOTIFY, database);

    expect({ ok: result.ok, outcome: result.outcome, matched: result.run?.matched }).toEqual({
      ok: true,
      outcome: 'no_match',
      matched: 0,
    });
    expect(result.run?.detail).toContain('recorded anyway');
    expect(result.run?.notificationId).toBeUndefined();
  });

  it('refuses a disabled rule and records the refusal', async () => {
    const result = await runAutomation(DISABLED, database);

    expect({ ok: result.ok, outcome: result.outcome, reason: result.run?.reason }).toEqual({
      ok: false,
      outcome: 'refused',
      reason: 'disabled',
    });
    expect(result.run?.matched).toBe(0);
  });

  it('refuses a hand-off, names what would have carried it, and sends nothing', async () => {
    const before = await database.notifications.count();
    const result = await runAutomation(HANDOFF, database);

    expect({ outcome: result.outcome, reason: result.run?.reason }).toEqual({
      outcome: 'refused',
      reason: 'awaiting_credentials',
    });
    expect(result.run?.detail).toContain('no connector runtime');
    expect(await database.notifications.count()).toBe(before);
  });

  it('records a log-only run without writing a signal', async () => {
    const before = await database.notifications.count();
    const result = await runAutomation(LOG_ONLY, database);

    expect(result.outcome).toBe('applied');
    expect(result.run?.notificationId).toBeUndefined();
    expect(await database.notifications.count()).toBe(before);
  });

  it('counts the run against the rule and stamps when it happened', async () => {
    const before = await database.automations.get(UNGATED_NOTIFY);
    await runAutomation(UNGATED_NOTIFY, database);
    const after = await database.automations.get(UNGATED_NOTIFY);

    expect(after?.runCount).toBe((before?.runCount ?? 0) + 1);
    expect(after?.lastRunAt).toBeDefined();
  });

  it('says so rather than throwing when the rule is not in the store', async () => {
    const result = await runAutomation('aut-nope', database);
    expect({ ok: result.ok, run: result.run }).toEqual({ ok: false, run: undefined });
  });

  /**
   * The connected-probe invariant reaches the write path
   * (`docs/reviews/WAVE_7_GPT_REVIEW.md` H1). A store row edited to `connected`
   * without the probe that justifies it — by hand, or by a future writer that
   * forgets — must not make a rule runnable, because `/integrations` reads that
   * same row as Awaiting Credentials.
   */
  it('refuses a rule whose integration claims Connected with no probe behind it', async () => {
    await database.integrations.update(GATED_INTEGRATION, {
      state: 'connected',
      lastProbedAt: undefined,
    });
    const rule = await createAutomationRule(
      {
        name: 'Notify on a credential gap',
        trigger: 'task_overdue',
        action: 'notify',
        requiresApproval: false,
        requiresIntegrationId: GATED_INTEGRATION,
      },
      database,
    );
    const notificationsBefore = await database.notifications.count();

    const result = await runAutomation(rule?.id ?? '', database);

    expect({ ok: result.ok, outcome: result.outcome, reason: result.run?.reason }).toEqual({
      ok: false,
      outcome: 'refused',
      reason: 'awaiting_credentials',
    });
    expect(result.run?.detail).toContain('awaiting credentials');
    expect(result.run?.matched).toBe(0);
    expect(await database.notifications.count()).toBe(notificationsBefore);
  });

  it('runs the same rule once the row carries the probe that verified it', async () => {
    await database.integrations.update(GATED_INTEGRATION, {
      state: 'connected',
      lastProbedAt: '2026-08-05T06:00:00.000Z',
    });
    const rule = await createAutomationRule(
      {
        name: 'Notify on overdue tasks',
        trigger: 'task_overdue',
        action: 'notify',
        requiresApproval: false,
        requiresIntegrationId: GATED_INTEGRATION,
      },
      database,
    );

    const result = await runAutomation(rule?.id ?? '', database);

    expect({ ok: result.ok, outcome: result.outcome }).toEqual({ ok: true, outcome: 'applied' });
  });

  it('runs every enabled rule and reports the refusals with the rest', async () => {
    const results = await runEnabledAutomations(database);
    const enabled = (await database.automations.toArray()).filter(
      (rule) => rule.enabled && rule.archivedAt === undefined,
    );

    expect(results).toHaveLength(enabled.length);
    expect(results.some((result) => result.outcome === 'refused')).toBe(true);
    expect(results.some((result) => result.outcome === 'gated')).toBe(true);
    // The disabled rule was not asked, so it produced no run at all.
    expect(results.every((result) => result.run?.ruleId !== DISABLED)).toBe(true);
  });

  it('never writes a run that claims someone other than the operator asked for it', async () => {
    await runEnabledAutomations(database);
    const runs = await database.automationRuns.toArray();
    expect(runs.every((run) => run.invokedBy === 'Operator')).toBe(true);
  });
});

describe('an automation gate decided in the queue moves its run with it', () => {
  it('starts with the seeded run waiting on the seeded gate', async () => {
    const gate = await database.approvals.get(SEEDED_CONTENT_GATE);
    const run = await database.automationRuns.get(SEEDED_CONTENT_RUN);

    expect({ status: gate?.status, run: gate?.automationRunId }).toEqual({
      status: 'pending',
      run: SEEDED_CONTENT_RUN,
    });
    expect(run?.outcome).toBe('gated');
    expect(run?.notificationId).toBeUndefined();
  });

  it('writes the deferred signal only when a human clears the gate', async () => {
    const before = await database.notifications.count();
    const result = await decideApproval(SEEDED_CONTENT_GATE, 'approved', {}, database);

    expect({ ok: result.ok, outcome: result.automationOutcome }).toEqual({
      ok: true,
      outcome: 'applied',
    });
    expect(await database.notifications.count()).toBe(before + 1);

    const run = await database.automationRuns.get(SEEDED_CONTENT_RUN);
    expect(run?.outcome).toBe('applied');
    expect(run?.detail).toContain('Approved at the gate');

    const notification = await database.notifications.get(run?.notificationId ?? '');
    expect(notification?.body).toContain('Approved at the gate');
    expect(isSafeInternalHref(notification?.href ?? '')).toBe(true);
    expect((await database.approvals.get(SEEDED_CONTENT_GATE))?.status).toBe('approved');
  });

  it('records the refusal against the run and writes nothing when rejected', async () => {
    const before = await database.notifications.count();
    const result = await decideApproval(SEEDED_CONTENT_GATE, 'rejected', {}, database);

    expect(result.automationOutcome).toBe('declined');
    expect(await database.notifications.count()).toBe(before);

    const run = await database.automationRuns.get(SEEDED_CONTENT_RUN);
    expect({ outcome: run?.outcome, reason: run?.reason }).toEqual({
      outcome: 'declined',
      reason: 'gate_rejected',
    });
    expect(run?.detail).toContain('nothing was written');
  });

  it('puts a rejected run back in front of the operator when the gate reopens', async () => {
    await decideApproval(SEEDED_CONTENT_GATE, 'rejected', {}, database);
    const result = await decideApproval(SEEDED_CONTENT_GATE, 'pending', {}, database);

    expect({ ok: result.ok, outcome: result.automationOutcome }).toEqual({
      ok: true,
      outcome: 'gated',
    });
    const run = await database.automationRuns.get(SEEDED_CONTENT_RUN);
    expect({ outcome: run?.outcome, reason: run?.reason }).toEqual({
      outcome: 'gated',
      reason: undefined,
    });
  });

  it('refuses to reopen a gate whose signal was already written', async () => {
    await decideApproval(SEEDED_CONTENT_GATE, 'approved', {}, database);
    const result = await decideApproval(SEEDED_CONTENT_GATE, 'pending', {}, database);

    expect(result.ok).toBe(false);
    expect(result.reason).toContain('already wrote its signal');
    // The gate and the run still agree: both say the effect happened.
    expect((await database.approvals.get(SEEDED_CONTENT_GATE))?.status).toBe('approved');
    expect((await database.automationRuns.get(SEEDED_CONTENT_RUN))?.outcome).toBe('applied');
  });

  it('clears a gate-only run without inventing a signal to write', async () => {
    const run = await runAutomation(GATE_ONLY, database);
    const before = await database.notifications.count();

    const result = await decideApproval(run.run?.approvalId ?? '', 'approved', {}, database);

    expect(result.automationOutcome).toBe('applied');
    expect(await database.notifications.count()).toBe(before);
    const decided = await database.automationRuns.get(run.run?.id ?? '');
    expect(decided?.detail).toContain('Cleared at the gate');
    expect(decided?.notificationId).toBeUndefined();
  });

  it('leaves the Wave 4 content gate path untouched', async () => {
    // A content gate has no automation run behind it, and still moves the copy.
    const result = await decideApproval('apr-linkedin', 'approved', {}, database);
    expect({ ok: result.ok, automation: result.automationOutcome }).toEqual({
      ok: true,
      automation: undefined,
    });
    expect(result.compliance).toBeDefined();
  });
});

describe('mission writers', () => {
  it('opens an objective with a generated code and nothing claimed yet', async () => {
    const mission = await captureMission({ title: '  Ship the advisory funnel  ' }, database);

    expect(mission?.title).toBe('Ship the advisory funnel');
    expect({ source: mission?.source, status: mission?.status, progress: mission?.progress }).toEqual(
      { source: 'local', status: 'active', progress: 0 },
    );
    expect(mission?.code).toMatch(/^MSN-\d{3}$/);
    expect(mission?.touchedAt).toBe(mission?.createdAt);
  });

  it('refuses an objective with no title', async () => {
    expect(await captureMission({ title: '   ' }, database)).toBeNull();
  });

  it('refuses to block an objective without naming the blocker', async () => {
    const result = await setMissionStatus(ACTIVE_MISSION, 'blocked', {}, database);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('blocker');
    expect((await database.missions.get(ACTIVE_MISSION))?.status).toBe('active');
  });

  it('blocks with the reason on the record, and clears it on the way back', async () => {
    expect(
      (await setMissionStatus(ACTIVE_MISSION, 'blocked', { reason: 'The funnel has no intake.' }, database)).ok,
    ).toBe(true);
    expect((await database.missions.get(ACTIVE_MISSION))?.blockedReason).toBe(
      'The funnel has no intake.',
    );

    expect((await setMissionStatus(ACTIVE_MISSION, 'active', {}, database)).ok).toBe(true);
    expect((await database.missions.get(ACTIVE_MISSION))?.blockedReason).toBeUndefined();
  });

  it('refuses an illegal move rather than writing it', async () => {
    const straightToComplete = await setMissionStatus(BLOCKED_MISSION, 'complete', {}, database);
    expect(straightToComplete.ok).toBe(false);
    expect(straightToComplete.reason).toContain('cannot move');
    expect((await database.missions.get(BLOCKED_MISSION))?.status).toBe('blocked');

    expect((await setMissionStatus(PAUSED_MISSION, 'complete', {}, database)).ok).toBe(false);
    expect((await setMissionStatus(PAUSED_MISSION, 'active', {}, database)).ok).toBe(true);
  });

  it('treats a complete objective as history', async () => {
    expect((await setMissionStatus(ACTIVE_MISSION, 'complete', {}, database)).ok).toBe(true);
    const reopen = await setMissionStatus(ACTIVE_MISSION, 'active', {}, database);
    expect(reopen.ok).toBe(false);
    expect((await database.missions.get(ACTIVE_MISSION))?.status).toBe('complete');
  });

  it('records declared progress, clamped, and says it was declared', async () => {
    expect((await declareMissionProgress(ACTIVE_MISSION, 142, database)).ok).toBe(true);
    expect((await database.missions.get(ACTIVE_MISSION))?.progress).toBe(100);

    expect((await declareMissionProgress(ACTIVE_MISSION, -8, database)).ok).toBe(true);
    expect((await database.missions.get(ACTIVE_MISSION))?.progress).toBe(0);

    expect((await declareMissionProgress(ACTIVE_MISSION, Number.NaN, database)).ok).toBe(false);

    const events = await database.events.toArray();
    const declaration = events.find((event) => event.title.includes('progress declared'));
    expect(declaration?.detail).toContain('Declared by the operator');
  });

  it('stamps touchedAt so a reseed cannot undo an operator decision', async () => {
    await setMissionStatus(ACTIVE_MISSION, 'paused', {}, database);
    const mission = await database.missions.get(ACTIVE_MISSION);
    expect(mission?.touchedAt).toBeDefined();

    await ensureSeeded(database, new Date());
    expect((await database.missions.get(ACTIVE_MISSION))?.status).toBe('paused');
  });
});

describe('the leverage read-model', () => {
  it('reads rules and runs back through the dataset', async () => {
    const dataset = await readDataset(database);
    expect(dataset.automations.length).toBeGreaterThan(0);
    expect(dataset.automationRuns.length).toBeGreaterThan(0);
    // Every run points at a rule that exists.
    const ids = new Set(dataset.automations.map((rule) => rule.id));
    expect(dataset.automationRuns.every((run) => ids.has(run.ruleId))).toBe(true);
  });

  it('keeps the seeded run log and the seeded inbox in agreement', async () => {
    const dataset = await readDataset(database);
    const written = dataset.automationRuns
      .map((run) => run.notificationId)
      .filter((id): id is string => id !== undefined);
    const inbox = new Set(dataset.notifications.map((notification) => notification.id));
    for (const id of written) {
      expect({ id, present: inbox.has(id) }).toEqual({ id, present: true });
    }
  });

  it('keeps every seeded automation gate pointing at a run that exists', async () => {
    const dataset = await readDataset(database);
    const runs = new Set(dataset.automationRuns.map((run) => run.id));
    for (const approval of dataset.approvals) {
      if (approval.automationRunId === undefined) continue;
      expect({ id: approval.id, present: runs.has(approval.automationRunId) }).toEqual({
        id: approval.id,
        present: true,
      });
    }
  });
});
