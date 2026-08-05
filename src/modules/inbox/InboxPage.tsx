import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSovereign } from '@/app/context';
import { normalizeInternalHref } from '@/app/href';
import { markAllNotificationsRead, setNotificationRead } from '@/data/mutations';
import type { Notification } from '@/domain';
import { relativeTime } from '@/lib/clock';
import { cn } from '@/lib/cn';
import { DemoBadge, SectionLabel } from '@/ui/primitives';
import {
  INBOX_SEVERITY_FILTERS,
  INBOX_STATUS_FILTERS,
  inboxCounts,
  inboxSeverityLabel,
  inboxStatusLabel,
  parseInboxQuery,
  selectNotifications,
  type InboxQuery,
} from './notifications';

const severityAccent: Record<Notification['severity'], string> = {
  critical: 'bg-alert',
  warning: 'bg-gold',
  info: 'bg-surface-highest',
};

const filterButton =
  'label-caps border px-2.5 py-1 transition-colors disabled:opacity-40';

function NotificationRow({ notification, now }: { notification: Notification; now: Date }) {
  return (
    <li className="flex items-start gap-3 border-b border-line/60 py-2 last:border-b-0">
      <span
        className={cn('mt-1.5 h-8 w-px shrink-0', severityAccent[notification.severity])}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <span
            className={cn(
              'min-w-0 flex-1 text-sm',
              notification.read ? 'text-muted' : 'text-ivory',
            )}
          >
            {notification.title}
          </span>
          {notification.read ? null : (
            <span className="label-caps shrink-0 text-gold">New</span>
          )}
          {notification.source === 'demo' ? <DemoBadge /> : null}
        </div>
        {notification.body ? (
          <p className="mt-0.5 text-xs leading-5 text-muted">{notification.body}</p>
        ) : null}
        <p className="mt-0.5 font-mono text-[0.65rem] text-faint">
          {[
            notification.origin,
            notification.severity,
            relativeTime(notification.createdAt, now),
            notification.read && notification.readAt
              ? `read ${relativeTime(notification.readAt, now)}`
              : null,
          ]
            .filter((part): part is string => Boolean(part))
            .join(' · ')}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 pt-0.5">
        {notification.href ? (
          <Link
            to={normalizeInternalHref(notification.href, '/inbox')}
            className="label-caps border border-line px-2 py-0.5 text-faint transition-colors hover:border-gold/40 hover:text-ivory"
          >
            Open
          </Link>
        ) : null}
        <button
          type="button"
          onClick={() => {
            void setNotificationRead(notification.id, !notification.read);
          }}
          className="label-caps border border-line px-2 py-0.5 text-muted transition-colors hover:border-gold/40 hover:text-ivory"
        >
          {notification.read ? 'Mark unread' : 'Mark read'}
        </button>
      </div>
    </li>
  );
}

export function InboxPage() {
  const { dataset, ready } = useSovereign();
  const [searchParams, setSearchParams] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const now = useMemo(() => new Date(), []);

  const query = parseInboxQuery(searchParams);
  const counts = useMemo(() => inboxCounts(dataset), [dataset]);
  const rows = useMemo(() => selectNotifications(dataset, query), [dataset, query]);

  function applyQuery(next: Partial<InboxQuery>) {
    const merged: InboxQuery = { ...query, ...next };
    const params = new URLSearchParams();
    if (merged.status !== 'all') params.set('status', merged.status);
    if (merged.severity !== 'all') params.set('severity', merged.severity);
    setSearchParams(params);
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <header className="mb-5">
        <SectionLabel>Attention</SectionLabel>
        <h1 className="mt-1 font-display text-2xl text-ivory">Inbox</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Every signal the local store holds. Read state is written to IndexedDB and survives a
          reload; nothing here is fetched or pushed from a network.
        </p>

        <dl className="mt-4 flex flex-wrap items-baseline gap-x-8 gap-y-2 border-y border-line py-3">
          <div>
            <dt className="label-caps text-faint">Unread</dt>
            <dd className="font-mono text-lg text-ivory tabular-nums">{counts.unread}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Critical unread</dt>
            <dd className="font-mono text-lg text-alert tabular-nums">
              {counts.unreadBySeverity.critical}
            </dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Total signals</dt>
            <dd className="font-mono text-lg text-ivory tabular-nums">{counts.total}</dd>
          </div>
        </dl>
      </header>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {INBOX_STATUS_FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              applyQuery({ status: value });
            }}
            className={cn(
              filterButton,
              query.status === value
                ? 'border-gold/60 bg-gold-faint text-ivory'
                : 'border-line text-faint hover:border-gold/40 hover:text-muted',
            )}
          >
            {inboxStatusLabel[value]}
          </button>
        ))}

        <span className="mx-1 h-4 w-px bg-line" aria-hidden />

        {INBOX_SEVERITY_FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              applyQuery({ severity: value });
            }}
            className={cn(
              filterButton,
              query.severity === value
                ? 'border-gold/60 bg-gold-faint text-ivory'
                : 'border-line text-faint hover:border-gold/40 hover:text-muted',
            )}
          >
            {inboxSeverityLabel[value]}
          </button>
        ))}

        <button
          type="button"
          disabled={busy || counts.unread === 0}
          onClick={() => {
            setBusy(true);
            void markAllNotificationsRead().finally(() => {
              setBusy(false);
            });
          }}
          className={cn(filterButton, 'ml-auto border-line text-muted hover:border-gold/40 hover:text-ivory')}
        >
          Mark all read
        </button>
      </div>

      {!ready ? (
        <p className="text-sm text-faint italic">Opening the local store…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-faint italic">
          {counts.total === 0
            ? 'The local store holds no signals.'
            : 'No signals match this filter.'}
        </p>
      ) : (
        <ul>
          {rows.map((notification) => (
            <NotificationRow key={notification.id} notification={notification} now={now} />
          ))}
        </ul>
      )}
    </div>
  );
}
