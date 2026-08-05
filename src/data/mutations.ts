import { db, type SovereignDb } from './db';
import type { ActivityEvent, Approval, ApprovalStatus } from '@/domain';

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
