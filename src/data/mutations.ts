import { db, type SovereignDb } from './db';
import {
  automationDeferredAction,
  automationOpensGate,
  automationReadiness,
  automationTriggerHref,
  canTransitionContent,
  canTransitionDecision,
  canTransitionMission,
  checkContent,
  contentComplianceInputs,
  evaluateAutomation,
  missionNeedsReason,
  type ActivityEvent,
  type AgentMessage,
  type AgentSession,
  type Approval,
  type ApprovalStatus,
  type AutomationAction,
  type AutomationContext,
  type AutomationMatch,
  type AutomationOutcome,
  type AutomationRule,
  type AutomationRun,
  type AutomationTrigger,
  type ComplianceResult,
  type ContentIdea,
  type ContentItem,
  type ContentStatus,
  type Decision,
  type DecisionStatus,
  type IntegrationState,
  type KnowledgeKind,
  type KnowledgeNode,
  type MemoryConfidence,
  type MemoryEntry,
  type MemoryKind,
  type MemoryScope,
  type Mission,
  type MissionStatus,
  type Notification,
  type PipelineStage,
  type Priority,
  type Prompt,
  type PromptIntent,
  type ResearchItem,
  type ResearchStatus,
  type SovereignDocument,
  type Task,
  type TaskStatus,
} from '@/domain';
import type { AgentKernel, AgentRequest, AgentResult } from '@/agents';

/**
 * Wave 2 is the first wave that writes to the local store. Every mutation stamps
 * `touchedAt`, which is what keeps the demo seeder from silently undoing an
 * operator decision on its next refresh (see `seedDemoData`).
 */

/** The only actor this surface has. Real identity arrives with the Command API. */
const OPERATOR = 'Operator';

const decisionTitle: Record<ApprovalStatus, string> = {
  approved: 'Approval granted',
  rejected: 'Approval rejected',
  pending: 'Approval reopened',
};

export async function setNotificationRead(
  id: string,
  read: boolean,
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<boolean> {
  const stamp = now.toISOString();
  const updated = await database.notifications.update(id, {
    read,
    readAt: read ? stamp : undefined,
    updatedAt: stamp,
    touchedAt: stamp,
  });
  return updated > 0;
}

/** Returns how many rows changed, so the caller can report an honest count. */
export async function markAllNotificationsRead(
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<number> {
  const stamp = now.toISOString();
  return database.notifications
    .filter((notification) => !notification.read)
    .modify({ read: true, readAt: stamp, updatedAt: stamp, touchedAt: stamp });
}

function decisionEvent(approval: Approval, status: ApprovalStatus, now: Date): ActivityEvent {
  const stamp = now.toISOString();
  return {
    id: `e-approval-${approval.id}-${String(now.getTime())}`,
    // The audit row inherits the provenance of the record it describes: a
    // decision about a demo gate is not operational history.
    source: approval.source,
    createdAt: stamp,
    updatedAt: stamp,
    touchedAt: stamp,
    at: stamp,
    title: `${decisionTitle[status]}: ${approval.title}`,
    detail: `${approval.kind} gate requested by ${approval.requestedBy}.`,
    channel: 'system',
  };
}

/**
 * What a queue decision did. A content gate runs the content workflow, which can
 * refuse — blocking copy, or a move the status machine does not allow — so the
 * decision reports why nothing happened rather than returning a bare `false`.
 */
export interface ApprovalDecisionResult {
  ok: boolean;
  reason?: string;
  compliance?: ComplianceResult;
  /** Set when the gate belonged to an automation run, which moved with it. */
  automationOutcome?: AutomationOutcome;
}

const alreadyDecided: Record<ApprovalStatus, string> = {
  approved: 'Already approved.',
  rejected: 'Already rejected.',
  pending: 'Already open.',
};

/** Writes the gate row and the audit line, skipping a write a content writer already made. */
async function writeApprovalDecision(
  approval: Approval,
  status: ApprovalStatus,
  database: SovereignDb,
  now: Date,
): Promise<void> {
  const stamp = now.toISOString();
  const current = await database.approvals.get(approval.id);
  if (current && current.status !== status) {
    await database.approvals.update(approval.id, {
      status,
      updatedAt: stamp,
      touchedAt: stamp,
      decidedAt: status === 'pending' ? undefined : stamp,
      decidedBy: status === 'pending' ? undefined : OPERATOR,
    });
  }
  await database.events.put(decisionEvent(approval, status, now));
}

/**
 * Moves a gate between open, cleared, and refused, and records the decision as
 * an activity event so the Brief and the Health log show it happened.
 *
 * A `content` gate is only half of a content decision: the other half is the
 * item it guards. Deciding one here runs the same writers the Content OS uses,
 * so the queue can never report a gate as closed while the copy it holds is
 * still in review. `override` carries the operator's decision to approve copy
 * the local compliance check refused, exactly as the package page does.
 *
 * A gate an automation run opened is the same shape of problem: the run is the
 * other half, so the decision moves it too (Wave 6). A queue that could close an
 * automation gate while the run behind it still read "waiting" would be the same
 * disagreement in a different module.
 */
export async function decideApproval(
  id: string,
  status: ApprovalStatus,
  options: { override?: boolean } = {},
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<ApprovalDecisionResult> {
  return database.transaction(
    'rw',
    [
      database.approvals,
      database.contentItems,
      database.automations,
      database.automationRuns,
      database.notifications,
      database.events,
    ],
    async () => {
      const approval = await database.approvals.get(id);
      if (!approval) return { ok: false, reason: 'No gate with that id is in the local store.' };
      if (approval.status === status) return { ok: false, reason: alreadyDecided[status] };

      // A content gate with no item behind it is just a gate, and is decided as
      // one; anything else is decided through the content loop.
      const item =
        approval.kind === 'content'
          ? await database.contentItems.filter((row) => row.approvalId === approval.id).first()
          : undefined;

      if (item) {
        const result = await decideContentGate(item, status, options, database, now);
        // The gate is left untouched on a refusal: a decided gate on an item
        // that did not move is the disagreement this path exists to prevent.
        if (!result.ok) return result;
        await writeApprovalDecision(approval, status, database, now);
        return { ok: true, compliance: result.compliance };
      }

      if (approval.automationRunId !== undefined) {
        const result = await decideAutomationGate(approval, status, database, now);
        if (!result.ok) return result;
        await writeApprovalDecision(approval, status, database, now);
        return result;
      }

      await writeApprovalDecision(approval, status, database, now);
      return { ok: true };
    },
  );
}

/* ── Wave 3: execution, revenue, and time ───────────────────────────────── */

/**
 * An activity row describing a mutation. It inherits the provenance of the
 * record it describes, so moving a demo opportunity does not invent operational
 * history (and is cleared with the rest of the demo data).
 */
function activityFor(
  record: { id: string; source: ActivityEvent['source'] },
  prefix: string,
  channel: ActivityEvent['channel'],
  title: string,
  detail: string,
  now: Date,
): ActivityEvent {
  const stamp = now.toISOString();
  return {
    id: `e-${prefix}-${record.id}-${String(now.getTime())}`,
    source: record.source,
    createdAt: stamp,
    updatedAt: stamp,
    touchedAt: stamp,
    at: stamp,
    title,
    detail,
    channel,
  };
}

const taskStatusVerb: Record<TaskStatus, string> = {
  todo: 'Task reopened',
  in_progress: 'Task started',
  blocked: 'Task blocked',
  done: 'Task completed',
};

/**
 * Moves a task and records the movement. `completedAt` is set only by reaching
 * `done` and cleared on the way out, so a reopened task does not keep a
 * completion date it no longer has. `blockedSince` and `blockedReason` are set
 * only while `blocked` and cleared on the way out, so a task that has moved on
 * does not keep showing a stale blocker.
 */
export async function setTaskStatus(
  id: string,
  status: TaskStatus,
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<boolean> {
  return database.transaction('rw', [database.tasks, database.events], async () => {
    const task = await database.tasks.get(id);
    if (!task || task.status === status) return false;

    const stamp = now.toISOString();
    await database.tasks.update(id, {
      status,
      updatedAt: stamp,
      touchedAt: stamp,
      completedAt: status === 'done' ? stamp : undefined,
      // A task that is no longer blocked has no blocking reason to show.
      blockedSince: status === 'blocked' ? (task.blockedSince ?? stamp) : undefined,
      blockedReason: status === 'blocked' ? task.blockedReason : undefined,
    });
    await database.events.put(
      activityFor(
        task,
        'task',
        'execution',
        `${taskStatusVerb[status]}: ${task.title}`,
        task.context,
        now,
      ),
    );
    return true;
  });
}

export async function setTaskPriority(
  id: string,
  priority: Priority,
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<boolean> {
  const stamp = now.toISOString();
  const updated = await database.tasks.update(id, {
    priority,
    updatedAt: stamp,
    touchedAt: stamp,
  });
  return updated > 0;
}

export interface NewTask {
  title: string;
  priority?: Priority;
  dueAt?: string;
  projectId?: string;
  personId?: string;
  opportunityId?: string;
  context?: string;
}

/**
 * Operator-authored tasks are `local`, never `demo`: the surface must not badge
 * real work as sample data, and the seeder must never remove it.
 */
export async function createTask(
  input: NewTask,
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<Task | null> {
  const title = input.title.trim();
  if (title.length === 0) return null;

  const stamp = now.toISOString();
  const task: Task = {
    id: `t-local-${String(now.getTime())}-${Math.random().toString(36).slice(2, 8)}`,
    source: 'local',
    createdAt: stamp,
    updatedAt: stamp,
    touchedAt: stamp,
    title,
    status: 'todo',
    priority: input.priority ?? 'normal',
    dueAt: input.dueAt,
    projectId: input.projectId,
    personId: input.personId,
    opportunityId: input.opportunityId,
    context: input.context ?? '',
  };

  await database.transaction('rw', [database.tasks, database.events], async () => {
    await database.tasks.add(task);
    await database.events.put(
      activityFor(task, 'task', 'execution', `Task created: ${task.title}`, task.context, now),
    );
  });

  return task;
}

/**
 * Moves an opportunity between stages. A closed deal has a settled probability —
 * won is 100 and lost is 0 — which is arithmetic, not a forecast. Every other
 * stage keeps whatever probability the record already carried; this surface does
 * not invent a score.
 */
export async function setOpportunityStage(
  id: string,
  stage: PipelineStage,
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<boolean> {
  return database.transaction('rw', [database.opportunities, database.events], async () => {
    const opportunity = await database.opportunities.get(id);
    if (!opportunity || opportunity.stage === stage) return false;

    const stamp = now.toISOString();
    await database.opportunities.update(id, {
      stage,
      stageChangedAt: stamp,
      updatedAt: stamp,
      touchedAt: stamp,
      probability:
        stage === 'won' ? 100 : stage === 'lost' ? 0 : opportunity.probability,
    });
    await database.events.put(
      activityFor(
        opportunity,
        'opportunity',
        'pipeline',
        `Stage moved to ${stage}: ${opportunity.name}`,
        `Was ${opportunity.stage}.`,
        now,
      ),
    );
    return true;
  });
}

/* ── Wave 4: the content loop ───────────────────────────────────────────── */

const contentStatusVerb: Record<ContentStatus, string> = {
  idea: 'Content returned to the vault',
  drafting: 'Content moved to drafting',
  in_review: 'Content submitted for review',
  approved: 'Content approved',
  scheduled: 'Content scheduled',
  published: 'Publish recorded',
  archived: 'Content archived',
  blocked: 'Content blocked',
};

/**
 * Every content write reports why it refused, because the queue's buttons are
 * driven by a status machine and a compliance gate: "nothing happened" is never
 * a sufficient answer.
 */
export interface ContentMutationResult {
  ok: boolean;
  reason?: string;
  compliance?: ComplianceResult;
}

/**
 * Moves that need something the caller has not supplied, and the writer that
 * asks for it. Routing them here keeps the compliance gate un-bypassable: there
 * is no path to `approved` that does not run `checkContent` first.
 */
const GUARDED_TRANSITIONS: Partial<Record<ContentStatus, string>> = {
  in_review: 'Review opens a gate in the Approval Queue. Use submitContentForReview.',
  approved: 'Approval runs the local compliance check. Use approveContentItem.',
  scheduled: 'Scheduling needs a publish date. Use scheduleContentItem.',
  published: 'Publishing is recorded, never performed here. Use recordContentPublished.',
};

function contentEvent(
  item: ContentItem,
  status: ContentStatus,
  detail: string,
  now: Date,
): ActivityEvent {
  return activityFor(
    item,
    'content',
    'content',
    `${contentStatusVerb[status]}: ${item.title}`,
    detail,
    now,
  );
}

/**
 * A signal about a content item, inheriting its provenance so a demo gate does
 * not leave an operational-looking notification behind after the demo is cleared.
 */
function contentNotification(
  item: ContentItem,
  suffix: string,
  title: string,
  body: string,
  href: string,
  now: Date,
): Notification {
  const stamp = now.toISOString();
  return {
    id: `n-content-${suffix}-${item.id}`,
    source: item.source,
    createdAt: stamp,
    updatedAt: stamp,
    touchedAt: stamp,
    title,
    body,
    severity: 'info',
    read: false,
    origin: 'Content loop',
    href,
  };
}

function refuseMove(item: ContentItem | undefined, status: ContentStatus): string | null {
  if (!item) return 'No content item with that id is in the local store.';
  if (item.status === status) return `Already ${status.replace('_', ' ')}.`;
  if (!canTransitionContent(item.status, status)) {
    return `A ${item.status.replace('_', ' ')} item cannot move straight to ${status.replace('_', ' ')}.`;
  }
  return null;
}

/**
 * The plain moves: into drafting, back to the vault, blocked, archived. The
 * four that need more than a status — submit, approve, schedule, publish — have
 * their own writers and are refused here.
 */
export async function setContentStatus(
  id: string,
  status: ContentStatus,
  options: { blockedReason?: string } = {},
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<ContentMutationResult> {
  const guarded = GUARDED_TRANSITIONS[status];
  if (guarded) return { ok: false, reason: guarded };

  return database.transaction('rw', [database.contentItems, database.events], async () => {
    const item = await database.contentItems.get(id);
    const refusal = refuseMove(item, status);
    if (!item || refusal) return { ok: false, reason: refusal ?? undefined };

    const stamp = now.toISOString();
    await database.contentItems.update(id, {
      status,
      updatedAt: stamp,
      touchedAt: stamp,
      // A item that has moved on does not keep showing the blocker it left.
      blockedReason: status === 'blocked' ? (options.blockedReason ?? item.blockedReason) : undefined,
    });
    await database.events.put(
      contentEvent(item, status, `Was ${item.status.replace('_', ' ')}.`, now),
    );
    return { ok: true };
  });
}

/**
 * Opens the human gate. The item moves to `in_review` and an Approval row is
 * created in the queue so content approvals live where every other approval
 * does, rather than in a second queue nobody reads.
 */
export async function submitContentForReview(
  id: string,
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<ContentMutationResult> {
  return database.transaction(
    'rw',
    [database.contentItems, database.approvals, database.notifications, database.events],
    async () => {
      const item = await database.contentItems.get(id);
      const refusal = refuseMove(item, 'in_review');
      if (!item || refusal) return { ok: false, reason: refusal ?? undefined };

      const stamp = now.toISOString();
      const approvalId = item.approvalId ?? `apr-content-${item.id}`;
      const existing = await database.approvals.get(approvalId);

      const approval: Approval = {
        ...(existing ?? {
          id: approvalId,
          source: item.source,
          createdAt: stamp,
          kind: 'content' as const,
          risk: 'warning' as const,
          requestedBy: 'Content loop',
        }),
        updatedAt: stamp,
        touchedAt: stamp,
        title: `Publish "${item.title}"${item.channel.length > 0 ? ` to ${item.channel}` : ''}`,
        status: 'pending',
        summary: 'Customer-facing copy. The WITHIN constitution requires a human gate.',
        dueAt: item.scheduledFor,
        decidedAt: undefined,
        decidedBy: undefined,
      };

      await database.approvals.put(approval);
      await database.contentItems.update(id, {
        status: 'in_review',
        approvalId,
        updatedAt: stamp,
        touchedAt: stamp,
        blockedReason: undefined,
      });
      await database.notifications.put(
        contentNotification(
          item,
          'review',
          `"${item.title}" is waiting on a human gate`,
          'Submitted for review. Nothing publishes without an approval.',
          '/approvals',
          now,
        ),
      );
      await database.events.put(
        contentEvent(item, 'in_review', `Gate ${approvalId} opened in the Approval Queue.`, now),
      );
      return { ok: true };
    },
  );
}

/**
 * Runs the local keyword policy and, if nothing blocking matched, approves the
 * item and clears its gate. A blocking finding refuses the approval and hands
 * back the findings; `override` records the operator's decision to approve
 * anyway on the item and in the event log rather than hiding it.
 */
export async function approveContentItem(
  id: string,
  options: { override?: boolean } = {},
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<ContentMutationResult> {
  return database.transaction(
    'rw',
    [database.contentItems, database.approvals, database.events],
    async () => {
      const item = await database.contentItems.get(id);
      const refusal = refuseMove(item, 'approved');
      if (!item || refusal) return { ok: false, reason: refusal ?? undefined };

      const compliance = checkContent(contentComplianceInputs(item));
      if (compliance.blocking && options.override !== true) {
        return {
          ok: false,
          reason: 'The local compliance check found blocking language. Fix it or override.',
          compliance,
        };
      }

      const stamp = now.toISOString();
      const overridden = compliance.blocking && options.override === true;
      const summary = overridden
        ? `${compliance.summary} Approved by operator override.`
        : compliance.summary;

      await database.contentItems.update(id, {
        status: 'approved',
        complianceCheckedAt: stamp,
        complianceSummary: summary,
        updatedAt: stamp,
        touchedAt: stamp,
        blockedReason: undefined,
      });

      if (item.approvalId !== undefined) {
        const approval = await database.approvals.get(item.approvalId);
        if (approval && approval.status !== 'approved') {
          await database.approvals.update(item.approvalId, {
            status: 'approved',
            decidedAt: stamp,
            decidedBy: OPERATOR,
            updatedAt: stamp,
            touchedAt: stamp,
          });
        }
      }

      await database.events.put(contentEvent(item, 'approved', summary, now));
      return { ok: true, compliance };
    },
  );
}

/**
 * The paired half of `approveContentItem`: the gate refuses the copy. The item
 * leaves review for drafting, because refused copy is work to be redone rather
 * than work that is waiting, and the gate closes as rejected in the same write.
 */
export async function rejectContentItem(
  id: string,
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<ContentMutationResult> {
  return database.transaction(
    'rw',
    [database.contentItems, database.approvals, database.events],
    async () => {
      const item = await database.contentItems.get(id);
      if (!item) return { ok: false, reason: 'No content item with that id is in the local store.' };
      if (item.status !== 'drafting' && !canTransitionContent(item.status, 'drafting')) {
        return {
          ok: false,
          reason: `A ${item.status.replace('_', ' ')} item cannot be returned to drafting, so the gate is left open.`,
        };
      }

      const stamp = now.toISOString();
      if (item.status !== 'drafting') {
        await database.contentItems.update(id, {
          status: 'drafting',
          updatedAt: stamp,
          touchedAt: stamp,
          blockedReason: undefined,
        });
        await database.events.put(
          contentEvent(item, 'drafting', 'Refused at the human gate. Returned to drafting.', now),
        );
      }

      if (item.approvalId !== undefined) {
        const approval = await database.approvals.get(item.approvalId);
        if (approval && approval.status !== 'rejected') {
          await database.approvals.update(item.approvalId, {
            status: 'rejected',
            decidedAt: stamp,
            decidedBy: OPERATOR,
            updatedAt: stamp,
            touchedAt: stamp,
          });
        }
      }

      return { ok: true };
    },
  );
}

/**
 * The content half of an Approval Queue decision, expressed in the writers the
 * Content OS itself uses. Reopening submits the item for review again, which is
 * what an open gate means: the copy is back in front of the operator.
 */
async function decideContentGate(
  item: ContentItem,
  status: ApprovalStatus,
  options: { override?: boolean },
  database: SovereignDb,
  now: Date,
): Promise<ContentMutationResult> {
  if (status === 'approved') {
    // The item is already through; only the gate is out of step with it.
    if (item.status === 'approved') return { ok: true };
    return approveContentItem(item.id, options, database, now);
  }
  if (status === 'rejected') return rejectContentItem(item.id, database, now);
  if (item.status === 'in_review') return { ok: true };
  return submitContentForReview(item.id, database, now);
}

/** Puts an approved item on a date. Scheduling writes a date, not a job. */
export async function scheduleContentItem(
  id: string,
  publishAt: string,
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<ContentMutationResult> {
  if (Number.isNaN(Date.parse(publishAt))) {
    return { ok: false, reason: 'That is not a date this surface can read.' };
  }

  return database.transaction('rw', [database.contentItems, database.events], async () => {
    const item = await database.contentItems.get(id);
    if (!item) return { ok: false, reason: 'No content item with that id is in the local store.' };
    if (item.status !== 'scheduled' && !canTransitionContent(item.status, 'scheduled')) {
      return { ok: false, reason: `A ${item.status.replace('_', ' ')} item cannot be scheduled.` };
    }

    const stamp = now.toISOString();
    await database.contentItems.update(id, {
      status: 'scheduled',
      scheduledFor: new Date(publishAt).toISOString(),
      updatedAt: stamp,
      touchedAt: stamp,
      blockedReason: undefined,
    });
    await database.events.put(
      contentEvent(
        item,
        'scheduled',
        `Publish date set to ${publishAt.slice(0, 10)}. Nothing is queued with a provider.`,
        now,
      ),
    );
    return { ok: true };
  });
}

/**
 * Records that the operator published the item themselves. It is deliberately
 * not called `publish`: no credential on this surface can reach LinkedIn,
 * Facebook, or anything else, so the only honest write is the record of a
 * publish that already happened elsewhere.
 */
export async function recordContentPublished(
  id: string,
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<ContentMutationResult> {
  return database.transaction('rw', [database.contentItems, database.events], async () => {
    const item = await database.contentItems.get(id);
    const refusal = refuseMove(item, 'published');
    if (!item || refusal) return { ok: false, reason: refusal ?? undefined };

    const stamp = now.toISOString();
    await database.contentItems.update(id, {
      status: 'published',
      publishedAt: stamp,
      scheduledFor: item.scheduledFor ?? stamp,
      updatedAt: stamp,
      touchedAt: stamp,
      blockedReason: undefined,
    });
    await database.events.put(
      contentEvent(
        item,
        'published',
        'Recorded by the operator. No connector confirmed a publish.',
        now,
      ),
    );
    return { ok: true };
  });
}

export interface NewContentIdea {
  title: string;
  summary?: string;
  reach?: number;
  effort?: number;
  confidence?: number;
  origin?: string;
  campaignId?: string;
  tags?: string[];
}

function clampScore(value: number | undefined, fallback: number): number {
  if (value === undefined || Number.isNaN(value)) return fallback;
  return Math.min(5, Math.max(1, Math.round(value)));
}

/** Captured ideas are operator-owned, so no reseed and no opt-out removes them. */
export async function captureContentIdea(
  input: NewContentIdea,
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<ContentIdea | null> {
  const title = input.title.trim();
  if (title.length === 0) return null;

  const stamp = now.toISOString();
  const idea: ContentIdea = {
    id: `idea-local-${String(now.getTime())}-${Math.random().toString(36).slice(2, 8)}`,
    source: 'local',
    createdAt: stamp,
    updatedAt: stamp,
    touchedAt: stamp,
    title,
    summary: input.summary?.trim() ?? '',
    status: 'captured',
    reach: clampScore(input.reach, 3),
    effort: clampScore(input.effort, 3),
    confidence: clampScore(input.confidence, 3),
    origin: input.origin ?? 'Captured in the vault',
    tags: input.tags ?? [],
    campaignId: input.campaignId,
  };

  await database.transaction('rw', [database.contentIdeas, database.events], async () => {
    await database.contentIdeas.add(idea);
    await database.events.put(
      activityFor(idea, 'idea', 'content', `Idea captured: ${idea.title}`, idea.summary, now),
    );
  });

  return idea;
}

export async function scoreContentIdea(
  id: string,
  scores: { reach?: number; effort?: number; confidence?: number },
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<boolean> {
  const idea = await database.contentIdeas.get(id);
  if (!idea) return false;

  const stamp = now.toISOString();
  const updated = await database.contentIdeas.update(id, {
    reach: clampScore(scores.reach, idea.reach),
    effort: clampScore(scores.effort, idea.effort),
    confidence: clampScore(scores.confidence, idea.confidence),
    updatedAt: stamp,
    touchedAt: stamp,
  });
  return updated > 0;
}

export async function setIdeaStatus(
  id: string,
  status: ContentIdea['status'],
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<boolean> {
  const stamp = now.toISOString();
  const updated = await database.contentIdeas.update(id, {
    status,
    updatedAt: stamp,
    touchedAt: stamp,
  });
  return updated > 0;
}

export interface PromotedIdea {
  idea: ContentIdea;
  item: ContentItem;
}

/**
 * Turns an idea into a draft and links the two, so the vault stops offering an
 * idea that is already being written and the draft can say where it came from.
 */
export async function promoteContentIdea(
  id: string,
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<PromotedIdea | null> {
  return database.transaction(
    'rw',
    [database.contentIdeas, database.contentItems, database.events],
    async () => {
      const idea = await database.contentIdeas.get(id);
      if (!idea || idea.promotedItemId !== undefined) return null;

      const stamp = now.toISOString();
      const item: ContentItem = {
        id: `c-local-${String(now.getTime())}-${Math.random().toString(36).slice(2, 8)}`,
        source: 'local',
        createdAt: stamp,
        updatedAt: stamp,
        touchedAt: stamp,
        title: idea.title,
        status: 'drafting',
        format: 'post',
        channel: '',
        body: idea.summary,
        ideaId: idea.id,
        campaignId: idea.campaignId,
        assetIds: [],
        variants: [],
        videoScript: '',
        complianceSummary: '',
        tags: idea.tags,
      };

      await database.contentItems.add(item);
      await database.contentIdeas.update(id, {
        status: 'promoted',
        promotedItemId: item.id,
        updatedAt: stamp,
        touchedAt: stamp,
      });
      await database.events.put(
        activityFor(
          item,
          'content',
          'content',
          `Idea promoted to draft: ${item.title}`,
          `From the vault entry ${idea.id}.`,
          now,
        ),
      );

      return { idea: { ...idea, status: 'promoted', promotedItemId: item.id }, item };
    },
  );
}

/* ── Wave 5: cognition ──────────────────────────────────────────────────── */

/**
 * Operator-authored cognition rows are `local`, never `demo`: a memory the
 * operator saved is not sample data, and neither a reseed nor the demo opt-out
 * may remove it.
 */
function localId(prefix: string, now: Date): string {
  return `${prefix}-local-${String(now.getTime())}-${Math.random().toString(36).slice(2, 8)}`;
}

function cognitionEvent(
  record: { id: string; source: ActivityEvent['source'] },
  prefix: string,
  title: string,
  detail: string,
  now: Date,
): ActivityEvent {
  return activityFor(record, prefix, 'cognition', title, detail, now);
}

function cleanTags(tags: string[] | undefined): string[] {
  return (tags ?? []).map((tag) => tag.trim()).filter((tag) => tag.length > 0);
}

export interface NewKnowledgeNode {
  title: string;
  kind?: KnowledgeKind;
  summary?: string;
  body?: string;
  tags?: string[];
  origin?: string;
  personIds?: string[];
  companyId?: string;
  opportunityId?: string;
  contentItemId?: string;
  meetingId?: string;
  documentIds?: string[];
  relatedNodeIds?: string[];
}

export async function captureKnowledgeNode(
  input: NewKnowledgeNode,
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<KnowledgeNode | null> {
  const title = input.title.trim();
  if (title.length === 0) return null;

  const stamp = now.toISOString();
  const node: KnowledgeNode = {
    id: localId('kn', now),
    source: 'local',
    createdAt: stamp,
    updatedAt: stamp,
    touchedAt: stamp,
    title,
    kind: input.kind ?? 'note',
    summary: input.summary?.trim() ?? '',
    body: input.body?.trim() ?? '',
    tags: cleanTags(input.tags),
    origin: input.origin?.trim() ?? 'Captured in the knowledge base',
    personIds: input.personIds ?? [],
    companyId: input.companyId,
    opportunityId: input.opportunityId,
    contentItemId: input.contentItemId,
    meetingId: input.meetingId,
    documentIds: input.documentIds ?? [],
    relatedNodeIds: input.relatedNodeIds ?? [],
    pinned: false,
  };

  await database.transaction('rw', [database.knowledgeNodes, database.events], async () => {
    await database.knowledgeNodes.add(node);
    await database.events.put(
      cognitionEvent(node, 'knowledge', `Knowledge captured: ${node.title}`, node.summary, now),
    );
  });

  return node;
}

export async function setKnowledgePinned(
  id: string,
  pinned: boolean,
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<boolean> {
  const stamp = now.toISOString();
  const updated = await database.knowledgeNodes.update(id, {
    pinned,
    updatedAt: stamp,
    touchedAt: stamp,
  });
  return updated > 0;
}

/** Records that a human read the node and still stands behind it. */
export async function reviewKnowledgeNode(
  id: string,
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<boolean> {
  const stamp = now.toISOString();
  const updated = await database.knowledgeNodes.update(id, {
    reviewedAt: stamp,
    updatedAt: stamp,
    touchedAt: stamp,
  });
  return updated > 0;
}

/** Archived rather than deleted: knowledge that stopped being useful is still history. */
export async function archiveKnowledgeNode(
  id: string,
  archived: boolean,
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<boolean> {
  const stamp = now.toISOString();
  const updated = await database.knowledgeNodes.update(id, {
    archivedAt: archived ? stamp : undefined,
    pinned: archived ? false : undefined,
    updatedAt: stamp,
    touchedAt: stamp,
  });
  return updated > 0;
}

export interface NewMemoryEntry {
  statement: string;
  kind?: MemoryKind;
  scope?: MemoryScope;
  detail?: string;
  origin?: string;
  confidence?: MemoryConfidence;
  tags?: string[];
  personId?: string;
  companyId?: string;
  decisionId?: string;
  knowledgeNodeId?: string;
  pinned?: boolean;
  reviewAt?: string;
}

export async function saveMemoryEntry(
  input: NewMemoryEntry,
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<MemoryEntry | null> {
  const statement = input.statement.trim();
  if (statement.length === 0) return null;

  const stamp = now.toISOString();
  const entry: MemoryEntry = {
    id: localId('mem', now),
    source: 'local',
    createdAt: stamp,
    updatedAt: stamp,
    touchedAt: stamp,
    statement,
    kind: input.kind ?? 'fact',
    scope: input.scope ?? 'operator',
    detail: input.detail?.trim() ?? '',
    origin: input.origin?.trim() ?? 'Saved by the operator',
    confidence: input.confidence ?? 'stated',
    tags: cleanTags(input.tags),
    personId: input.personId,
    companyId: input.companyId,
    decisionId: input.decisionId,
    knowledgeNodeId: input.knowledgeNodeId,
    pinned: input.pinned ?? false,
    reviewAt: input.reviewAt,
    recallCount: 0,
  };

  await database.transaction('rw', [database.memoryEntries, database.events], async () => {
    await database.memoryEntries.add(entry);
    await database.events.put(
      cognitionEvent(entry, 'memory', `Memory saved: ${entry.statement}`, entry.detail, now),
    );
  });

  return entry;
}

export async function setMemoryPinned(
  id: string,
  pinned: boolean,
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<boolean> {
  const stamp = now.toISOString();
  const updated = await database.memoryEntries.update(id, {
    pinned,
    updatedAt: stamp,
    touchedAt: stamp,
  });
  return updated > 0;
}

/** A recall is a read the store remembers, which is what makes a memory decay measurable. */
export async function recallMemoryEntry(
  id: string,
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<boolean> {
  const entry = await database.memoryEntries.get(id);
  if (!entry) return false;

  const stamp = now.toISOString();
  const updated = await database.memoryEntries.update(id, {
    recallCount: entry.recallCount + 1,
    lastRecalledAt: stamp,
    updatedAt: stamp,
    touchedAt: stamp,
  });
  return updated > 0;
}

/**
 * Re-confirms a memory whose review date passed, pushing the next review out.
 * Confirming is a recall too: someone read it and said it is still true.
 */
export async function confirmMemoryEntry(
  id: string,
  reviewInDays = 90,
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<boolean> {
  return database.transaction('rw', [database.memoryEntries, database.events], async () => {
    const entry = await database.memoryEntries.get(id);
    if (!entry) return false;

    const stamp = now.toISOString();
    const next = new Date(now.getTime() + reviewInDays * 86_400_000).toISOString();
    await database.memoryEntries.update(id, {
      reviewAt: next,
      recallCount: entry.recallCount + 1,
      lastRecalledAt: stamp,
      updatedAt: stamp,
      touchedAt: stamp,
    });
    await database.events.put(
      cognitionEvent(
        entry,
        'memory',
        `Memory re-confirmed: ${entry.statement}`,
        `Next review in ${String(reviewInDays)} days.`,
        now,
      ),
    );
    return true;
  });
}

/** Retired, not deleted: a memory that stopped being true is part of the record. */
export async function retireMemoryEntry(
  id: string,
  retired: boolean,
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<boolean> {
  return database.transaction('rw', [database.memoryEntries, database.events], async () => {
    const entry = await database.memoryEntries.get(id);
    if (!entry) return false;
    if ((entry.retiredAt !== undefined) === retired) return false;

    const stamp = now.toISOString();
    await database.memoryEntries.update(id, {
      retiredAt: retired ? stamp : undefined,
      pinned: retired ? false : entry.pinned,
      updatedAt: stamp,
      touchedAt: stamp,
    });
    await database.events.put(
      cognitionEvent(
        entry,
        'memory',
        `${retired ? 'Memory retired' : 'Memory restored'}: ${entry.statement}`,
        retired ? 'It stays in the record, out of the working set.' : 'Back in the working set.',
        now,
      ),
    );
    return true;
  });
}

export interface NewDocument {
  title: string;
  kind?: SovereignDocument['kind'];
  summary?: string;
  body?: string;
  format?: SovereignDocument['format'];
  tags?: string[];
  companyId?: string;
  personId?: string;
  opportunityId?: string;
  projectId?: string;
  meetingId?: string;
  location?: string;
}

export async function createDocument(
  input: NewDocument,
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<SovereignDocument | null> {
  const title = input.title.trim();
  if (title.length === 0) return null;

  const stamp = now.toISOString();
  const document: SovereignDocument = {
    id: localId('doc', now),
    source: 'local',
    createdAt: stamp,
    updatedAt: stamp,
    touchedAt: stamp,
    title,
    kind: input.kind ?? 'memo',
    status: 'draft',
    summary: input.summary?.trim() ?? '',
    body: input.body ?? '',
    format: input.format ?? 'markdown',
    author: OPERATOR,
    tags: cleanTags(input.tags),
    companyId: input.companyId,
    personId: input.personId,
    opportunityId: input.opportunityId,
    projectId: input.projectId,
    meetingId: input.meetingId,
    location: input.location?.trim() ?? '',
  };

  await database.transaction('rw', [database.documents, database.events], async () => {
    await database.documents.add(document);
    await database.events.put(
      cognitionEvent(
        document,
        'document',
        `Document created: ${document.title}`,
        document.summary,
        now,
      ),
    );
  });

  return document;
}

/**
 * Documents move draft → final → archived and back to draft. A body is not
 * edited here; what changes is the claim the surface makes about the document.
 */
const DOCUMENT_TRANSITIONS: Record<SovereignDocument['status'], readonly SovereignDocument['status'][]> = {
  draft: ['final', 'archived'],
  final: ['draft', 'archived'],
  archived: ['draft'],
};

export async function setDocumentStatus(
  id: string,
  status: SovereignDocument['status'],
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<ContentMutationResult> {
  return database.transaction('rw', [database.documents, database.events], async () => {
    const document = await database.documents.get(id);
    if (!document) return { ok: false, reason: 'No document with that id is in the local store.' };
    if (document.status === status) return { ok: false, reason: `Already ${status}.` };
    if (!DOCUMENT_TRANSITIONS[document.status].includes(status)) {
      return { ok: false, reason: `A ${document.status} document cannot move to ${status}.` };
    }

    const stamp = now.toISOString();
    await database.documents.update(id, {
      status,
      reviewedAt: status === 'final' ? stamp : document.reviewedAt,
      updatedAt: stamp,
      touchedAt: stamp,
    });
    await database.events.put(
      cognitionEvent(
        document,
        'document',
        `Document marked ${status}: ${document.title}`,
        `Was ${document.status}.`,
        now,
      ),
    );
    return { ok: true };
  });
}

export interface NewDecision {
  title: string;
  context?: string;
  choice?: string;
  rationale?: string;
  alternatives?: string[];
  consequences?: string;
  impact?: Decision['impact'];
  reversible?: boolean;
  dueAt?: string;
  tags?: string[];
  personIds?: string[];
  companyId?: string;
  opportunityId?: string;
  projectId?: string;
  contentItemId?: string;
  knowledgeNodeId?: string;
}

/**
 * Records a decision. A call with an answer already in it is `decided` on
 * arrival; one without is `proposed`, and the log shows it as still open.
 */
export async function recordDecision(
  input: NewDecision,
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<Decision | null> {
  const title = input.title.trim();
  if (title.length === 0) return null;

  const stamp = now.toISOString();
  const choice = input.choice?.trim() ?? '';
  const decided = choice.length > 0;
  const decision: Decision = {
    id: localId('dec', now),
    source: 'local',
    createdAt: stamp,
    updatedAt: stamp,
    touchedAt: stamp,
    title,
    status: decided ? 'decided' : 'proposed',
    context: input.context?.trim() ?? '',
    choice,
    rationale: input.rationale?.trim() ?? '',
    alternatives: (input.alternatives ?? []).map((line) => line.trim()).filter((line) => line.length > 0),
    consequences: input.consequences?.trim() ?? '',
    impact: input.impact ?? 'info',
    reversible: input.reversible ?? true,
    dueAt: input.dueAt,
    decidedAt: decided ? stamp : undefined,
    decidedBy: decided ? OPERATOR : undefined,
    tags: cleanTags(input.tags),
    personIds: input.personIds ?? [],
    companyId: input.companyId,
    opportunityId: input.opportunityId,
    projectId: input.projectId,
    contentItemId: input.contentItemId,
    knowledgeNodeId: input.knowledgeNodeId,
  };

  await database.transaction('rw', [database.decisions, database.events], async () => {
    await database.decisions.add(decision);
    await database.events.put(
      cognitionEvent(
        decision,
        'decision',
        `${decided ? 'Decision recorded' : 'Decision proposed'}: ${decision.title}`,
        decided ? decision.choice : decision.context,
        now,
      ),
    );
  });

  return decision;
}

/**
 * Makes the call. A decision cannot become `decided` without the answer and the
 * reasoning: a log of choices with no rationale is a list, not institutional
 * memory.
 */
export async function decideDecision(
  id: string,
  input: { choice: string; rationale?: string; consequences?: string },
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<ContentMutationResult> {
  const choice = input.choice.trim();
  if (choice.length === 0) {
    return { ok: false, reason: 'A decision needs the choice that was made.' };
  }

  return database.transaction('rw', [database.decisions, database.events], async () => {
    const decision = await database.decisions.get(id);
    if (!decision) return { ok: false, reason: 'No decision with that id is in the local store.' };
    if (!canTransitionDecision(decision.status, 'decided')) {
      return { ok: false, reason: `A ${decision.status} decision cannot be decided again.` };
    }

    const stamp = now.toISOString();
    await database.decisions.update(id, {
      status: 'decided',
      choice,
      rationale: input.rationale?.trim() ?? decision.rationale,
      consequences: input.consequences?.trim() ?? decision.consequences,
      decidedAt: stamp,
      decidedBy: OPERATOR,
      updatedAt: stamp,
      touchedAt: stamp,
    });
    await database.events.put(
      cognitionEvent(decision, 'decision', `Decision recorded: ${decision.title}`, choice, now),
    );
    return { ok: true };
  });
}

/**
 * The moves that need no new text: withdrawing an open decision, or reopening a
 * decided one because the operator changed their mind. Superseding needs the
 * decision that replaced it, so it has its own writer.
 */
export async function setDecisionStatus(
  id: string,
  status: DecisionStatus,
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<ContentMutationResult> {
  if (status === 'decided') {
    return { ok: false, reason: 'Deciding needs the choice and the rationale. Use decideDecision.' };
  }
  if (status === 'superseded') {
    return {
      ok: false,
      reason: 'Superseding needs the decision that replaced it. Use supersedeDecision.',
    };
  }

  return database.transaction('rw', [database.decisions, database.events], async () => {
    const decision = await database.decisions.get(id);
    if (!decision) return { ok: false, reason: 'No decision with that id is in the local store.' };
    if (decision.status === status) return { ok: false, reason: `Already ${status}.` };
    if (!canTransitionDecision(decision.status, status)) {
      return { ok: false, reason: `A ${decision.status} decision cannot move to ${status}.` };
    }

    const stamp = now.toISOString();
    await database.decisions.update(id, {
      status,
      // A reopened decision is not a decided one: its stamps go with it.
      decidedAt: status === 'proposed' ? undefined : decision.decidedAt,
      decidedBy: status === 'proposed' ? undefined : decision.decidedBy,
      updatedAt: stamp,
      touchedAt: stamp,
    });
    await database.events.put(
      cognitionEvent(
        decision,
        'decision',
        `${status === 'proposed' ? 'Decision reopened' : 'Decision withdrawn'}: ${decision.title}`,
        `Was ${decision.status}.`,
        now,
      ),
    );
    return { ok: true };
  });
}

/** Replaces one decision with another, keeping both and the link between them. */
export async function supersedeDecision(
  id: string,
  supersededById: string,
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<ContentMutationResult> {
  if (id === supersededById) {
    return { ok: false, reason: 'A decision cannot supersede itself.' };
  }

  return database.transaction('rw', [database.decisions, database.events], async () => {
    const decision = await database.decisions.get(id);
    if (!decision) return { ok: false, reason: 'No decision with that id is in the local store.' };
    const replacement = await database.decisions.get(supersededById);
    if (!replacement) return { ok: false, reason: 'The replacing decision is not in the store.' };
    if (!canTransitionDecision(decision.status, 'superseded')) {
      return { ok: false, reason: `A ${decision.status} decision cannot be superseded.` };
    }

    const stamp = now.toISOString();
    await database.decisions.update(id, {
      status: 'superseded',
      supersededById,
      updatedAt: stamp,
      touchedAt: stamp,
    });
    await database.events.put(
      cognitionEvent(
        decision,
        'decision',
        `Decision superseded: ${decision.title}`,
        `Replaced by "${replacement.title}".`,
        now,
      ),
    );
    return { ok: true };
  });
}

export interface NewPrompt {
  title: string;
  intent?: PromptIntent;
  body: string;
  notes?: string;
  tags?: string[];
  providerPreference?: string[];
  requiresApproval?: boolean;
}

/** `{{placeholders}}` are read off the body, so the two can never disagree. */
export function promptVariables(body: string): string[] {
  const found = body.match(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g) ?? [];
  return [...new Set(found.map((token) => token.replace(/[{}\s]/g, '')))];
}

export async function savePrompt(
  input: NewPrompt,
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<Prompt | null> {
  const title = input.title.trim();
  const body = input.body.trim();
  if (title.length === 0 || body.length === 0) return null;

  const stamp = now.toISOString();
  const prompt: Prompt = {
    id: localId('pr', now),
    source: 'local',
    createdAt: stamp,
    updatedAt: stamp,
    touchedAt: stamp,
    title,
    intent: input.intent ?? 'draft',
    body,
    notes: input.notes?.trim() ?? '',
    tags: cleanTags(input.tags),
    variables: promptVariables(body),
    providerPreference: input.providerPreference ?? [],
    requiresApproval: input.requiresApproval ?? true,
    useCount: 0,
  };

  await database.transaction('rw', [database.prompts, database.events], async () => {
    await database.prompts.add(prompt);
    await database.events.put(
      cognitionEvent(prompt, 'prompt', `Prompt saved: ${prompt.title}`, prompt.notes, now),
    );
  });

  return prompt;
}

/** Counts a use. Running the prompt is the kernel's business; this is bookkeeping. */
export async function recordPromptUse(
  id: string,
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<boolean> {
  const prompt = await database.prompts.get(id);
  if (!prompt) return false;

  const stamp = now.toISOString();
  const updated = await database.prompts.update(id, {
    useCount: prompt.useCount + 1,
    lastUsedAt: stamp,
    updatedAt: stamp,
    touchedAt: stamp,
  });
  return updated > 0;
}

export interface NewResearchItem {
  question: string;
  topic?: string;
  priority?: Priority;
  dueAt?: string;
  tags?: string[];
  knowledgeNodeId?: string;
  opportunityId?: string;
  contentIdeaId?: string;
  companyId?: string;
}

export async function captureResearchItem(
  input: NewResearchItem,
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<ResearchItem | null> {
  const question = input.question.trim();
  if (question.length === 0) return null;

  const stamp = now.toISOString();
  const item: ResearchItem = {
    id: localId('res', now),
    source: 'local',
    createdAt: stamp,
    updatedAt: stamp,
    touchedAt: stamp,
    question,
    topic: input.topic?.trim() ?? '',
    status: 'queued',
    priority: input.priority ?? 'normal',
    dueAt: input.dueAt,
    findings: [],
    answer: '',
    tags: cleanTags(input.tags),
    knowledgeNodeId: input.knowledgeNodeId,
    opportunityId: input.opportunityId,
    contentIdeaId: input.contentIdeaId,
    companyId: input.companyId,
  };

  await database.transaction('rw', [database.researchItems, database.events], async () => {
    await database.researchItems.add(item);
    await database.events.put(
      cognitionEvent(item, 'research', `Research queued: ${item.question}`, item.topic, now),
    );
  });

  return item;
}

export async function setResearchStatus(
  id: string,
  status: ResearchStatus,
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<ContentMutationResult> {
  if (status === 'answered') {
    return { ok: false, reason: 'An answered question needs its answer. Use answerResearchItem.' };
  }

  return database.transaction('rw', [database.researchItems, database.events], async () => {
    const item = await database.researchItems.get(id);
    if (!item) return { ok: false, reason: 'No research item with that id is in the local store.' };
    if (item.status === status) return { ok: false, reason: `Already ${status}.` };

    const stamp = now.toISOString();
    await database.researchItems.update(id, {
      status,
      // Reopening an answered question clears the answer's date, not the answer:
      // the text stays visible as the answer that was withdrawn.
      answeredAt: undefined,
      updatedAt: stamp,
      touchedAt: stamp,
    });
    await database.events.put(
      cognitionEvent(
        item,
        'research',
        `Research ${status}: ${item.question}`,
        `Was ${item.status}.`,
        now,
      ),
    );
    return { ok: true };
  });
}

/**
 * Appends a finding somebody wrote down. Nothing here was fetched: this surface
 * has no crawler, and `source` is whatever the operator typed.
 */
export async function recordResearchFinding(
  id: string,
  note: string,
  source = '',
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<ContentMutationResult> {
  const text = note.trim();
  if (text.length === 0) return { ok: false, reason: 'A finding needs something written in it.' };

  return database.transaction('rw', [database.researchItems, database.events], async () => {
    const item = await database.researchItems.get(id);
    if (!item) return { ok: false, reason: 'No research item with that id is in the local store.' };

    const stamp = now.toISOString();
    await database.researchItems.update(id, {
      findings: [...item.findings, { at: stamp, note: text, source: source.trim() }],
      // Recording a finding is what makes a queued question active.
      status: item.status === 'queued' ? 'active' : item.status,
      updatedAt: stamp,
      touchedAt: stamp,
    });
    await database.events.put(
      cognitionEvent(item, 'research', `Finding recorded: ${item.question}`, text, now),
    );
    return { ok: true };
  });
}

export async function answerResearchItem(
  id: string,
  answer: string,
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<ContentMutationResult> {
  const text = answer.trim();
  if (text.length === 0) return { ok: false, reason: 'An answer needs something written in it.' };

  return database.transaction('rw', [database.researchItems, database.events], async () => {
    const item = await database.researchItems.get(id);
    if (!item) return { ok: false, reason: 'No research item with that id is in the local store.' };

    const stamp = now.toISOString();
    await database.researchItems.update(id, {
      status: 'answered',
      answer: text,
      answeredAt: stamp,
      updatedAt: stamp,
      touchedAt: stamp,
    });
    await database.events.put(
      cognitionEvent(item, 'research', `Research answered: ${item.question}`, text, now),
    );
    return { ok: true };
  });
}

export interface NewAgentSession {
  title: string;
  intent?: string;
  promptId?: string;
  providerPreference?: string[];
  requiresApproval?: boolean;
  /** Seeds the thread with the operator's opening turn, unsent. */
  opening?: string;
}

export async function startAgentSession(
  input: NewAgentSession,
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<AgentSession | null> {
  const title = input.title.trim();
  if (title.length === 0) return null;

  const stamp = now.toISOString();
  const session: AgentSession = {
    id: localId('ags', now),
    source: 'local',
    createdAt: stamp,
    updatedAt: stamp,
    touchedAt: stamp,
    title,
    intent: input.intent?.trim() ?? 'workspace',
    promptId: input.promptId,
    providerPreference: input.providerPreference ?? [],
    requiresApproval: input.requiresApproval ?? true,
    lastActivityAt: stamp,
    unansweredCount: 0,
  };

  await database.transaction(
    'rw',
    [database.agentSessions, database.agentMessages, database.prompts, database.events],
    async () => {
      await database.agentSessions.add(session);
      const opening = input.opening?.trim() ?? '';
      if (opening.length > 0) {
        await database.agentMessages.add({
          id: localId('agm', now),
          source: 'local',
          createdAt: stamp,
          updatedAt: stamp,
          touchedAt: stamp,
          sessionId: session.id,
          role: 'user',
          content: opening,
          at: stamp,
          generated: false,
          outcome: 'sent',
        });
      }
      if (input.promptId !== undefined) {
        const prompt = await database.prompts.get(input.promptId);
        if (prompt) {
          await database.prompts.update(input.promptId, {
            useCount: prompt.useCount + 1,
            lastUsedAt: stamp,
            updatedAt: stamp,
            touchedAt: stamp,
          });
        }
      }
      await database.events.put(
        cognitionEvent(session, 'agent', `Agent session opened: ${session.title}`, session.intent, now),
      );
    },
  );

  return session;
}

export interface AgentTurnResult {
  ok: boolean;
  reason?: string;
  result?: AgentResult;
}

/**
 * One turn of the AI Workspace, and the only path by which agent output can
 * reach the store.
 *
 * The operator's message is written first, then the kernel is asked, and
 * whatever it answers is written verbatim — a completion with `generated: true`
 * and the provider that produced it, or the refusal with its reason. There is
 * no branch that writes assistant text the kernel did not return, which is what
 * makes "awaiting credentials" impossible to mistake for a live answer.
 */
export async function runAgentTurn(
  sessionId: string,
  text: string,
  kernel: AgentKernel,
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<AgentTurnResult> {
  const content = text.trim();
  if (content.length === 0) return { ok: false, reason: 'Nothing to send.' };

  const session = await database.agentSessions.get(sessionId);
  if (!session) return { ok: false, reason: 'No session with that id is in the local store.' };

  const history = (await database.agentMessages.where('sessionId').equals(sessionId).toArray())
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .filter((message) => message.outcome !== 'refused')
    .map((message) => ({ role: message.role, content: message.content }));

  const stamp = now.toISOString();
  const request: AgentRequest = {
    intent: session.intent,
    messages: [...history, { role: 'user', content }],
    providerPreference: session.providerPreference,
    policy: { requiresApproval: session.requiresApproval },
  };

  const result = await kernel.run(request);

  const userMessage: AgentMessage = {
    id: localId('agm', now),
    source: 'local',
    createdAt: stamp,
    updatedAt: stamp,
    touchedAt: stamp,
    sessionId,
    role: 'user',
    content,
    at: stamp,
    generated: false,
    outcome: 'sent',
  };

  const replyStamp = new Date(now.getTime() + 1).toISOString();
  const reply: AgentMessage = result.ok
    ? {
        id: localId('agm', new Date(now.getTime() + 1)),
        source: 'local',
        createdAt: replyStamp,
        updatedAt: replyStamp,
        touchedAt: replyStamp,
        sessionId,
        role: 'assistant',
        content: result.text,
        at: replyStamp,
        generated: true,
        provider: result.provider,
        outcome: 'generated',
      }
    : {
        id: localId('agm', new Date(now.getTime() + 1)),
        source: 'local',
        createdAt: replyStamp,
        updatedAt: replyStamp,
        touchedAt: replyStamp,
        sessionId,
        role: 'assistant',
        content: result.message,
        at: replyStamp,
        generated: false,
        provider: result.provider,
        outcome: 'refused',
        reason: result.reason,
      };

  await database.transaction(
    'rw',
    [database.agentSessions, database.agentMessages, database.events],
    async () => {
      await database.agentMessages.bulkAdd([userMessage, reply]);
      await database.agentSessions.update(sessionId, {
        lastActivityAt: replyStamp,
        unansweredCount: session.unansweredCount + (result.ok ? 0 : 1),
        updatedAt: replyStamp,
        touchedAt: replyStamp,
      });
      await database.events.put(
        cognitionEvent(
          session,
          'agent',
          result.ok
            ? `Agent turn completed by ${String(result.provider)}: ${session.title}`
            : `Agent turn refused (${result.reason}): ${session.title}`,
          result.ok ? 'Output requires the human gate before it reaches anyone.' : result.message,
          now,
        ),
      );
    },
  );

  return { ok: result.ok, reason: result.ok ? undefined : result.message, result };
}

/* ── Wave 6: the leverage fabric ─────────────────────────────────────────── */

/**
 * Automation writes are `automation`-channel events, which is the channel the
 * Health log and the Brief already treat as "something acted without being
 * asked twice". A run inherits the provenance of its rule: a run of a demo rule
 * is demo history and clears with the demo, exactly like `activityFor`.
 */
function automationEvent(
  record: { id: string; source: ActivityEvent['source'] },
  prefix: string,
  title: string,
  detail: string,
  now: Date,
): ActivityEvent {
  return activityFor(record, prefix, 'automation', title, detail, now);
}

export interface NewAutomationRule {
  name: string;
  summary?: string;
  trigger: AutomationTrigger;
  action: AutomationAction;
  enabled?: boolean;
  requiresApproval?: boolean;
  impact?: Approval['risk'];
  requiresIntegrationId?: string;
  notes?: string;
}

export async function createAutomationRule(
  input: NewAutomationRule,
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<AutomationRule | null> {
  const name = input.name.trim();
  if (name.length === 0) return null;

  const stamp = now.toISOString();
  const rule: AutomationRule = {
    id: localId('aut', now),
    source: 'local',
    createdAt: stamp,
    updatedAt: stamp,
    touchedAt: stamp,
    name,
    summary: input.summary?.trim() ?? '',
    trigger: input.trigger,
    action: input.action,
    enabled: input.enabled ?? true,
    // WITHIN default: a rule that writes anything passes a human gate until the
    // operator decides otherwise on the rule itself.
    requiresApproval: input.requiresApproval ?? true,
    impact: input.impact ?? 'info',
    requiresIntegrationId: input.requiresIntegrationId,
    notes: input.notes?.trim() ?? '',
    runCount: 0,
  };

  await database.transaction('rw', [database.automations, database.events], async () => {
    await database.automations.add(rule);
    await database.events.put(
      automationEvent(rule, 'automation', `Automation defined: ${rule.name}`, rule.summary, now),
    );
  });

  return rule;
}

export async function setAutomationEnabled(
  id: string,
  enabled: boolean,
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<boolean> {
  return database.transaction('rw', [database.automations, database.events], async () => {
    const rule = await database.automations.get(id);
    if (!rule || rule.enabled === enabled) return false;

    const stamp = now.toISOString();
    await database.automations.update(id, { enabled, updatedAt: stamp, touchedAt: stamp });
    await database.events.put(
      automationEvent(
        rule,
        'automation',
        `Automation ${enabled ? 'enabled' : 'disabled'}: ${rule.name}`,
        enabled ? 'It will evaluate when the operator runs it.' : 'A disabled rule refuses to run.',
        now,
      ),
    );
    return true;
  });
}

/** Archived rather than deleted: a rule that ran is part of the record. */
export async function archiveAutomationRule(
  id: string,
  archived: boolean,
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<boolean> {
  const stamp = now.toISOString();
  const updated = await database.automations.update(id, {
    archivedAt: archived ? stamp : undefined,
    enabled: archived ? false : undefined,
    updatedAt: stamp,
    touchedAt: stamp,
  });
  return updated > 0;
}

/** The slice of the store a trigger may read, loaded once per run. */
async function readAutomationContext(database: SovereignDb): Promise<AutomationContext> {
  const [
    tasks,
    contentItems,
    opportunities,
    approvals,
    decisions,
    memoryEntries,
    researchItems,
    integrations,
  ] = await Promise.all([
    database.tasks.toArray(),
    database.contentItems.toArray(),
    database.opportunities.toArray(),
    database.approvals.toArray(),
    database.decisions.toArray(),
    database.memoryEntries.toArray(),
    database.researchItems.toArray(),
    database.integrations.toArray(),
  ]);

  return {
    tasks,
    contentItems,
    opportunities,
    approvals,
    decisions,
    memoryEntries,
    researchItems,
    integrations,
  };
}

function matchSummary(matches: readonly AutomationMatch[]): string {
  const named = matches.slice(0, 3).map((match) => match.label);
  const rest = matches.length - named.length;
  return rest > 0 ? `${named.join('; ')} and ${String(rest)} more` : named.join('; ');
}

export interface AutomationRunResult {
  ok: boolean;
  outcome?: AutomationOutcome;
  reason?: string;
  run?: AutomationRun;
}

/**
 * Runs one rule against the local store, and the only path by which an
 * automation can write anything.
 *
 * Every branch ends in a recorded run, including the two that do nothing: a rule
 * that cannot run is `refused` with the reason named, and a rule that matched
 * nothing is `no_match`. Neither is a silent skip, because a fabric whose
 * inaction is invisible is a fabric nobody can trust.
 *
 * Runs are operator-invoked. There is no scheduler on this surface and nothing
 * here claims one: `invokedBy` records who asked.
 */
export async function runAutomation(
  id: string,
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<AutomationRunResult> {
  const rule = await database.automations.get(id);
  if (!rule) {
    return { ok: false, reason: 'No automation with that id is in the local store.' };
  }

  const context = await readAutomationContext(database);
  const readiness = automationReadiness(rule, context.integrations);
  const matches = readiness.runnable ? evaluateAutomation(rule, context, now) : [];
  const stamp = now.toISOString();

  const opensGate = readiness.runnable && matches.length > 0 && automationOpensGate(rule);
  const approvalId = opensGate ? localId('apr', now) : undefined;

  const outcome: AutomationOutcome = !readiness.runnable
    ? 'refused'
    : matches.length === 0
      ? 'no_match'
      : opensGate
        ? 'gated'
        : 'applied';

  const writesSignal = outcome === 'applied' && rule.action === 'notify';
  const notificationId = writesSignal ? localId('n', now) : undefined;

  const detail = !readiness.runnable
    ? readiness.statement
    : matches.length === 0
      ? 'Nothing matched. The run is recorded anyway.'
      : opensGate
        ? `${String(matches.length)} matched. Waiting on the gate before anything is written.`
        : writesSignal
          ? `${String(matches.length)} matched. One signal written: ${matchSummary(matches)}.`
          : `${String(matches.length)} matched. Recorded, nothing written.`;

  const run: AutomationRun = {
    id: localId('run', now),
    source: rule.source,
    createdAt: stamp,
    updatedAt: stamp,
    touchedAt: stamp,
    ruleId: rule.id,
    at: stamp,
    outcome,
    reason: readiness.reason,
    matched: matches.length,
    matchedIds: matches.map((match) => match.id),
    detail,
    notificationId,
    approvalId,
    invokedBy: OPERATOR,
  };

  await database.transaction(
    'rw',
    [
      database.automations,
      database.automationRuns,
      database.approvals,
      database.notifications,
      database.events,
    ],
    async () => {
      await database.automationRuns.add(run);

      if (approvalId !== undefined) {
        const gate: Approval = {
          id: approvalId,
          source: rule.source,
          createdAt: stamp,
          updatedAt: stamp,
          touchedAt: stamp,
          title: `Automation: ${rule.name}`,
          requestedBy: `Automation · ${rule.name}`,
          kind: 'automation',
          risk: rule.impact,
          status: 'pending',
          summary:
            automationDeferredAction(rule) === 'notify'
              ? `${String(matches.length)} matched: ${matchSummary(matches)}. Approving writes one inbox signal; nothing is published or sent either way.`
              : `${String(matches.length)} matched: ${matchSummary(matches)}. The gate is the whole action.`,
          automationRunId: run.id,
        };
        await database.approvals.add(gate);
      }

      if (notificationId !== undefined) {
        await database.notifications.add(
          automationNotification(rule, matches, notificationId, stamp),
        );
      }

      await database.automations.update(rule.id, {
        lastRunAt: stamp,
        runCount: rule.runCount + 1,
        updatedAt: stamp,
        touchedAt: stamp,
      });

      await database.events.put(
        automationEvent(
          run,
          'automation-run',
          `Automation ${outcome === 'no_match' ? 'ran with no match' : outcome}: ${rule.name}`,
          detail,
          now,
        ),
      );
    },
  );

  return {
    ok: outcome !== 'refused',
    outcome,
    reason: outcome === 'refused' ? readiness.statement : undefined,
    run,
  };
}

/** One signal per run, naming what matched. Never one signal per matched record. */
function automationNotification(
  rule: AutomationRule,
  matches: readonly AutomationMatch[],
  id: string,
  stamp: string,
): Notification {
  return {
    id,
    source: rule.source,
    createdAt: stamp,
    updatedAt: stamp,
    touchedAt: stamp,
    title: `Automation: ${String(matches.length)} ${
      matches.length === 1 ? 'record matches' : 'records match'
    } "${rule.name}"`,
    body: `${matchSummary(matches)}. Written by a local rule; nothing was sent anywhere.`,
    severity: rule.impact,
    read: false,
    origin: 'Automation',
    href: automationTriggerHref[rule.trigger],
  };
}

/**
 * Runs every enabled rule, in registration order, and reports each result. A
 * refusal does not stop the pass: the operator asked what the whole fabric would
 * do, and a rule that cannot run is part of that answer.
 */
export async function runEnabledAutomations(
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<AutomationRunResult[]> {
  const rules = (await database.automations.toArray()).filter(
    (rule) => rule.enabled && rule.archivedAt === undefined,
  );

  const results: AutomationRunResult[] = [];
  for (const rule of rules) {
    results.push(await runAutomation(rule.id, database, now));
  }
  return results;
}

/**
 * Moves the run behind an automation gate when the gate is decided. Approving
 * carries out the effect the rule deferred — which is only ever one inbox
 * signal — and rejecting records the refusal against the run.
 *
 * Reopening a gate whose signal was already written is refused. The signal
 * exists and was read; pretending the run is waiting again would make the run
 * log describe a state the inbox contradicts.
 */
async function decideAutomationGate(
  approval: Approval,
  status: ApprovalStatus,
  database: SovereignDb,
  now: Date,
): Promise<ApprovalDecisionResult> {
  const run =
    approval.automationRunId === undefined
      ? undefined
      : await database.automationRuns.get(approval.automationRunId);
  if (!run) {
    return { ok: false, reason: 'The automation run behind this gate is not in the local store.' };
  }

  const rule = await database.automations.get(run.ruleId);
  if (!rule) {
    return { ok: false, reason: 'The automation rule behind this gate is not in the local store.' };
  }

  const stamp = now.toISOString();

  if (status === 'pending') {
    if (run.notificationId !== undefined) {
      return {
        ok: false,
        reason: 'This run already wrote its signal. Reopening the gate would not unwrite it.',
      };
    }
    await database.automationRuns.update(run.id, {
      outcome: 'gated',
      reason: undefined,
      updatedAt: stamp,
      touchedAt: stamp,
    });
    await database.events.put(
      automationEvent(run, 'automation-gate', `Automation gate reopened: ${rule.name}`, run.detail, now),
    );
    return { ok: true, automationOutcome: 'gated' };
  }

  if (status === 'rejected') {
    await database.automationRuns.update(run.id, {
      outcome: 'declined',
      reason: 'gate_rejected',
      detail: `${run.detail} The gate was rejected, so nothing was written.`,
      updatedAt: stamp,
      touchedAt: stamp,
    });
    await database.events.put(
      automationEvent(
        run,
        'automation-gate',
        `Automation refused at the gate: ${rule.name}`,
        `${String(run.matched)} matched, nothing written.`,
        now,
      ),
    );
    return { ok: true, automationOutcome: 'declined' };
  }

  const deferred = automationDeferredAction(rule);
  let notificationId: string | undefined;

  if (deferred === 'notify') {
    notificationId = localId('n', now);
    // The gate held the summary; the signal repeats it rather than re-evaluating,
    // so what a human approved is what gets written.
    await database.notifications.add({
      id: notificationId,
      source: rule.source,
      createdAt: stamp,
      updatedAt: stamp,
      touchedAt: stamp,
      title: `Automation: ${String(run.matched)} ${
        run.matched === 1 ? 'record matched' : 'records matched'
      } "${rule.name}"`,
      body: `${approval.summary} Approved at the gate.`,
      severity: rule.impact,
      read: false,
      origin: 'Automation',
      href: automationTriggerHref[rule.trigger],
    });
  }

  await database.automationRuns.update(run.id, {
    outcome: 'applied',
    reason: undefined,
    notificationId,
    detail:
      deferred === 'notify'
        ? `${run.detail} Approved at the gate, and one signal written.`
        : `${run.detail} Cleared at the gate.`,
    updatedAt: stamp,
    touchedAt: stamp,
  });

  await database.events.put(
    automationEvent(
      run,
      'automation-gate',
      `Automation cleared at the gate: ${rule.name}`,
      deferred === 'notify' ? 'One signal written to the inbox.' : 'Nothing further to write.',
      now,
    ),
  );

  return { ok: true, automationOutcome: 'applied' };
}

/* ── Missions ───────────────────────────────────────────────────────────── */

export interface MissionWriteResult {
  ok: boolean;
  reason?: string;
}

export interface NewMission {
  title: string;
  code?: string;
  objective?: string;
  successMeasure?: string;
  dueAt?: string;
}

export async function captureMission(
  input: NewMission,
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<Mission | null> {
  const title = input.title.trim();
  if (title.length === 0) return null;

  const stamp = now.toISOString();
  const existing = await database.missions.count();
  const mission: Mission = {
    id: localId('msn', now),
    source: 'local',
    createdAt: stamp,
    updatedAt: stamp,
    touchedAt: stamp,
    code: input.code?.trim() ?? `MSN-${String(existing + 1).padStart(3, '0')}`,
    title,
    objective: input.objective?.trim() ?? '',
    status: 'active',
    // A new objective has produced nothing yet, and says so.
    progress: 0,
    successMeasure: input.successMeasure?.trim() ?? '',
    dueAt: input.dueAt,
  };

  await database.transaction('rw', [database.missions, database.events], async () => {
    await database.missions.add(mission);
    await database.events.put(
      activityFor(
        mission,
        'mission',
        'execution',
        `Objective opened: ${mission.code} · ${mission.title}`,
        mission.objective,
        now,
      ),
    );
  });

  return mission;
}

/**
 * Moves a mission through `MISSION_TRANSITIONS` only, and refuses a `blocked`
 * move that names no blocker: a blocked objective with no reason is a status
 * nobody can act on.
 */
export async function setMissionStatus(
  id: string,
  status: MissionStatus,
  options: { reason?: string } = {},
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<MissionWriteResult> {
  return database.transaction('rw', [database.missions, database.events], async () => {
    const mission = await database.missions.get(id);
    if (!mission) return { ok: false, reason: 'No objective with that id is in the local store.' };
    if (mission.status === status) return { ok: false, reason: `Already ${status}.` };
    if (!canTransitionMission(mission.status, status)) {
      return {
        ok: false,
        reason: `An objective cannot move from ${mission.status} to ${status}.`,
      };
    }

    const reason = options.reason?.trim() ?? '';
    if (missionNeedsReason(status) && reason.length === 0) {
      return { ok: false, reason: 'A blocked objective needs the blocker written down.' };
    }

    const stamp = now.toISOString();
    await database.missions.update(id, {
      status,
      blockedReason: status === 'blocked' ? reason : undefined,
      updatedAt: stamp,
      touchedAt: stamp,
    });
    await database.events.put(
      activityFor(
        mission,
        'mission',
        'execution',
        `Objective ${status}: ${mission.code} · ${mission.title}`,
        status === 'blocked' ? reason : mission.objective,
        now,
      ),
    );
    return { ok: true };
  });
}

/**
 * Records the progress the operator declares. Mission Control prints it next to
 * the progress it counts from linked tasks and labels both, because a number
 * someone typed and a number the store measured are different claims.
 */
export async function declareMissionProgress(
  id: string,
  percent: number,
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<MissionWriteResult> {
  if (!Number.isFinite(percent)) {
    return { ok: false, reason: 'Progress must be a number between 0 and 100.' };
  }
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));

  return database.transaction('rw', [database.missions, database.events], async () => {
    const mission = await database.missions.get(id);
    if (!mission) return { ok: false, reason: 'No objective with that id is in the local store.' };

    const stamp = now.toISOString();
    await database.missions.update(id, { progress: clamped, updatedAt: stamp, touchedAt: stamp });
    await database.events.put(
      activityFor(
        mission,
        'mission',
        'execution',
        `Objective progress declared at ${String(clamped)}%: ${mission.code}`,
        'Declared by the operator, not counted from linked work.',
        now,
      ),
    );
    return { ok: true };
  });
}

/* ── Wave 7: the only writer that can set an integration Connected ──────── */

export interface IntegrationProbeResult {
  /** True only when the probe reached the endpoint and it reported itself healthy. */
  verified: boolean;
  /** When the probe ran. A result without one is refused. */
  at: string;
  /** What happened, in the words the surface will print. */
  detail: string;
}

export interface ProbeWriteResult {
  ok: boolean;
  reason?: string;
  /** The state the row now carries. Never `connected` without `lastProbedAt`. */
  state?: IntegrationState;
}

/**
 * Records a health probe against a registry row.
 *
 * This is the whole of the connected-probe invariant on the write side
 * (`docs/reviews/WAVE_6_GPT_REVIEW.md` L1). Every other writer in this module
 * leaves `state` alone; this one may move it, and it can only move it while
 * holding the timestamp of the probe that justifies the move. A verified result
 * with no usable `at` is refused outright rather than downgraded, because a
 * probe that cannot say when it ran is not evidence of anything.
 *
 * A failed probe is written too. "We asked at 09:14 and it did not answer" is
 * worth more than silence, and it leaves the row Awaiting Credentials with the
 * date visible on `/integrations` and the Health Monitor.
 */
export async function recordIntegrationProbe(
  integrationId: string,
  result: IntegrationProbeResult,
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<ProbeWriteResult> {
  const at = result.at.trim();
  if (at.length === 0 || Number.isNaN(Date.parse(at))) {
    return {
      ok: false,
      reason:
        'A probe result must carry the time it ran. Connected without a probe timestamp is refused.',
    };
  }

  return database.transaction('rw', [database.integrations, database.events], async () => {
    const integration = await database.integrations.get(integrationId);
    if (!integration) {
      return { ok: false, reason: 'No integration with that id is in the local registry.' };
    }
    if (integration.state === 'disabled') {
      return {
        ok: false,
        reason: `${integration.name} is disabled deliberately. Turn it on in the registry before probing it.`,
      };
    }

    const state: IntegrationState = result.verified ? 'connected' : 'awaiting_credentials';
    const stamp = now.toISOString();
    await database.integrations.update(integrationId, {
      state,
      lastProbedAt: at,
      updatedAt: stamp,
      touchedAt: stamp,
    });
    await database.events.put(
      activityFor(
        integration,
        'probe',
        'system',
        `Health probe ${result.verified ? 'verified' : 'failed'}: ${integration.name}`,
        result.detail,
        now,
      ),
    );
    return { ok: true, state };
  });
}

/** Meeting notes are the operator's account of what happened, so they persist. */
export async function saveMeetingNotes(
  id: string,
  notes: string,
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<boolean> {
  return database.transaction('rw', [database.meetings, database.events], async () => {
    const meeting = await database.meetings.get(id);
    if (!meeting || meeting.notes === notes) return false;

    const stamp = now.toISOString();
    await database.meetings.update(id, { notes, updatedAt: stamp, touchedAt: stamp });
    await database.events.put(
      activityFor(
        meeting,
        'meeting',
        'relationship',
        `Meeting notes recorded: ${meeting.title}`,
        notes.length === 0 ? 'Notes cleared.' : `${String(notes.length)} characters.`,
        now,
      ),
    );
    return true;
  });
}
