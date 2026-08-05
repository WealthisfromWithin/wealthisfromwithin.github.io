import { db, type SovereignDb } from './db';
import {
  canTransitionContent,
  checkContent,
  contentComplianceInputs,
  type ActivityEvent,
  type Approval,
  type ApprovalStatus,
  type ComplianceResult,
  type ContentIdea,
  type ContentItem,
  type ContentStatus,
  type Notification,
  type PipelineStage,
  type Priority,
  type Task,
  type TaskStatus,
} from '@/domain';

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
 * Moves a gate between open, cleared, and refused, and records the decision as
 * an activity event so the Brief and the Health log show it happened.
 */
export async function decideApproval(
  id: string,
  status: ApprovalStatus,
  database: SovereignDb = db,
  now: Date = new Date(),
): Promise<boolean> {
  return database.transaction('rw', [database.approvals, database.events], async () => {
    const approval = await database.approvals.get(id);
    if (!approval || approval.status === status) return false;

    const stamp = now.toISOString();
    await database.approvals.update(id, {
      status,
      updatedAt: stamp,
      touchedAt: stamp,
      decidedAt: status === 'pending' ? undefined : stamp,
      decidedBy: status === 'pending' ? undefined : OPERATOR,
    });
    await database.events.put(decisionEvent(approval, status, now));
    return true;
  });
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
 * three that need more than a status — approve, schedule, publish — have their
 * own writers and are refused here.
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
