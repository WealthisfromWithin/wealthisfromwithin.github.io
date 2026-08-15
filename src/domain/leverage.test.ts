import { describe, expect, it } from 'vitest';
import type { Integration } from './entities';
import {
  automationActionSchema,
  automationDeferredAction,
  automationOpensGate,
  automationReadiness,
  automationRuleSchema,
  automationRunSchema,
  automationTriggerHref,
  automationTriggerLabel,
  automationTriggerSchema,
  canTransitionMission,
  daysInStage,
  evaluateAutomation,
  isPastDue,
  isStalledOpportunity,
  MISSION_TRANSITIONS,
  missionNeedsReason,
  STALL_DAYS,
  type AutomationContext,
  type AutomationRule,
} from './leverage';

const NOW = new Date('2026-08-05T09:00:00.000Z');
const stamp = '2026-08-01T09:00:00.000Z';

function rule(overrides: Partial<AutomationRule> = {}): AutomationRule {
  return automationRuleSchema.parse({
    id: 'aut-test',
    source: 'local',
    createdAt: stamp,
    updatedAt: stamp,
    name: 'Test rule',
    trigger: 'task_overdue',
    action: 'notify',
    ...overrides,
  });
}

function integration(
  id: string,
  state: Integration['state'],
  /** Present by default for a Connected row, because the invariant demands it. */
  lastProbedAt: string | undefined = state === 'connected' ? stamp : undefined,
): Integration {
  return {
    id,
    name: id,
    source: 'local',
    createdAt: stamp,
    updatedAt: stamp,
    category: 'automation',
    state,
    capabilities: [],
    rationale: '',
    lastProbedAt,
    substrate: false,
  };
}

/** A row that says Connected with no probe behind the claim. */
function unverified(id: string): Integration {
  return { ...integration(id, 'connected'), lastProbedAt: undefined };
}

/** A store with one row of each shape a trigger can read. */
function context(overrides: Partial<AutomationContext> = {}): AutomationContext {
  const base = { source: 'local' as const, createdAt: stamp, updatedAt: stamp };
  return {
    tasks: [
      {
        ...base,
        id: 't-late',
        title: 'Close the audit',
        status: 'todo',
        priority: 'normal',
        dueAt: '2026-08-01T09:00:00.000Z',
        context: '',
      },
      {
        ...base,
        id: 't-done-late',
        title: 'Already finished',
        status: 'done',
        priority: 'low',
        dueAt: '2026-07-01T09:00:00.000Z',
        context: '',
      },
    ],
    contentItems: [
      {
        ...base,
        id: 'c-today',
        title: 'Dated today',
        status: 'scheduled',
        format: 'post',
        channel: '',
        scheduledFor: '2026-08-05T17:00:00.000Z',
        body: '',
        assetIds: [],
        variants: [],
        videoScript: '',
        complianceSummary: '',
        tags: [],
      },
      {
        ...base,
        id: 'c-published',
        title: 'Shipped already',
        status: 'published',
        format: 'post',
        channel: '',
        scheduledFor: '2026-08-05T08:00:00.000Z',
        body: '',
        assetIds: [],
        variants: [],
        videoScript: '',
        complianceSummary: '',
        tags: [],
      },
    ],
    opportunities: [
      {
        ...base,
        id: 'opp-stalled',
        name: 'Stalled deal',
        stage: 'proposal',
        valueCents: 100_000,
        probability: 40,
        nextStep: '',
        signal: '',
        leadSource: '',
        stageChangedAt: '2026-06-01T09:00:00.000Z',
      },
      {
        ...base,
        id: 'opp-won',
        name: 'Closed deal',
        stage: 'won',
        valueCents: 100_000,
        probability: 100,
        nextStep: '',
        signal: '',
        leadSource: '',
        stageChangedAt: '2026-01-01T09:00:00.000Z',
      },
    ],
    approvals: [
      {
        ...base,
        id: 'apr-late',
        title: 'Overdue gate',
        requestedBy: 'Operator',
        kind: 'spend',
        risk: 'warning',
        status: 'pending',
        summary: '',
        dueAt: '2026-08-02T09:00:00.000Z',
      },
    ],
    decisions: [
      {
        ...base,
        id: 'dec-late',
        title: 'Unmade call',
        status: 'proposed',
        context: '',
        choice: '',
        rationale: '',
        alternatives: [],
        impact: 'high',
        reversible: true,
        tags: [],
        dueAt: '2026-08-03T09:00:00.000Z',
      },
    ],
    memoryEntries: [
      {
        ...base,
        id: 'mem-stale',
        statement: 'Stale memory',
        detail: '',
        kind: 'fact',
        scope: 'operation',
        confidence: 'medium',
        origin: '',
        tags: [],
        pinned: false,
        recallCount: 0,
        reviewAt: '2026-07-01T09:00:00.000Z',
      },
    ],
    researchItems: [
      {
        ...base,
        id: 'res-late',
        question: 'Unanswered question',
        status: 'active',
        topic: '',
        answer: '',
        findings: [],
        tags: [],
        dueAt: '2026-08-01T09:00:00.000Z',
      },
    ],
    integrations: [integration('n8n', 'awaiting_credentials')],
    ...overrides,
  } as AutomationContext;
}

describe('automation vocabulary', () => {
  it('offers no action that could leave the browser except a hand-off that refuses', () => {
    expect(automationActionSchema.options).toEqual(['notify', 'open_approval', 'log_only', 'handoff']);
    for (const action of ['publish', 'send', 'post', 'email']) {
      expect(automationActionSchema.options as readonly string[]).not.toContain(action);
    }
  });

  it('offers no trigger that needs a scheduler or an inbound webhook', () => {
    for (const trigger of automationTriggerSchema.options) {
      expect(trigger).not.toContain('schedule');
      expect(trigger).not.toContain('webhook');
      expect(trigger).not.toContain('cron');
    }
  });

  it('labels and routes every trigger', () => {
    for (const trigger of automationTriggerSchema.options) {
      expect(automationTriggerLabel[trigger].length).toBeGreaterThan(0);
      expect(automationTriggerHref[trigger].startsWith('/')).toBe(true);
    }
  });

  it('opens a gate for an approval action, and for a gated notify', () => {
    expect(automationOpensGate({ action: 'open_approval', requiresApproval: false })).toBe(true);
    expect(automationOpensGate({ action: 'notify', requiresApproval: true })).toBe(true);
    expect(automationOpensGate({ action: 'notify', requiresApproval: false })).toBe(false);
    expect(automationOpensGate({ action: 'log_only', requiresApproval: true })).toBe(false);
  });

  it('defers only a notification behind a gate, never anything else', () => {
    expect(automationDeferredAction({ action: 'notify', requiresApproval: true })).toBe('notify');
    expect(automationDeferredAction({ action: 'open_approval', requiresApproval: true })).toBeNull();
    expect(automationDeferredAction({ action: 'handoff', requiresApproval: true })).toBeNull();
  });

  it('defaults a new rule to enabled and gated', () => {
    const parsed = rule();
    expect({ enabled: parsed.enabled, gated: parsed.requiresApproval, runs: parsed.runCount }).toEqual(
      { enabled: true, gated: true, runs: 0 },
    );
  });

  it('records a run that did nothing as a run', () => {
    const run = automationRunSchema.parse({
      id: 'run-1',
      source: 'local',
      createdAt: stamp,
      updatedAt: stamp,
      ruleId: 'aut-test',
      at: stamp,
      outcome: 'no_match',
    });
    expect({ matched: run.matched, by: run.invokedBy, ids: run.matchedIds }).toEqual({
      matched: 0,
      by: 'Operator',
      ids: [],
    });
  });
});

describe('date helpers', () => {
  it('treats a missing date as never past due', () => {
    expect(isPastDue(undefined, NOW)).toBe(false);
    expect(isPastDue('not a date', NOW)).toBe(false);
    expect(isPastDue('2026-08-04T09:00:00.000Z', NOW)).toBe(true);
    expect(isPastDue('2026-08-06T09:00:00.000Z', NOW)).toBe(false);
  });

  it('counts days in stage from the stage change, falling back to the update', () => {
    const [stalled] = context().opportunities;
    expect(daysInStage(stalled!, NOW)).toBe(65);
    expect(isStalledOpportunity(stalled!, NOW)).toBe(true);
  });

  it('never calls a closed deal stalled, however long it sat', () => {
    const won = context().opportunities[1];
    expect(daysInStage(won!, NOW)).toBeGreaterThan(STALL_DAYS);
    expect(isStalledOpportunity(won!, NOW)).toBe(false);
  });
});

describe('evaluateAutomation', () => {
  it('matches overdue work and ignores work already done', () => {
    const matches = evaluateAutomation({ trigger: 'task_overdue' }, context(), NOW);
    expect(matches.map((match) => match.id)).toEqual(['t-late']);
  });

  it('matches content dated today and ignores what already published', () => {
    const matches = evaluateAutomation({ trigger: 'content_due_today' }, context(), NOW);
    expect(matches.map((match) => match.id)).toEqual(['c-today']);
  });

  it('matches a stalled deal and ignores a closed one', () => {
    const matches = evaluateAutomation({ trigger: 'opportunity_stalled' }, context(), NOW);
    expect(matches.map((match) => match.id)).toEqual(['opp-stalled']);
    expect(matches[0]?.detail).toContain('proposal');
  });

  it('matches every other declared trigger against the store', () => {
    const cases: Record<string, string> = {
      approval_overdue: 'apr-late',
      decision_overdue: 'dec-late',
      memory_review_due: 'mem-stale',
      research_overdue: 'res-late',
      integration_credential_gap: 'n8n',
    };
    for (const [trigger, id] of Object.entries(cases)) {
      const matches = evaluateAutomation(
        { trigger: automationTriggerSchema.parse(trigger) },
        context(),
        NOW,
      );
      expect({ trigger, ids: matches.map((match) => match.id) }).toEqual({ trigger, ids: [id] });
    }
  });

  it('matches nothing against an empty store rather than failing', () => {
    const empty = context({
      tasks: [],
      contentItems: [],
      opportunities: [],
      approvals: [],
      decisions: [],
      memoryEntries: [],
      researchItems: [],
      integrations: [],
    });
    for (const trigger of automationTriggerSchema.options) {
      expect(evaluateAutomation({ trigger }, empty, NOW)).toEqual([]);
    }
  });

  it('is pure, so the surface can show what a run would do without running it', () => {
    const store = context();
    const first = evaluateAutomation({ trigger: 'task_overdue' }, store, NOW);
    const second = evaluateAutomation({ trigger: 'task_overdue' }, store, NOW);
    expect(first).toEqual(second);
    expect(store.tasks).toHaveLength(2);
  });
});

describe('automationReadiness', () => {
  it('refuses a disabled or archived rule', () => {
    expect(automationReadiness(rule({ enabled: false }), []).reason).toBe('disabled');
    expect(automationReadiness(rule({ archivedAt: stamp }), []).reason).toBe('disabled');
  });

  it('refuses a hand-off however the registry looks, because no connector ships here', () => {
    const readiness = automationReadiness(
      rule({ action: 'handoff', requiresIntegrationId: 'n8n' }),
      [integration('n8n', 'connected')],
    );
    expect({ runnable: readiness.runnable, reason: readiness.reason }).toEqual({
      runnable: false,
      reason: 'awaiting_credentials',
    });
    expect(readiness.statement).toContain('no connector runtime');
  });

  it('refuses a rule whose integration is not connected, and names it', () => {
    const readiness = automationReadiness(rule({ requiresIntegrationId: 'n8n' }), [
      integration('n8n', 'awaiting_credentials'),
    ]);
    expect(readiness.runnable).toBe(false);
    expect(readiness.statement).toContain('awaiting credentials');
  });

  it('refuses a rule naming an integration the registry does not carry', () => {
    const readiness = automationReadiness(rule({ requiresIntegrationId: 'ghost' }), []);
    expect(readiness.runnable).toBe(false);
    expect(readiness.statement).toContain('not in the registry');
  });

  it('runs a local rule, and says whether a gate stands in front of it', () => {
    expect(automationReadiness(rule({ requiresApproval: true }), []).statement).toContain('gate');
    const ungated = automationReadiness(rule({ requiresApproval: false }), []);
    expect({ runnable: ungated.runnable, reason: ungated.reason }).toEqual({
      runnable: true,
      reason: undefined,
    });
  });

  /**
   * The connected-probe invariant on the action side
   * (`docs/reviews/WAVE_7_GPT_REVIEW.md` H1). This gate decides whether a rule
   * may write, so it has to reach the same verdict `/integrations` shows — a
   * row hand-edited to `connected` with no probe behind it is not a connector.
   */
  it('refuses a rule whose integration claims Connected with no probe', () => {
    const readiness = automationReadiness(rule({ requiresIntegrationId: 'n8n' }), [
      unverified('n8n'),
    ]);

    expect({ runnable: readiness.runnable, reason: readiness.reason }).toEqual({
      runnable: false,
      reason: 'awaiting_credentials',
    });
    expect(readiness.statement).toContain('awaiting credentials');
  });

  it('refuses a rule whose integration carries an unparseable probe timestamp', () => {
    const readiness = automationReadiness(rule({ requiresIntegrationId: 'n8n' }), [
      integration('n8n', 'connected', 'whenever'),
    ]);

    expect(readiness.runnable).toBe(false);
    expect(readiness.statement).toContain('awaiting credentials');
  });

  it('runs a rule whose integration carries the probe that verified it', () => {
    const readiness = automationReadiness(rule({ requiresIntegrationId: 'n8n' }), [
      integration('n8n', 'connected'),
    ]);

    expect({ runnable: readiness.runnable, reason: readiness.reason }).toEqual({
      runnable: true,
      reason: undefined,
    });
  });

  it('counts an unverified Connected row as a credential gap, like every other surface', () => {
    const matches = evaluateAutomation(
      rule({ trigger: 'integration_credential_gap' }),
      context({ integrations: [unverified('n8n'), integration('slack', 'connected')] }),
      new Date(stamp),
    );

    expect(matches.map((match) => match.id)).toEqual(['n8n']);
  });
});

describe('mission transitions', () => {
  it('lets an active objective block, pause, or complete', () => {
    expect([...MISSION_TRANSITIONS.active]).toEqual(['blocked', 'paused', 'complete']);
    expect(canTransitionMission('active', 'complete')).toBe(true);
  });

  it('treats a complete objective as history', () => {
    expect([...MISSION_TRANSITIONS.complete]).toEqual([]);
    expect(canTransitionMission('complete', 'active')).toBe(false);
  });

  it('will not let a blocked objective jump straight to complete', () => {
    expect(canTransitionMission('blocked', 'complete')).toBe(false);
    expect(canTransitionMission('blocked', 'active')).toBe(true);
  });

  it('requires a reason only for blocked', () => {
    expect(missionNeedsReason('blocked')).toBe(true);
    for (const status of ['active', 'paused', 'complete'] as const) {
      expect(missionNeedsReason(status)).toBe(false);
    }
  });
});
