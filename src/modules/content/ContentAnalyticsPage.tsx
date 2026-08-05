import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSovereign } from '@/app/context';
import { contentHref } from '@/app/href';
import { relativeTime } from '@/lib/clock';
import { EmptyLine, Panel, SectionLabel } from '@/ui/primitives';
import { ContentTabs } from './ContentTabs';
import { contentFormatLabel } from './content';
import {
  contentLearningInsights,
  contentPerformance,
  monthlyOptimisation,
  performanceByFormat,
  performanceByHook,
  performanceByPlatform,
  type PerformanceGroup,
} from './learning';

function rate(value: number | null): string {
  return value === null ? '—' : `${(value * 100).toFixed(1)}%`;
}

function count(value: number): string {
  return value.toLocaleString('en-US');
}

function GroupLines({ groups, empty }: { groups: PerformanceGroup[]; empty: string }) {
  if (groups.length === 0) return <EmptyLine>{empty}</EmptyLine>;

  return (
    <ul>
      {groups.map((group) => (
        <li
          key={group.key}
          className="flex items-baseline gap-3 border-b border-line/60 py-1.5 last:border-b-0"
        >
          <span className="min-w-0 flex-1 truncate text-sm text-ivory">{group.label}</span>
          <span className="shrink-0 font-mono text-[0.65rem] text-faint tabular-nums">
            {group.items} item(s) · {count(group.impressions)} impressions
          </span>
          <span className="shrink-0 font-mono text-sm text-gold tabular-nums">
            {rate(group.engagementRate)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ContentAnalyticsPage() {
  const { dataset, ready } = useSovereign();
  const now = useMemo(() => new Date(), []);

  const rows = useMemo(() => contentPerformance(dataset), [dataset]);
  const measured = useMemo(() => rows.filter((row) => row.readings > 0), [rows]);
  const insights = useMemo(() => contentLearningInsights(dataset), [dataset]);
  const optimisation = useMemo(() => monthlyOptimisation(dataset, now), [dataset, now]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <header className="mb-5">
        <SectionLabel>
          <Link to="/content" className="hover:text-ivory">
            Content
          </Link>{' '}
          · Performance
        </SectionLabel>
        <h1 className="mt-1 font-display text-2xl text-ivory">Performance</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Every number here is a sum over readings recorded against a published item. No analytics
          API is connected, so a piece with no reading shows no performance rather than a zero that
          looks like a result.
        </p>

        <dl className="mt-4 flex flex-wrap items-baseline gap-x-8 gap-y-2 border-y border-line py-3">
          <div>
            <dt className="label-caps text-faint">Published</dt>
            <dd className="font-mono text-lg text-ivory tabular-nums">{rows.length}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">With readings</dt>
            <dd className="font-mono text-lg text-ivory tabular-nums">{measured.length}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Readings recorded</dt>
            <dd className="font-mono text-lg text-muted tabular-nums">
              {dataset.contentMetrics.length}
            </dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Conversions recorded</dt>
            <dd className="font-mono text-lg text-gold tabular-nums">
              {measured.reduce((total, row) => total + row.conversions, 0)}
            </dd>
          </div>
        </dl>
      </header>

      <ContentTabs />

      {!ready ? (
        <p className="text-sm text-faint italic">Opening the local store…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          <Panel title="Performance learning">
            {insights.length === 0 ? (
              <EmptyLine>
                Nothing to learn yet: an insight needs two groups that both carry readings.
              </EmptyLine>
            ) : (
              <ul>
                {insights.map((insight) => (
                  <li key={insight.id} className="border-b border-line/60 py-2 last:border-b-0">
                    <p className="text-sm text-ivory">{insight.headline}</p>
                    <p className="mt-0.5 text-xs leading-5 text-muted">{insight.detail}</p>
                    <p className="mt-0.5 font-mono text-[0.65rem] text-faint">{insight.evidence}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Monthly optimisation">
            <dl className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
              <div>
                <dt className="label-caps text-faint">{optimisation.current.label}</dt>
                <dd className="font-mono text-lg text-ivory tabular-nums">
                  {count(optimisation.current.impressions)} impressions ·{' '}
                  {rate(optimisation.current.engagementRate)}
                </dd>
              </div>
              <div>
                <dt className="label-caps text-faint">{optimisation.previous.label}</dt>
                <dd className="font-mono text-lg text-muted tabular-nums">
                  {count(optimisation.previous.impressions)} impressions ·{' '}
                  {rate(optimisation.previous.engagementRate)}
                </dd>
              </div>
              <div>
                <dt className="label-caps text-faint">Engagement change</dt>
                <dd className="font-mono text-lg text-gold tabular-nums">
                  {optimisation.engagementRateDelta === null
                    ? '—'
                    : `${optimisation.engagementRateDelta > 0 ? '+' : ''}${optimisation.engagementRateDelta.toFixed(1)}pp`}
                </dd>
              </div>
            </dl>
            <p className="mt-2 text-xs leading-5 text-faint">
              Readings captured in each window, not items published in it. A window with no reading
              compares to nothing and says so.
            </p>
          </Panel>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Panel title="By platform">
              <GroupLines
                groups={performanceByPlatform(measured)}
                empty="No platform has a reading."
              />
            </Panel>
            <Panel title="By format">
              <GroupLines groups={performanceByFormat(measured)} empty="No format has a reading." />
            </Panel>
            <Panel title="By hook style">
              <GroupLines
                groups={performanceByHook(dataset, measured)}
                empty="No hook style has a reading."
              />
            </Panel>
          </div>

          <Panel title="Published content">
            {rows.length === 0 ? (
              <EmptyLine>Nothing has been published.</EmptyLine>
            ) : (
              <ul>
                {rows.map((row) => (
                  <li
                    key={row.item.id}
                    className="flex flex-wrap items-baseline gap-3 border-b border-line/60 py-1.5 last:border-b-0"
                  >
                    <Link
                      to={contentHref(row.item.id)}
                      className="min-w-0 flex-1 truncate text-sm text-ivory hover:text-gold"
                    >
                      {row.item.title}
                    </Link>
                    <span className="label-caps shrink-0 text-faint">
                      {contentFormatLabel[row.item.format]}
                    </span>
                    <span className="shrink-0 font-mono text-[0.65rem] text-faint tabular-nums">
                      {row.readings === 0
                        ? 'no readings'
                        : `${count(row.impressions)} impressions · ${count(row.engagements)} engagements · ${String(row.readings)} reading(s)`}
                    </span>
                    <span className="shrink-0 font-mono text-sm text-gold tabular-nums">
                      {rate(row.engagementRate)}
                    </span>
                    <span className="shrink-0 font-mono text-[0.65rem] text-faint">
                      {row.lastCapturedAt ? relativeTime(row.lastCapturedAt, now) : '—'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
