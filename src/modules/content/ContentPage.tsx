import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSovereign } from '@/app/context';
import { contentHref } from '@/app/href';
import {
  approveContentItem,
  recordContentPublished,
  submitContentForReview,
  type ContentMutationResult,
} from '@/data/mutations';
import type { ContentItem } from '@/domain';
import { relativeTime } from '@/lib/clock';
import { cn } from '@/lib/cn';
import { DemoBadge, SectionLabel, StatePill } from '@/ui/primitives';
import { ContentTabs } from './ContentTabs';
import {
  CONTENT_FORMAT_FILTERS,
  CONTENT_PIPELINE,
  contentCounts,
  contentFormatFilterLabel,
  contentFormatLabel,
  contentItemLinks,
  contentLoop,
  contentStatusFilterLabel,
  contentStatusLabel,
  contentStatusTone,
  isPastDue,
  parseContentQuery,
  selectContentItems,
  type ContentQuery,
} from './content';

const filterButton = 'label-caps border px-2.5 py-1 transition-colors disabled:opacity-40';
const rowButton = 'label-caps border px-2 py-0.5 transition-colors disabled:opacity-40';

/** The one move the queue offers per row. Everything else lives on the package. */
function rowAction(item: ContentItem): { label: string; run: () => Promise<ContentMutationResult> } | null {
  switch (item.status) {
    case 'drafting':
      return { label: 'Submit for review', run: () => submitContentForReview(item.id) };
    case 'in_review':
      return { label: 'Approve', run: () => approveContentItem(item.id) };
    case 'scheduled':
    case 'approved':
      return { label: 'Record publish', run: () => recordContentPublished(item.id) };
    default:
      return null;
  }
}

function ContentRow({
  item,
  now,
  busy,
  onAct,
}: {
  item: ContentItem;
  now: Date;
  busy: boolean;
  onAct: (item: ContentItem) => void;
}) {
  const { dataset } = useSovereign();
  const links = useMemo(() => contentItemLinks(dataset, item), [dataset, item]);
  const action = rowAction(item);
  const overdue = isPastDue(item, now);

  return (
    <li className="border-b border-line/60 py-2.5 last:border-b-0">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Link to={contentHref(item.id)} className="text-sm text-ivory hover:text-gold">
              {item.title}
            </Link>
            {item.source === 'demo' ? <DemoBadge /> : null}
            <StatePill tone={contentStatusTone(item.status)}>
              {contentStatusLabel[item.status]}
            </StatePill>
            {overdue ? <StatePill tone="critical">Past its date</StatePill> : null}
          </div>

          {item.status === 'blocked' && item.blockedReason ? (
            <p className="mt-0.5 text-xs leading-5 text-gold/80">{item.blockedReason}</p>
          ) : item.body.length > 0 ? (
            <p className="mt-0.5 line-clamp-1 text-xs leading-5 text-muted">{item.body}</p>
          ) : null}

          <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 font-mono text-[0.65rem] text-faint">
            <span>{contentFormatLabel[item.format]}</span>
            {item.channel.length > 0 ? (
              <>
                <span aria-hidden>·</span>
                <span>{item.channel}</span>
              </>
            ) : null}
            {item.scheduledFor ? (
              <>
                <span aria-hidden>·</span>
                <span className={overdue ? 'text-alert' : undefined}>
                  {item.status === 'published' ? 'published' : 'publish'}{' '}
                  {relativeTime(item.scheduledFor, now)}
                </span>
              </>
            ) : (
              <>
                <span aria-hidden>·</span>
                <span>no date</span>
              </>
            )}
            {links.campaign ? (
              <>
                <span aria-hidden>·</span>
                <Link to="/content/campaigns" className="hover:text-ivory">
                  {links.campaign.name}
                </Link>
              </>
            ) : null}
            {links.parent ? (
              <>
                <span aria-hidden>·</span>
                <Link to={contentHref(links.parent.id)} className="hover:text-ivory">
                  cut from {links.parent.title}
                </Link>
              </>
            ) : null}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          {action ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                onAct(item);
              }}
              className={cn(
                rowButton,
                'border-line text-muted hover:border-gold/40 hover:text-ivory',
              )}
            >
              {action.label}
            </button>
          ) : null}
          <Link
            to={contentHref(item.id)}
            className={cn(rowButton, 'border-line text-faint hover:border-gold/40 hover:text-ivory')}
          >
            Open
          </Link>
        </div>
      </div>
    </li>
  );
}

export function ContentPage() {
  const { dataset, ready } = useSovereign();
  const [searchParams, setSearchParams] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const now = useMemo(() => new Date(), []);

  const query = parseContentQuery(searchParams);
  const counts = useMemo(() => contentCounts(dataset, now), [dataset, now]);
  const loop = useMemo(() => contentLoop(dataset, now), [dataset, now]);
  const rows = useMemo(() => selectContentItems(dataset, query), [dataset, query]);

  function applyQuery(next: Partial<ContentQuery>) {
    const merged: ContentQuery = { ...query, ...next };
    const params = new URLSearchParams();
    if (merged.status !== 'active') params.set('status', merged.status);
    if (merged.format !== 'all') params.set('format', merged.format);
    setSearchParams(params);
  }

  function act(item: ContentItem) {
    const action = rowAction(item);
    if (!action) return;
    setBusy(true);
    setMessage(null);
    void action
      .run()
      .then((result) => {
        setMessage(
          result.ok
            ? `${action.label}: ${item.title}. Written to the local store.`
            : (result.reason ?? 'Nothing changed.'),
        );
      })
      .catch((cause: unknown) => {
        setMessage(cause instanceof Error ? cause.message : 'The move failed.');
      })
      .finally(() => {
        setBusy(false);
      });
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <header className="mb-5">
        <SectionLabel>Content</SectionLabel>
        <h1 className="mt-1 font-display text-2xl text-ivory">Content OS</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Idea to draft to gate to publish, in one queue. Approvals open a real gate in the Approval
          Queue; publishing is recorded by hand, because no publishing connector on this surface has
          credentials.
        </p>

        <dl className="mt-4 flex flex-wrap items-baseline gap-x-8 gap-y-2 border-y border-line py-3">
          {loop.map((step) => (
            <div key={step.id}>
              <dt className="label-caps text-faint">
                <Link to={step.href} className="hover:text-muted" title={step.detail}>
                  {step.label}
                </Link>
              </dt>
              <dd className="font-mono text-lg text-ivory tabular-nums">{step.count}</dd>
            </div>
          ))}
          <div>
            <dt className="label-caps text-faint">Past its date</dt>
            <dd className="font-mono text-lg text-alert tabular-nums">{counts.overdue}</dd>
          </div>
        </dl>
      </header>

      <ContentTabs />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            applyQuery({ status: 'active' });
          }}
          className={cn(
            filterButton,
            query.status === 'active'
              ? 'border-gold/60 bg-gold-faint text-ivory'
              : 'border-line text-faint hover:border-gold/40 hover:text-muted',
          )}
        >
          {contentStatusFilterLabel.active} {counts.active}
        </button>
        {[...CONTENT_PIPELINE, 'blocked' as const, 'archived' as const].map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => {
              applyQuery({ status });
            }}
            className={cn(
              filterButton,
              query.status === status
                ? 'border-gold/60 bg-gold-faint text-ivory'
                : 'border-line text-faint hover:border-gold/40 hover:text-muted',
            )}
          >
            {contentStatusLabel[status]} {counts[status]}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            applyQuery({ status: 'all' });
          }}
          className={cn(
            filterButton,
            query.status === 'all'
              ? 'border-gold/60 bg-gold-faint text-ivory'
              : 'border-line text-faint hover:border-gold/40 hover:text-muted',
          )}
        >
          All {counts.total}
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {CONTENT_FORMAT_FILTERS.map((format) => (
          <button
            key={format}
            type="button"
            onClick={() => {
              applyQuery({ format });
            }}
            className={cn(
              filterButton,
              query.format === format
                ? 'border-gold/60 bg-gold-faint text-ivory'
                : 'border-line text-faint hover:border-gold/40 hover:text-muted',
            )}
          >
            {contentFormatFilterLabel[format]}
          </button>
        ))}
      </div>

      {message ? <p className="mb-2 text-xs text-muted">{message}</p> : null}

      {!ready ? (
        <p className="text-sm text-faint italic">Opening the local store…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-faint italic">
          {counts.total === 0
            ? 'The local store holds no content.'
            : 'No content matches this filter.'}
        </p>
      ) : (
        <ul>
          {rows.map((item) => (
            <ContentRow key={item.id} item={item} now={now} busy={busy} onAct={act} />
          ))}
        </ul>
      )}
    </div>
  );
}
