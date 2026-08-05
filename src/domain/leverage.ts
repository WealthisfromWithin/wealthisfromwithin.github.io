import { z } from 'zod';
import { idSchema, isoTimestamp, recordBase, severitySchema } from './common';
import type {
  Approval,
  ContentItem,
  Integration,
  MissionStatus,
  Opportunity,
  Task,
} from './entities';
import type { Decision, MemoryEntry, ResearchItem } from './cognition';

/**
 * Wave 6 domain: the leverage fabric.
 *
 * An automation here is a **local rule over the local store**. It has no
 * scheduler, no connector, and no way to reach anyone: the only things it can do
 * are write a notification into the inbox, open a gate in the Approval Queue,
 * and record that it ran. A rule that would need an external system declares the
 * integration row it needs, and refuses until that row is `connected` — which
 * nothing on this surface is. Nothing here can publish, send, or call out
 * (ARCHITECTURE_AUDIT §5.9, §7 Wave 6).
 */

/* ── Triggers ───────────────────────────────────────────────────────────── */

/**
 * Every trigger is a condition the local store can answer by looking. There is
 * no `on_schedule`, because nothing in a static bundle wakes up, and no
 * `on_webhook`, because nothing can receive one.
 */
export const automationTriggerSchema = z.enum([
  'task_overdue',
  'content_due_today',
  'opportunity_stalled',
  'approval_overdue',
  'decision_overdue',
  'memory_review_due',
  'research_overdue',
  'integration_credential_gap',
]);
export type AutomationTrigger = z.infer<typeof automationTriggerSchema>;

/**
 * What a rule is allowed to do, and the whole list of it.
 *
 * - `notify` — writes one signal into the inbox summarising what matched.
 * - `open_approval` — opens one gate in the Approval Queue and stops there.
 * - `log_only` — records the run and nothing else, which is what a rule an
 *   operator wants to watch before trusting should do.
 * - `handoff` — would pass the matched records to an external system. It never
 *   runs here: no connector runtime ships in this bundle, so it refuses and
 *   names the integration that would have to carry it.
 *
 * There is deliberately no `publish`, `send`, or `post`: those need a credential
 * this bundle cannot hold, and a local rule pretending to perform one is the
 * exact fake the audit exists to prevent. `handoff` is how the intent is
 * recorded without the pretence.
 */
export const automationActionSchema = z.enum(['notify', 'open_approval', 'log_only', 'handoff']);
export type AutomationAction = z.infer<typeof automationActionSchema>;

/**
 * True when running the rule opens a gate rather than writing its effect. An
 * `open_approval` rule is a gate by definition; a `notify` rule is one whenever
 * the WITHIN default is left on, which is what makes "the automation wrote this"
 * a thing a human agreed to.
 */
export function automationOpensGate(
  rule: Pick<AutomationRule, 'action' | 'requiresApproval'>,
): boolean {
  if (rule.action === 'open_approval') return true;
  return rule.action === 'notify' && rule.requiresApproval;
}

/**
 * The effect a gate approval will carry out, or `null` when clearing the gate is
 * the whole point. Nothing else can ever be deferred behind a gate.
 */
export function automationDeferredAction(
  rule: Pick<AutomationRule, 'action' | 'requiresApproval'>,
): 'notify' | null {
  return rule.action === 'notify' && rule.requiresApproval ? 'notify' : null;
}

export const automationRuleSchema = recordBase.extend({
  name: z.string().min(1),
  summary: z.string().default(''),
  trigger: automationTriggerSchema,
  action: automationActionSchema,
  /** Off means the rule is inert: a run against it is refused, not skipped quietly. */
  enabled: z.boolean().default(true),
  /**
   * WITHIN default: a rule that writes anything an operator would read passes a
   * human gate first. Rules whose action is `open_approval` are already a gate.
   */
  requiresApproval: z.boolean().default(true),
  impact: severitySchema.default('info'),
  /**
   * The integration row this rule would need to do its work elsewhere. Set means
   * the rule cannot run until that row is `connected`, and the refusal names it.
   */
  requiresIntegrationId: idSchema.optional(),
  notes: z.string().default(''),
  lastRunAt: isoTimestamp.optional(),
  runCount: z.number().int().nonnegative().default(0),
  archivedAt: isoTimestamp.optional(),
});
export type AutomationRule = z.infer<typeof automationRuleSchema>;

/* ── Runs ───────────────────────────────────────────────────────────────── */

/**
 * What one run did. A run that did nothing is recorded as having done nothing:
 * `no_match` is a first-class outcome, and so is `refused`.
 */
export const automationOutcomeSchema = z.enum([
  'applied',
  'gated',
  'declined',
  'no_match',
  'refused',
]);
export type AutomationOutcome = z.infer<typeof automationOutcomeSchema>;

/** Why a run could not do its work. Never a silent skip. */
export const automationRefusalSchema = z.enum([
  'disabled',
  'awaiting_credentials',
  'missing_rule',
  'gate_rejected',
]);
export type AutomationRefusal = z.infer<typeof automationRefusalSchema>;

export const automationRunSchema = recordBase.extend({
  ruleId: idSchema,
  at: isoTimestamp,
  outcome: automationOutcomeSchema,
  reason: automationRefusalSchema.optional(),
  /** How many local records the trigger matched when the run was evaluated. */
  matched: z.number().int().nonnegative().default(0),
  detail: z.string().default(''),
  /** Ids of the matched records, so a run can be audited against the store. */
  matchedIds: z.array(idSchema).default([]),
  /** Written only by an `applied` run whose action was `notify`. */
  notificationId: idSchema.optional(),
  /** The gate a `gated` run opened, and the one whose decision resolves it. */
  approvalId: idSchema.optional(),
  /** Runs are operator-invoked: nothing on this surface wakes up on its own. */
  invokedBy: z.string().default('Operator'),
});
export type AutomationRun = z.infer<typeof automationRunSchema>;

/* ── Trigger evaluation ─────────────────────────────────────────────────── */

/**
 * Days without a stage change before an opportunity counts as stalled. Lives in
 * the domain because both the pipeline surface and the automation evaluator ask
 * the question, and two thresholds would eventually disagree.
 */
export const STALL_DAYS = 14;

const DAY = 86_400_000;

function parsed(value: string | undefined): number | null {
  if (value === undefined) return null;
  const at = Date.parse(value);
  return Number.isNaN(at) ? null : at;
}

/** True when `value` is a date already in the past. Undefined is never past due. */
export function isPastDue(value: string | undefined, now: Date): boolean {
  const at = parsed(value);
  return at !== null && at < now.getTime();
}

export function daysInStage(opportunity: Opportunity, now: Date): number | null {
  const since = parsed(opportunity.stageChangedAt ?? opportunity.updatedAt);
  if (since === null) return null;
  return Math.floor((now.getTime() - since) / DAY);
}

export function isStalledOpportunity(opportunity: Opportunity, now: Date): boolean {
  if (opportunity.stage === 'won' || opportunity.stage === 'lost') return false;
  const days = daysInStage(opportunity, now);
  return days !== null && days >= STALL_DAYS;
}

function isToday(value: string | undefined, now: Date): boolean {
  const at = parsed(value);
  if (at === null) return false;
  const date = new Date(at);
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

/**
 * The slice of the local store a trigger can read. Narrower than the dataset on
 * purpose: an evaluator that can see everything eventually reads something a
 * rule has no business acting on.
 */
export interface AutomationContext {
  tasks: readonly Task[];
  contentItems: readonly ContentItem[];
  opportunities: readonly Opportunity[];
  approvals: readonly Approval[];
  decisions: readonly Decision[];
  memoryEntries: readonly MemoryEntry[];
  researchItems: readonly ResearchItem[];
  integrations: readonly Integration[];
}

export interface AutomationMatch {
  /** The record that matched, so a run can be audited against the store. */
  id: string;
  label: string;
  detail: string;
}

export const automationTriggerLabel: Record<AutomationTrigger, string> = {
  task_overdue: 'A task is past its due date',
  content_due_today: 'Content is dated today and not published',
  opportunity_stalled: `An opportunity has not moved in ${String(STALL_DAYS)} days`,
  approval_overdue: 'A gate is past the date it was needed by',
  decision_overdue: 'A decision is past the date the call was due',
  memory_review_due: 'A memory is past its review date',
  research_overdue: 'A question is past its due date with no answer',
  integration_credential_gap: 'An integration is awaiting credentials',
};

/**
 * Where a signal written by each trigger should land. These are internal routes
 * only, and `src/app/href.test.ts` asserts every one of them passes
 * `isSafeInternalHref` — a notification the write path produces must point
 * somewhere the router actually serves.
 */
export const automationTriggerHref: Record<AutomationTrigger, string> = {
  task_overdue: '/tasks?status=open',
  content_due_today: '/content/calendar',
  opportunity_stalled: '/pipeline',
  approval_overdue: '/approvals',
  decision_overdue: '/decisions?status=proposed',
  memory_review_due: '/memory?state=review',
  research_overdue: '/research',
  integration_credential_gap: '/integrations?state=awaiting_credentials',
};

export const automationActionLabel: Record<AutomationAction, string> = {
  notify: 'Write one signal to the inbox',
  open_approval: 'Open one gate in the Approval Queue',
  log_only: 'Record the run and nothing else',
  handoff: 'Hand the matched records to an external system',
};

/**
 * Reads the trigger against the local store and returns what matched. Pure, so
 * the surface can show what a rule *would* act on without running it, and the
 * write path can run exactly what the surface showed.
 */
export function evaluateAutomation(
  rule: Pick<AutomationRule, 'trigger'>,
  context: AutomationContext,
  now: Date,
): AutomationMatch[] {
  switch (rule.trigger) {
    case 'task_overdue':
      return context.tasks
        .filter((task) => task.status !== 'done' && isPastDue(task.dueAt, now))
        .map((task) => ({
          id: task.id,
          label: task.title,
          detail: `${task.priority} priority, due ${String(task.dueAt).slice(0, 10)}`,
        }));

    case 'content_due_today':
      return context.contentItems
        .filter(
          (item) =>
            item.status !== 'published' &&
            item.status !== 'archived' &&
            isToday(item.scheduledFor, now),
        )
        .map((item) => ({
          id: item.id,
          label: item.title,
          detail: `dated today and still ${item.status.replace('_', ' ')}`,
        }));

    case 'opportunity_stalled':
      return context.opportunities
        .filter((opportunity) => isStalledOpportunity(opportunity, now))
        .map((opportunity) => ({
          id: opportunity.id,
          label: opportunity.name,
          detail: `${String(daysInStage(opportunity, now) ?? 0)} days in ${opportunity.stage}`,
        }));

    case 'approval_overdue':
      return context.approvals
        .filter((approval) => approval.status === 'pending' && isPastDue(approval.dueAt, now))
        .map((approval) => ({
          id: approval.id,
          label: approval.title,
          detail: `${approval.kind} gate, ${approval.risk} risk`,
        }));

    case 'decision_overdue':
      return context.decisions
        .filter((decision) => decision.status === 'proposed' && isPastDue(decision.dueAt, now))
        .map((decision) => ({
          id: decision.id,
          label: decision.title,
          detail: decision.reversible ? `${decision.impact} impact` : 'one-way door',
        }));

    case 'memory_review_due':
      return context.memoryEntries
        .filter((entry) => entry.retiredAt === undefined && isPastDue(entry.reviewAt, now))
        .map((entry) => ({
          id: entry.id,
          label: entry.statement,
          detail: `${entry.kind} · ${entry.confidence}`,
        }));

    case 'research_overdue':
      return context.researchItems
        .filter(
          (item) =>
            item.status !== 'answered' && item.status !== 'parked' && isPastDue(item.dueAt, now),
        )
        .map((item) => ({
          id: item.id,
          label: item.question,
          detail: `${String(item.findings.length)} findings, no answer`,
        }));

    case 'integration_credential_gap':
      return context.integrations
        .filter((integration) => integration.state === 'awaiting_credentials')
        .map((integration) => ({
          id: integration.id,
          label: integration.name,
          detail: `${integration.category} connector awaiting credentials`,
        }));
  }
}

/**
 * Whether a rule could run right now, and why not when it could not. The
 * integration gate is the honest half: a rule that names a connector cannot run
 * until that connector is verified, and nothing on this surface is.
 */
export interface AutomationReadiness {
  runnable: boolean;
  reason?: AutomationRefusal;
  statement: string;
}

export function automationReadiness(
  rule: AutomationRule,
  integrations: readonly Integration[],
): AutomationReadiness {
  if (!rule.enabled || rule.archivedAt !== undefined) {
    return {
      runnable: false,
      reason: 'disabled',
      statement: 'Disabled. Enable it before it can evaluate anything.',
    };
  }

  const integration =
    rule.requiresIntegrationId === undefined
      ? undefined
      : integrations.find((entry) => entry.id === rule.requiresIntegrationId);

  // A handoff never runs from this bundle, whatever the registry says. There is
  // no connector client here, so a `connected` row would not make the call
  // possible — it would only make the refusal dishonest.
  if (rule.action === 'handoff') {
    return {
      runnable: false,
      reason: 'awaiting_credentials',
      statement: `Would hand off to ${
        integration?.name ?? rule.requiresIntegrationId ?? 'an external system'
      }. This surface has no connector runtime, so nothing is sent and the run is recorded as refused.`,
    };
  }

  if (rule.requiresIntegrationId !== undefined && integration?.state !== 'connected') {
    return {
      runnable: false,
      reason: 'awaiting_credentials',
      statement: `Needs ${integration?.name ?? rule.requiresIntegrationId}, which is ${
        integration === undefined ? 'not in the registry' : integration.state.replace('_', ' ')
      }. Nothing is sent there.`,
    };
  }

  return {
    runnable: true,
    statement: rule.requiresApproval
      ? 'Runs locally, and opens a gate before anything is written.'
      : 'Runs locally against the store.',
  };
}

/* ── Missions ───────────────────────────────────────────────────────────── */

/**
 * The legal moves for an objective. A complete mission is history: reopening one
 * means writing the next mission, not editing the record of the last.
 */
export const MISSION_TRANSITIONS: Record<MissionStatus, readonly MissionStatus[]> = {
  active: ['blocked', 'paused', 'complete'],
  blocked: ['active', 'paused'],
  paused: ['active'],
  complete: [],
};

export function canTransitionMission(from: MissionStatus, to: MissionStatus): boolean {
  return MISSION_TRANSITIONS[from].includes(to);
}

/** A blocked mission must say what is blocking it, or the status means nothing. */
export function missionNeedsReason(status: MissionStatus): boolean {
  return status === 'blocked';
}
