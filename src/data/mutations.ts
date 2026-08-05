import { db, type SovereignDb } from './db';
import type {
  ActivityEvent,
  Approval,
  ApprovalStatus,
  PipelineStage,
  Priority,
  Task,
  TaskStatus,
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
 * completion date it no longer has.
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
