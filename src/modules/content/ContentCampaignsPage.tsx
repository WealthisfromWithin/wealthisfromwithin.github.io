import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSovereign } from '@/app/context';
import { contentHref } from '@/app/href';
import { relativeTime } from '@/lib/clock';
import { DemoBadge, EmptyLine, Panel, SectionLabel, StatePill } from '@/ui/primitives';
import { ContentTabs } from './ContentTabs';
import { campaignRollups, contentStatusLabel, contentStatusTone } from './content';

export function ContentCampaignsPage() {
  const { dataset, ready } = useSovereign();
  const now = useMemo(() => new Date(), []);
  const rollups = useMemo(() => campaignRollups(dataset), [dataset]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <header className="mb-5">
        <SectionLabel>
          <Link to="/content" className="hover:text-ivory">
            Content
          </Link>{' '}
          · Campaigns
        </SectionLabel>
        <h1 className="mt-1 font-display text-2xl text-ivory">Campaigns</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          The arcs content belongs to. Counts are the items and ideas pointing at each campaign, not
          a plan someone typed into the campaign record.
        </p>
      </header>

      <ContentTabs />

      {!ready ? (
        <p className="text-sm text-faint italic">Opening the local store…</p>
      ) : rollups.length === 0 ? (
        <p className="text-sm text-faint italic">The local store holds no campaigns.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {rollups.map((rollup) => (
            <Panel
              key={rollup.campaign.id}
              title={
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-ivory normal-case">{rollup.campaign.name}</span>
                  <StatePill tone={rollup.campaign.status === 'active' ? 'gold' : 'muted'}>
                    {rollup.campaign.status}
                  </StatePill>
                  {rollup.campaign.source === 'demo' ? <DemoBadge /> : null}
                </span>
              }
              action={
                <span className="font-mono text-[0.65rem] text-faint tabular-nums">
                  {rollup.inProduction} in production · {rollup.published} published · {rollup.ideas}{' '}
                  idea(s)
                </span>
              }
            >
              <p className="text-sm leading-6 text-muted">{rollup.campaign.objective}</p>
              {rollup.campaign.goal.length > 0 ? (
                <p className="mt-1 text-xs leading-5 text-faint">{rollup.campaign.goal}</p>
              ) : null}
              <p className="mt-1 font-mono text-[0.65rem] text-faint">
                {rollup.campaign.startAt
                  ? `starts ${relativeTime(rollup.campaign.startAt, now)}`
                  : 'no start date'}
                {rollup.campaign.endAt ? ` · ends ${relativeTime(rollup.campaign.endAt, now)}` : ''}
                {rollup.nextPublishAt
                  ? ` · next publish ${relativeTime(rollup.nextPublishAt, now)}`
                  : ' · nothing dated next'}
              </p>

              <div className="mt-3">
                {rollup.items.length === 0 ? (
                  <EmptyLine>No content points at this campaign yet.</EmptyLine>
                ) : (
                  <ul>
                    {rollup.items.map((item) => (
                      <li
                        key={item.id}
                        className="flex flex-wrap items-baseline gap-2 border-b border-line/60 py-1.5 last:border-b-0"
                      >
                        <Link
                          to={contentHref(item.id)}
                          className="min-w-0 flex-1 truncate text-sm text-ivory hover:text-gold"
                        >
                          {item.title}
                        </Link>
                        <StatePill tone={contentStatusTone(item.status)}>
                          {contentStatusLabel[item.status]}
                        </StatePill>
                        <span className="shrink-0 font-mono text-[0.65rem] text-faint">
                          {item.scheduledFor ? relativeTime(item.scheduledFor, now) : 'no date'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
