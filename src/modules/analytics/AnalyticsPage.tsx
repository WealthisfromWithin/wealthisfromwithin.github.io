import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSovereign } from '@/app/context';
import { normalizeInternalHref } from '@/app/href';
import { cn } from '@/lib/cn';
import { EmptyLine, Panel, SectionLabel } from '@/ui/primitives';
import {
  ANALYTICS_WINDOWS,
  activityByDay,
  analyticsCaveats,
  analyticsWindowLabel,
  channelMix,
  loopReadings,
  parseAnalyticsWindow,
  provenanceSplit,
  throughputRows,
} from './analytics';

const button = 'label-caps border px-2.5 py-1 transition-colors';
const ACTIVITY_DAYS = 14;

/**
 * The activity chart is bars sized against the busiest day in the range. No axis
 * is drawn, because a scale nobody can read is decoration; the number is on the
 * bar's own title and the busiest day is stated underneath.
 */
function ActivityBars({ days }: { days: { key: string; label: string; count: number }[] }) {
  const peak = days.reduce((max, day) => Math.max(max, day.count), 0);

  return (
    <div>
      <div className="flex h-24 items-end gap-1">
        {days.map((day) => (
          <div
            key={day.key}
            title={`${day.label}: ${String(day.count)} recorded`}
            className="flex h-full flex-1 flex-col justify-end"
          >
            <div
              className={cn('w-full', day.count === 0 ? 'bg-line/60' : 'bg-gold/50')}
              style={{
                height:
                  peak === 0 || day.count === 0
                    ? '1px'
                    : `${String(Math.max(3, (day.count / peak) * 100))}%`,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex items-baseline justify-between font-mono text-[0.65rem] text-faint">
        <span>{days[0]?.label}</span>
        <span>
          {peak === 0 ? 'nothing recorded in this range' : `busiest day ${String(peak)} events`}
        </span>
        <span>{days[days.length - 1]?.label}</span>
      </div>
    </div>
  );
}

export function AnalyticsPage() {
  const { dataset, ready } = useSovereign();
  const [searchParams, setSearchParams] = useSearchParams();
  const now = useMemo(() => new Date(), []);

  const window = parseAnalyticsWindow(searchParams.get('window'));
  const days = useMemo(() => activityByDay(dataset, now, ACTIVITY_DAYS), [dataset, now]);
  const channels = useMemo(() => channelMix(dataset, window, now), [dataset, window, now]);
  const throughput = useMemo(() => throughputRows(dataset, window, now), [dataset, window, now]);
  const loops = useMemo(() => loopReadings(dataset, window, now), [dataset, window, now]);
  const provenance = useMemo(() => provenanceSplit(dataset), [dataset]);
  const caveats = useMemo(() => analyticsCaveats(dataset), [dataset]);
  const windowEvents = channels.reduce((total, channel) => total + channel.count, 0);

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <header className="mb-5">
        <SectionLabel>Product analytics</SectionLabel>
        <h1 className="mt-1 font-display text-2xl text-ivory">Analytics</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          What this surface recorded, counted from the rows in this browser. Nothing observes the
          operator: there is no page-view beacon, no session recording, and no analytics connector,
          so every figure below is an action the store was asked to write.
        </p>

        <dl className="mt-4 flex flex-wrap items-baseline gap-x-8 gap-y-2 border-y border-line py-3">
          <div>
            <dt className="label-caps text-faint">Events in window</dt>
            <dd className="font-mono text-lg text-ivory tabular-nums">{windowEvents}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Rows in the store</dt>
            <dd className="font-mono text-lg text-muted tabular-nums">{provenance.total}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Operator rows</dt>
            <dd className="font-mono text-lg text-sentinel tabular-nums">{provenance.operator}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Demo rows</dt>
            <dd className="font-mono text-lg text-gold tabular-nums">{provenance.demo}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Touched by hand</dt>
            <dd className="font-mono text-lg text-muted tabular-nums">{provenance.touched}</dd>
          </div>
        </dl>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {ANALYTICS_WINDOWS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setSearchParams(value === '30d' ? {} : { window: value });
            }}
            className={cn(
              button,
              window === value
                ? 'border-gold/60 bg-gold-faint text-ivory'
                : 'border-line text-faint hover:border-gold/40 hover:text-muted',
            )}
          >
            {analyticsWindowLabel[value]}
          </button>
        ))}
        <p className="ml-auto text-xs text-faint">
          Windows apply to recorded dates, never to a projection.
        </p>
      </div>

      {!ready ? (
        <p className="text-sm text-faint italic">Opening the local store…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel className="lg:col-span-2" title={`Recorded activity · last ${String(ACTIVITY_DAYS)} days`}>
            <ActivityBars days={days} />
            <p className="mt-2 text-xs leading-5 text-muted">
              One bar per calendar day, counted from activity events. A day with no bar is a day
              nothing was recorded through this surface — which is not the same as a day nothing
              happened.
            </p>
          </Panel>

          <Panel title={`Where the work happened · ${analyticsWindowLabel[window]}`}>
            {channels.length === 0 ? (
              <EmptyLine>No activity was recorded in this window.</EmptyLine>
            ) : (
              <ul>
                {channels.map((channel) => (
                  <li key={channel.channel} className="border-b border-line/50 py-1.5 last:border-b-0">
                    <div className="flex items-baseline gap-3">
                      <span className="text-sm text-muted">{channel.label}</span>
                      <span className="ml-auto font-mono text-xs text-ivory tabular-nums">
                        {channel.count}
                      </span>
                      <span className="w-10 text-right font-mono text-[0.65rem] text-faint tabular-nums">
                        {channel.share}%
                      </span>
                    </div>
                    <div className="mt-1 h-px w-full bg-line">
                      <div
                        className="h-px bg-gold/60"
                        style={{ width: `${String(channel.share)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title={`Loop outcomes · ${analyticsWindowLabel[window]}`}>
            <ul>
              {loops.map((loop) => (
                <li key={loop.id} className="border-b border-line/50 py-2 last:border-b-0">
                  <div className="flex items-baseline gap-3">
                    {loop.href === undefined ? (
                      <span className="text-sm text-muted">{loop.label}</span>
                    ) : (
                      <Link
                        to={normalizeInternalHref(loop.href, '/')}
                        className="text-sm text-muted hover:text-gold"
                      >
                        {loop.label}
                      </Link>
                    )}
                    <span className="ml-auto font-mono text-sm text-ivory tabular-nums">
                      {loop.value}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs leading-5 text-faint">{loop.basis}</p>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel
            className="lg:col-span-2"
            title={`Throughput by surface · ${analyticsWindowLabel[window]}`}
          >
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  <th className="label-caps pb-2 text-faint">Surface</th>
                  <th className="label-caps pb-2 text-right text-faint">Created</th>
                  <th className="label-caps pb-2 text-right text-faint">Touched</th>
                  <th className="label-caps pb-2 text-right text-faint">Rows</th>
                  <th className="label-caps pb-2 text-right text-faint">Operator</th>
                  <th className="label-caps pb-2 text-right text-faint">Demo</th>
                </tr>
              </thead>
              <tbody>
                {throughput.map((row) => (
                  <tr key={row.id} className="border-b border-line/60 last:border-b-0">
                    <td className="py-1.5 pr-4">
                      <Link
                        to={normalizeInternalHref(row.href, '/')}
                        className="text-sm text-muted hover:text-gold"
                      >
                        {row.label}
                      </Link>
                    </td>
                    <td className="py-1.5 text-right font-mono text-xs text-ivory tabular-nums">
                      {row.created}
                    </td>
                    <td className="py-1.5 text-right font-mono text-xs text-sentinel tabular-nums">
                      {row.touched}
                    </td>
                    <td className="py-1.5 text-right font-mono text-xs text-muted tabular-nums">
                      {row.rows}
                    </td>
                    <td className="py-1.5 text-right font-mono text-xs text-muted tabular-nums">
                      {row.operator}
                    </td>
                    <td className="py-1.5 text-right font-mono text-xs text-gold tabular-nums">
                      {row.demo}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs leading-5 text-muted">
              Created counts rows whose creation date falls inside the window. Touched counts rows
              the operator authored or changed, which are also the rows a demo reseed will not
              overwrite.
            </p>
          </Panel>

          <Panel className="lg:col-span-2" title="What these numbers cannot tell you">
            <ul className="space-y-1.5 text-xs leading-5 text-muted">
              {caveats.map((caveat) => (
                <li key={caveat}>{caveat}</li>
              ))}
              <li>
                For financial and business KPIs counted from the same store, see{' '}
                <Link to="/metrics" className="text-gold hover:text-ivory">
                  Business Metrics
                </Link>
                .
              </li>
            </ul>
          </Panel>
        </div>
      )}
    </div>
  );
}
