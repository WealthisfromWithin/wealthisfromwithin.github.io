import { describe, expect, it } from 'vitest';
import { emptyDataset, type SovereignDataset } from '@/data/dataset';
import { buildDemoDataset } from '@/data/seed';
import type { Approval, ApprovalStatus, Severity } from '@/domain';
import {
  approvalCounts,
  isOverdue,
  parseApprovalFilter,
  pendingApprovals,
  selectApprovals,
} from './queue';

const now = new Date('2026-08-05T07:30:00.000Z');
const stamp = now.toISOString();

function approval(
  id: string,
  status: ApprovalStatus,
  risk: Severity = 'warning',
  extra: Partial<Approval> = {},
): Approval {
  return {
    id,
    source: 'demo',
    createdAt: stamp,
    updatedAt: stamp,
    title: id,
    requestedBy: 'Content loop',
    kind: 'content',
    risk,
    status,
    summary: '',
    ...extra,
  };
}

function datasetOf(approvals: Approval[]): SovereignDataset {
  return { ...emptyDataset, approvals };
}

describe('approval queue selectors', () => {
  it('defaults to the pending gates', () => {
    expect(parseApprovalFilter(null)).toBe('pending');
    expect(parseApprovalFilter('nonsense')).toBe('pending');
    expect(parseApprovalFilter('rejected')).toBe('rejected');
  });

  it('counts every status', () => {
    const counts = approvalCounts(
      datasetOf([
        approval('a', 'pending'),
        approval('b', 'approved'),
        approval('c', 'rejected'),
        approval('d', 'pending'),
      ]),
    );
    expect(counts).toEqual({ pending: 2, approved: 1, rejected: 1, total: 4 });
  });

  it('filters to one status and to all', () => {
    const dataset = datasetOf([
      approval('a', 'pending'),
      approval('b', 'approved'),
      approval('c', 'rejected'),
    ]);
    expect(selectApprovals(dataset, 'pending').map((row) => row.id)).toEqual(['a']);
    expect(selectApprovals(dataset, 'approved').map((row) => row.id)).toEqual(['b']);
    expect(selectApprovals(dataset, 'all')).toHaveLength(3);
  });

  it('ranks open gates by risk, then by due date', () => {
    const dataset = datasetOf([
      approval('low-risk-soon', 'pending', 'info', { dueAt: stamp }),
      approval('critical-late', 'pending', 'critical', {
        dueAt: new Date(now.getTime() + 86_400_000).toISOString(),
      }),
      approval('warning-soon', 'pending', 'warning', { dueAt: stamp }),
    ]);

    expect(pendingApprovals(dataset).map((row) => row.id)).toEqual([
      'critical-late',
      'warning-soon',
      'low-risk-soon',
    ]);
  });

  it('puts open gates above decided ones and shows recent decisions first', () => {
    const dataset = datasetOf([
      approval('older', 'approved', 'info', {
        decidedAt: new Date(now.getTime() - 86_400_000).toISOString(),
      }),
      approval('newer', 'rejected', 'info', { decidedAt: stamp }),
      approval('open', 'pending', 'info'),
    ]);

    expect(selectApprovals(dataset, 'all').map((row) => row.id)).toEqual([
      'open',
      'newer',
      'older',
    ]);
  });

  it('only calls an open gate overdue', () => {
    const past = new Date(now.getTime() - 1000).toISOString();
    expect(isOverdue(approval('a', 'pending', 'warning', { dueAt: past }), now)).toBe(true);
    expect(isOverdue(approval('b', 'approved', 'warning', { dueAt: past }), now)).toBe(false);
    expect(isOverdue(approval('c', 'pending'), now)).toBe(false);
  });

  it('reads the seeded queue as a mix of open and decided gates', () => {
    const dataset = buildDemoDataset(now);
    const counts = approvalCounts(dataset);

    expect(counts.pending).toBeGreaterThan(0);
    expect(counts.approved + counts.rejected).toBeGreaterThan(0);
    expect(counts.total).toBe(dataset.approvals.length);
  });
});
