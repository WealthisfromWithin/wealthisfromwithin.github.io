import { describe, expect, it } from 'vitest';
import { emptyDataset, type SovereignDataset } from '@/data/dataset';
import { buildDemoDataset } from '@/data/seed';
import type { Notification, Severity } from '@/domain';
import {
  defaultInboxQuery,
  inboxCounts,
  parseInboxQuery,
  selectNotifications,
  unreadCount,
} from './notifications';

const now = new Date('2026-08-05T07:30:00.000Z');

function notification(
  id: string,
  severity: Severity,
  read: boolean,
  minutesAgo = 0,
): Notification {
  const stamp = new Date(now.getTime() - minutesAgo * 60_000).toISOString();
  return {
    id,
    source: 'demo',
    createdAt: stamp,
    updatedAt: stamp,
    title: id,
    body: '',
    severity,
    read,
    origin: 'Test',
  };
}

function datasetOf(notifications: Notification[]): SovereignDataset {
  return { ...emptyDataset, notifications };
}

describe('inbox selectors', () => {
  it('defaults to unread across every severity', () => {
    expect(defaultInboxQuery).toEqual({ status: 'unread', severity: 'all' });
    expect(parseInboxQuery(new URLSearchParams())).toEqual(defaultInboxQuery);
    expect(parseInboxQuery(new URLSearchParams('status=read&severity=critical'))).toEqual({
      status: 'read',
      severity: 'critical',
    });
    expect(parseInboxQuery(new URLSearchParams('status=nonsense'))).toEqual(defaultInboxQuery);
  });

  it('counts unread by severity', () => {
    const counts = inboxCounts(
      datasetOf([
        notification('a', 'critical', false),
        notification('b', 'warning', false),
        notification('c', 'info', true),
      ]),
    );

    expect(counts.total).toBe(3);
    expect(counts.unread).toBe(2);
    expect(counts.read).toBe(1);
    expect(counts.unreadBySeverity).toEqual({ critical: 1, warning: 1, info: 0 });
  });

  it('filters by read state and by severity', () => {
    const dataset = datasetOf([
      notification('unread-critical', 'critical', false),
      notification('unread-info', 'info', false),
      notification('read-warning', 'warning', true),
    ]);

    expect(
      selectNotifications(dataset, { status: 'unread', severity: 'all' }).map((row) => row.id),
    ).toEqual(['unread-critical', 'unread-info']);
    expect(
      selectNotifications(dataset, { status: 'read', severity: 'all' }).map((row) => row.id),
    ).toEqual(['read-warning']);
    expect(
      selectNotifications(dataset, { status: 'all', severity: 'critical' }).map((row) => row.id),
    ).toEqual(['unread-critical']);
    expect(selectNotifications(dataset, { status: 'all', severity: 'all' })).toHaveLength(3);
  });

  it('orders by attention, not by clock', () => {
    const dataset = datasetOf([
      notification('recent-info', 'info', false, 1),
      notification('old-critical', 'critical', false, 600),
      notification('recent-read-critical', 'critical', true, 0),
    ]);

    expect(
      selectNotifications(dataset, { status: 'all', severity: 'all' }).map((row) => row.id),
    ).toEqual(['old-critical', 'recent-info', 'recent-read-critical']);
  });

  it('reads the seeded inbox as unread-heavy but not empty of history', () => {
    const dataset = buildDemoDataset(now);
    const counts = inboxCounts(dataset);

    expect(unreadCount(dataset)).toBe(counts.unread);
    expect(counts.unread).toBeGreaterThan(0);
    expect(counts.read).toBeGreaterThan(0);
  });
});
