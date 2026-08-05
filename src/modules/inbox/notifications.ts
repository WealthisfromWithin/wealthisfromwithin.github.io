import type { SovereignDataset } from '@/data/dataset';
import type { Notification, Severity } from '@/domain';
import { severityRank } from '@/domain';

export const INBOX_STATUS_FILTERS = ['all', 'unread', 'read'] as const;
export type InboxStatusFilter = (typeof INBOX_STATUS_FILTERS)[number];

export const INBOX_SEVERITY_FILTERS = ['all', 'critical', 'warning', 'info'] as const;
export type InboxSeverityFilter = (typeof INBOX_SEVERITY_FILTERS)[number];

export interface InboxQuery {
  status: InboxStatusFilter;
  severity: InboxSeverityFilter;
}

export const defaultInboxQuery: InboxQuery = { status: 'unread', severity: 'all' };

export const inboxStatusLabel: Record<InboxStatusFilter, string> = {
  all: 'All',
  unread: 'Unread',
  read: 'Read',
};

export const inboxSeverityLabel: Record<InboxSeverityFilter, string> = {
  all: 'Any severity',
  critical: 'Critical',
  warning: 'Warning',
  info: 'Info',
};

export function parseInboxQuery(params: URLSearchParams): InboxQuery {
  const status = params.get('status');
  const severity = params.get('severity');
  return {
    status: INBOX_STATUS_FILTERS.find((value) => value === status) ?? defaultInboxQuery.status,
    severity:
      INBOX_SEVERITY_FILTERS.find((value) => value === severity) ?? defaultInboxQuery.severity,
  };
}

export interface InboxCounts {
  total: number;
  unread: number;
  read: number;
  unreadBySeverity: Record<Severity, number>;
}

export function inboxCounts(dataset: SovereignDataset): InboxCounts {
  const counts: InboxCounts = {
    total: dataset.notifications.length,
    unread: 0,
    read: 0,
    unreadBySeverity: { critical: 0, warning: 0, info: 0 },
  };

  for (const notification of dataset.notifications) {
    if (notification.read) {
      counts.read += 1;
    } else {
      counts.unread += 1;
      counts.unreadBySeverity[notification.severity] += 1;
    }
  }

  return counts;
}

export function unreadCount(dataset: SovereignDataset): number {
  return dataset.notifications.filter((notification) => !notification.read).length;
}

function matches(notification: Notification, query: InboxQuery): boolean {
  if (query.status === 'unread' && notification.read) return false;
  if (query.status === 'read' && !notification.read) return false;
  if (query.severity !== 'all' && notification.severity !== query.severity) return false;
  return true;
}

/**
 * Unread first, then by severity, then newest. Attention order, not clock order:
 * a critical unread signal from yesterday outranks an info signal from an hour ago.
 */
export function selectNotifications(
  dataset: SovereignDataset,
  query: InboxQuery = defaultInboxQuery,
): Notification[] {
  return dataset.notifications
    .filter((notification) => matches(notification, query))
    .sort((a, b) => {
      if (a.read !== b.read) return a.read ? 1 : -1;
      const bySeverity = severityRank[a.severity] - severityRank[b.severity];
      if (bySeverity !== 0) return bySeverity;
      return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    });
}
