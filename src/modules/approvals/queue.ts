import type { SovereignDataset } from '@/data/dataset';
import type { Approval, ApprovalStatus, Severity } from '@/domain';
import { severityRank } from '@/domain';

export const APPROVAL_FILTERS = ['pending', 'approved', 'rejected', 'all'] as const;
export type ApprovalFilter = (typeof APPROVAL_FILTERS)[number];

export const approvalFilterLabel: Record<ApprovalFilter, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  all: 'All',
};

export const approvalStatusLabel: Record<ApprovalStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const approvalKindLabel: Record<Approval['kind'], string> = {
  content: 'Content',
  outreach: 'Outreach',
  automation: 'Automation',
  spend: 'Spend',
  access: 'Access',
};

export function parseApprovalFilter(value: string | null): ApprovalFilter {
  return APPROVAL_FILTERS.find((filter) => filter === value) ?? 'pending';
}

export type ApprovalCounts = Record<ApprovalStatus, number> & { total: number };

export function approvalCounts(dataset: SovereignDataset): ApprovalCounts {
  const counts: ApprovalCounts = { pending: 0, approved: 0, rejected: 0, total: 0 };
  for (const approval of dataset.approvals) {
    counts[approval.status] += 1;
    counts.total += 1;
  }
  return counts;
}

export function pendingApprovals(dataset: SovereignDataset): Approval[] {
  return selectApprovals(dataset, 'pending');
}

export function isOverdue(approval: Approval, now: Date): boolean {
  if (approval.status !== 'pending' || approval.dueAt === undefined) return false;
  const due = Date.parse(approval.dueAt);
  return !Number.isNaN(due) && due < now.getTime();
}

function dueRank(approval: Approval): number {
  if (approval.dueAt === undefined) return Number.MAX_SAFE_INTEGER;
  const due = Date.parse(approval.dueAt);
  return Number.isNaN(due) ? Number.MAX_SAFE_INTEGER : due;
}

function decidedRank(approval: Approval): number {
  if (approval.decidedAt === undefined) return 0;
  const decided = Date.parse(approval.decidedAt);
  return Number.isNaN(decided) ? 0 : decided;
}

/**
 * Open gates first — riskiest and soonest due at the top — then decided gates,
 * most recent decision first. The queue is a work surface, not a log.
 */
export function selectApprovals(
  dataset: SovereignDataset,
  filter: ApprovalFilter = 'pending',
): Approval[] {
  return dataset.approvals
    .filter((approval) => filter === 'all' || approval.status === filter)
    .sort((a, b) => {
      if (a.status !== b.status) {
        if (a.status === 'pending') return -1;
        if (b.status === 'pending') return 1;
      }
      if (a.status === 'pending' && b.status === 'pending') {
        const byRisk = severityRank[a.risk] - severityRank[b.risk];
        if (byRisk !== 0) return byRisk;
        const byDue = dueRank(a) - dueRank(b);
        if (byDue !== 0) return byDue;
        return a.title.localeCompare(b.title);
      }
      const byDecided = decidedRank(b) - decidedRank(a);
      if (byDecided !== 0) return byDecided;
      return a.title.localeCompare(b.title);
    });
}

/** Risk drives colour everywhere the queue is rendered. */
export const riskTone: Record<Severity, 'critical' | 'warning' | 'neutral'> = {
  critical: 'critical',
  warning: 'warning',
  info: 'neutral',
};
