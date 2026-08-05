import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSovereign } from '@/app/context';
import { contentHref } from '@/app/href';
import {
  approveContentItem,
  recordContentPublished,
  scheduleContentItem,
  setContentStatus,
  submitContentForReview,
  type ContentMutationResult,
} from '@/data/mutations';
import {
  CONTENT_TRANSITIONS,
  checkContent,
  contentComplianceInputs,
  type ComplianceResult,
  type ContentItem,
  type ContentStatus,
} from '@/domain';
import { relativeTime } from '@/lib/clock';
import { cn } from '@/lib/cn';
import { DemoBadge, EmptyLine, Panel, SectionLabel, StatePill } from '@/ui/primitives';
import { integrationStateMeta } from '@/integrations/state';
import {
  contentFormatLabel,
  contentItemLinks,
  contentPlatformLabel,
  contentStatusLabel,
  contentStatusTone,
  findContentItem,
  platformIntegrationId,
} from './content';
import { itemPerformance } from './learning';

const actionButton = 'label-caps border px-2.5 py-1 transition-colors disabled:opacity-40';

/** Moves with their own writer, offered separately from the plain status moves. */
const GUARDED: ContentStatus[] = ['in_review', 'approved', 'scheduled', 'published'];

function MissingItem({ id }: { id: string | undefined }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <SectionLabel>Content</SectionLabel>
      <h1 className="mt-1 font-display text-2xl text-ivory">Not in the local store</h1>
      <p className="mt-2 text-sm text-muted">
        No content item with id <span className="font-mono text-faint">{id ?? '—'}</span> exists
        here. It may have been removed with the demo data.
      </p>
      <Link
        to="/content"
        className="label-caps mt-4 inline-block border border-line px-2.5 py-1 text-muted transition-colors hover:border-gold/40 hover:text-ivory"
      >
        Back to the queue
      </Link>
    </div>
  );
}

function ComplianceReport({ result }: { result: ComplianceResult }) {
  return (
    <div>
      <p className={cn('text-sm', result.blocking ? 'text-alert' : 'text-muted')}>
        {result.summary}
      </p>
      {result.findings.length > 0 ? (
        <ul className="mt-2">
          {result.findings.map((finding) => (
            <li key={`${finding.field}:${finding.id}`} className="border-b border-line/60 py-1.5 last:border-b-0">
              <p className="flex flex-wrap items-center gap-2 text-sm text-ivory">
                <span className="font-mono">“{finding.phrase}”</span>
                <StatePill tone={finding.severity === 'critical' ? 'critical' : finding.severity === 'warning' ? 'warning' : 'muted'}>
                  {finding.severity}
                </StatePill>
                <span className="label-caps text-faint">{finding.field}</span>
              </p>
              <p className="mt-0.5 text-xs leading-5 text-muted">{finding.reason}</p>
              <p className="mt-0.5 font-mono text-[0.65rem] text-faint">{finding.excerpt}</p>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-2 text-xs leading-5 text-faint">
        A fixed keyword list, matched in this browser. It does not read regulation and it is not a
        compliance review — a clean result means only that no listed phrase appeared.
      </p>
    </div>
  );
}

function PublishingPanel({ item }: { item: ContentItem }) {
  const { dataset } = useSovereign();
  const integrationId = item.platform ? platformIntegrationId[item.platform] : undefined;
  const integration = dataset.integrations.find((row) => row.id === integrationId);

  return (
    <Panel title="Publishing">
      <p className="text-sm leading-6 text-muted">
        {item.platform === undefined
          ? 'No platform is recorded on this item.'
          : integration === undefined
            ? `${contentPlatformLabel[item.platform]} has no connector in the integration registry, so publishing is manual.`
            : `${integration.name} is ${integrationStateMeta[integration.state].label}. ${
                integration.state === 'connected'
                  ? 'Even so, this surface holds no publishing credential.'
                  : 'Nothing can be sent from here.'
              }`}
      </p>
      <p className="mt-2 text-xs leading-5 text-faint">
        “Record publish” writes that you published it yourself. It does not call LinkedIn, Facebook,
        n8n, or anything else, and no state on this page should be read as a provider confirming a
        post went out.
      </p>
      {item.publishedAt ? (
        <p className="mt-2 font-mono text-[0.65rem] text-faint">
          Publish recorded {relativeTime(item.publishedAt, new Date())}.
        </p>
      ) : null}
    </Panel>
  );
}

export function ContentItemPage() {
  const { id } = useParams();
  const { dataset, ready } = useSovereign();
  const now = useMemo(() => new Date(), []);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [compliance, setCompliance] = useState<ComplianceResult | null>(null);
  const [publishAt, setPublishAt] = useState('');

  const item = findContentItem(dataset, id);
  const links = useMemo(
    () => (item ? contentItemLinks(dataset, item) : null),
    [dataset, item],
  );
  const performance = useMemo(
    () => (item ? itemPerformance(dataset, item) : null),
    [dataset, item],
  );

  if (!ready) {
    return <p className="px-6 py-6 text-sm text-faint italic">Opening the local store…</p>;
  }
  if (!item || !links || !performance) return <MissingItem id={id} />;

  function run(label: string, mutation: () => Promise<ContentMutationResult>) {
    setBusy(true);
    setMessage(null);
    void mutation()
      .then((result) => {
        setCompliance(result.compliance ?? null);
        setMessage(
          result.ok ? `${label}. Written to the local store.` : (result.reason ?? 'Nothing changed.'),
        );
      })
      .catch((cause: unknown) => {
        setMessage(cause instanceof Error ? cause.message : 'The move failed.');
      })
      .finally(() => {
        setBusy(false);
      });
  }

  const plainMoves = CONTENT_TRANSITIONS[item.status].filter(
    (status) => !GUARDED.includes(status),
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <header className="mb-5">
        <SectionLabel>
          <Link to="/content" className="hover:text-ivory">
            Content
          </Link>{' '}
          · Package
        </SectionLabel>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl text-ivory">{item.title}</h1>
          <StatePill tone={contentStatusTone(item.status)}>
            {contentStatusLabel[item.status]}
          </StatePill>
          {item.source === 'demo' ? <DemoBadge /> : null}
        </div>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-2 font-mono text-xs text-faint">
          <span>{contentFormatLabel[item.format]}</span>
          {item.platform ? (
            <>
              <span aria-hidden>·</span>
              <span>{contentPlatformLabel[item.platform]}</span>
            </>
          ) : null}
          {item.scheduledFor ? (
            <>
              <span aria-hidden>·</span>
              <span>
                {item.status === 'published' ? 'published' : 'publish'}{' '}
                {relativeTime(item.scheduledFor, now)}
              </span>
            </>
          ) : (
            <>
              <span aria-hidden>·</span>
              <span>no publish date</span>
            </>
          )}
          {item.durationSeconds !== undefined ? (
            <>
              <span aria-hidden>·</span>
              <span>{item.durationSeconds}s</span>
            </>
          ) : null}
          {links.campaign ? (
            <>
              <span aria-hidden>·</span>
              <Link to="/content/campaigns" className="hover:text-ivory">
                {links.campaign.name}
              </Link>
            </>
          ) : null}
        </p>

        {item.status === 'blocked' && item.blockedReason ? (
          <p className="mt-3 border-y border-line py-3 font-mono text-xs text-gold">
            {item.blockedReason}
          </p>
        ) : null}
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2 border-y border-line py-3">
        {item.status === 'drafting' ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              run('Submitted for review', () => submitContentForReview(item.id));
            }}
            className={cn(actionButton, 'border-gold/50 text-gold hover:border-gold hover:text-ivory')}
          >
            Submit for review
          </button>
        ) : null}

        {item.status === 'in_review' ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                run('Approved', () => approveContentItem(item.id));
              }}
              className={cn(
                actionButton,
                'border-gold/50 text-gold hover:border-gold hover:text-ivory',
              )}
            >
              Run check and approve
            </button>
            {compliance?.blocking ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  run('Approved by override', () => approveContentItem(item.id, { override: true }));
                }}
                className={cn(
                  actionButton,
                  'border-alert/50 text-alert hover:border-alert hover:text-ivory',
                )}
              >
                Approve anyway (recorded)
              </button>
            ) : null}
          </>
        ) : null}

        {item.status === 'approved' || item.status === 'scheduled' ? (
          <>
            <label className="label-caps text-faint" htmlFor="publish-at">
              Publish date
            </label>
            <input
              id="publish-at"
              type="datetime-local"
              value={publishAt}
              onChange={(event) => {
                setPublishAt(event.target.value);
              }}
              className="border border-line bg-transparent px-2 py-1 font-mono text-xs text-ivory outline-none"
            />
            <button
              type="button"
              disabled={busy || publishAt.length === 0}
              onClick={() => {
                run('Scheduled', () => scheduleContentItem(item.id, publishAt));
              }}
              className={cn(
                actionButton,
                'border-line text-muted hover:border-gold/40 hover:text-ivory',
              )}
            >
              {item.status === 'scheduled' ? 'Reschedule' : 'Schedule'}
            </button>
            <button
              type="button"
              disabled
              title="No publishing connector on this surface has credentials."
              className={cn(actionButton, 'cursor-not-allowed border-line text-faint')}
            >
              Publish now — awaiting credentials
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                run('Publish recorded', () => recordContentPublished(item.id));
              }}
              className={cn(
                actionButton,
                'border-gold/50 text-gold hover:border-gold hover:text-ivory',
              )}
            >
              Record publish
            </button>
          </>
        ) : null}

        {plainMoves.map((status) => (
          <button
            key={status}
            type="button"
            disabled={busy}
            onClick={() => {
              run(`Moved to ${contentStatusLabel[status].toLowerCase()}`, () =>
                setContentStatus(item.id, status),
              );
            }}
            className={cn(
              actionButton,
              'border-line text-faint hover:border-gold/40 hover:text-muted',
            )}
          >
            {contentStatusLabel[status]}
          </button>
        ))}

        <button
          type="button"
          onClick={() => {
            setCompliance(checkContent(contentComplianceInputs(item)));
            setMessage(null);
          }}
          className={cn(
            actionButton,
            'ml-auto border-line text-faint hover:border-gold/40 hover:text-muted',
          )}
        >
          Run compliance check
        </button>
      </div>

      {message ? <p className="mb-3 text-xs text-muted">{message}</p> : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Copy">
          {item.body.length > 0 ? (
            <p className="text-sm leading-6 text-muted">{item.body}</p>
          ) : (
            <EmptyLine>Nothing written yet.</EmptyLine>
          )}
          {item.videoScript.length > 0 ? (
            <>
              <p className="label-caps mt-3 text-faint">Video script</p>
              <p className="mt-1 text-sm leading-6 text-muted">{item.videoScript}</p>
            </>
          ) : null}
        </Panel>

        <Panel title="Platform variants">
          {item.variants.length === 0 ? (
            <EmptyLine>No per-platform copy recorded.</EmptyLine>
          ) : (
            <ul>
              {item.variants.map((variant) => (
                <li key={variant.platform} className="border-b border-line/60 py-1.5 last:border-b-0">
                  <p className="flex items-center gap-2">
                    <span className="label-caps text-faint">
                      {contentPlatformLabel[variant.platform]}
                    </span>
                    {variant.publishedAt ? (
                      <span className="font-mono text-[0.65rem] text-faint">
                        publish recorded {relativeTime(variant.publishedAt, now)}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-sm leading-6 text-muted">{variant.body}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Compliance">
          {compliance ? (
            <ComplianceReport result={compliance} />
          ) : item.complianceCheckedAt ? (
            <div>
              <p className="text-sm text-muted">{item.complianceSummary}</p>
              <p className="mt-1 font-mono text-[0.65rem] text-faint">
                Checked {relativeTime(item.complianceCheckedAt, now)}.
              </p>
            </div>
          ) : (
            <EmptyLine>No check has been run against this copy.</EmptyLine>
          )}
        </Panel>

        <PublishingPanel item={item} />

        <Panel title="Gate">
          {links.approval ? (
            <div>
              <Link to="/approvals?status=all" className="text-sm text-ivory hover:text-gold">
                {links.approval.title}
              </Link>
              <p className="mt-0.5 font-mono text-[0.65rem] text-faint">
                {links.approval.status} · {links.approval.risk} risk · requested by{' '}
                {links.approval.requestedBy}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted">{links.approval.summary}</p>
            </div>
          ) : (
            <EmptyLine>No approval gate is attached to this item.</EmptyLine>
          )}
        </Panel>

        <Panel title="Performance">
          {performance.readings === 0 ? (
            <EmptyLine>No readings recorded against this item.</EmptyLine>
          ) : (
            <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
              <div>
                <dt className="label-caps text-faint">Impressions</dt>
                <dd className="font-mono text-lg text-ivory tabular-nums">
                  {performance.impressions.toLocaleString('en-US')}
                </dd>
              </div>
              <div>
                <dt className="label-caps text-faint">Engagements</dt>
                <dd className="font-mono text-lg text-ivory tabular-nums">
                  {performance.engagements.toLocaleString('en-US')}
                </dd>
              </div>
              <div>
                <dt className="label-caps text-faint">Rate</dt>
                <dd className="font-mono text-lg text-gold tabular-nums">
                  {performance.engagementRate === null
                    ? '—'
                    : `${(performance.engagementRate * 100).toFixed(1)}%`}
                </dd>
              </div>
              <div>
                <dt className="label-caps text-faint">Conversions</dt>
                <dd className="font-mono text-lg text-ivory tabular-nums">
                  {performance.conversions}
                </dd>
              </div>
              <div>
                <dt className="label-caps text-faint">Readings</dt>
                <dd className="font-mono text-lg text-muted tabular-nums">
                  {performance.readings}
                </dd>
              </div>
            </dl>
          )}
        </Panel>

        <Panel title="Built from">
          <ul>
            {[
              { label: 'Hook', value: links.hook?.text, meta: links.hook?.style },
              { label: 'CTA', value: links.cta?.text, meta: links.cta?.intent.replace('_', ' ') },
              {
                label: 'Template',
                value: links.template?.title,
                meta: links.template?.structure,
              },
              { label: 'Idea', value: links.idea?.title, meta: links.idea?.origin },
            ].map((row) => (
              <li
                key={row.label}
                className="flex items-baseline gap-3 border-b border-line/60 py-1.5 last:border-b-0"
              >
                <span className="label-caps w-20 shrink-0 text-faint">{row.label}</span>
                <span className="min-w-0 flex-1 text-sm text-muted">
                  {row.value ?? <span className="text-faint italic">none recorded</span>}
                </span>
                {row.meta ? (
                  <span className="shrink-0 truncate font-mono text-[0.65rem] text-faint">
                    {row.meta}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          {links.assets.length > 0 ? (
            <p className="mt-2 font-mono text-[0.65rem] text-faint">
              Assets: {links.assets.map((asset) => asset.title).join(' · ')}
            </p>
          ) : null}
        </Panel>

        <Panel title="Repurposing">
          {links.parent ? (
            <p className="text-sm text-muted">
              Cut from{' '}
              <Link to={contentHref(links.parent.id)} className="text-ivory hover:text-gold">
                {links.parent.title}
              </Link>
              .
            </p>
          ) : null}
          {links.children.length === 0 ? (
            <EmptyLine>
              {links.parent ? 'Nothing was cut from this one.' : 'No variants cut from this yet.'}
            </EmptyLine>
          ) : (
            <ul>
              {links.children.map((child) => (
                <li
                  key={child.id}
                  className="flex items-baseline gap-3 border-b border-line/60 py-1.5 last:border-b-0"
                >
                  <Link
                    to={contentHref(child.id)}
                    className="min-w-0 flex-1 truncate text-sm text-ivory hover:text-gold"
                  >
                    {child.title}
                  </Link>
                  <span className="label-caps shrink-0 text-faint">
                    {contentFormatLabel[child.format]}
                  </span>
                  <StatePill tone={contentStatusTone(child.status)}>
                    {contentStatusLabel[child.status]}
                  </StatePill>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
