import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSovereign } from '@/app/context';
import { normalizeInternalHref } from '@/app/href';
import { cn } from '@/lib/cn';
import { DemoBadge, Panel, SectionLabel } from '@/ui/primitives';
import {
  METRIC_BLIND_SPOTS,
  METRIC_WINDOWS,
  kpiGroups,
  metricWindowLabel,
  parseMetricWindow,
  type Kpi,
} from './metrics';

const button = 'label-caps border px-2.5 py-1 transition-colors';

const valueTone: Record<Kpi['tone'], string> = {
  critical: 'text-alert',
  warning: 'text-gold',
  info: 'text-sentinel',
  neutral: 'text-ivory',
  sentinel: 'text-sentinel',
  muted: 'text-faint',
};

function KpiCard({ kpi }: { kpi: Kpi }) {
  const label = (
    <span className="label-caps text-faint">
      {kpi.label}
      {kpi.demo ? <DemoBadge className="ml-2" /> : null}
    </span>
  );

  return (
    <li className="border border-line bg-surface/50 px-3 py-2.5">
      {kpi.href === undefined ? (
        label
      ) : (
        <Link to={normalizeInternalHref(kpi.href, '/')} className="hover:text-ivory">
          {label}
        </Link>
      )}
      <p className={cn('mt-0.5 font-mono text-2xl leading-tight tabular-nums', valueTone[kpi.tone])}>
        {kpi.value}
      </p>
      <p className="mt-1 text-xs leading-5 text-muted">{kpi.basis}</p>
      <p className="mt-1 font-mono text-[0.65rem] text-faint">
        {kpi.sample === 0
          ? 'no rows behind this figure'
          : `${String(kpi.sample)} ${kpi.sample === 1 ? 'row' : 'rows'} behind this figure`}
        {kpi.sample > 0 && kpi.sample < 5 ? ' — too small to read as a trend' : ''}
      </p>
    </li>
  );
}

export function MetricsPage() {
  const { dataset, ready } = useSovereign();
  const [searchParams, setSearchParams] = useSearchParams();
  const now = useMemo(() => new Date(), []);

  const window = parseMetricWindow(searchParams.get('window'));
  const groups = useMemo(() => kpiGroups(dataset, window, now), [dataset, window, now]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <header className="mb-5">
        <SectionLabel>Command</SectionLabel>
        <h1 className="mt-1 font-display text-2xl text-ivory">Business Metrics</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Financial and operating KPIs counted from the local domain. Revenue here means the value
          the operator recorded on a deal that reached won — no accounting system, payment
          processor, or finance API is connected to this surface, and none is simulated. Every
          figure carries the sentence it was derived from.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {METRIC_WINDOWS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setSearchParams(value === '90d' ? {} : { window: value });
            }}
            className={cn(
              button,
              window === value
                ? 'border-gold/60 bg-gold-faint text-ivory'
                : 'border-line text-faint hover:border-gold/40 hover:text-muted',
            )}
          >
            {metricWindowLabel[value]}
          </button>
        ))}
        <p className="ml-auto text-xs text-faint">
          A window filters recorded dates. Nothing here is annualised or extrapolated.
        </p>
      </div>

      {!ready ? (
        <p className="text-sm text-faint italic">Opening the local store…</p>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.id}>
              <div className="mb-2 flex flex-wrap items-baseline gap-x-3 border-b border-line pb-1.5">
                <h2 className="font-display text-lg text-ivory">{group.title}</h2>
                <p className="text-xs text-faint">{group.note}</p>
              </div>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.kpis.map((kpi) => (
                  <KpiCard key={kpi.id} kpi={kpi} />
                ))}
              </ul>
            </section>
          ))}

          <Panel title="What this page is not">
            <ul className="space-y-1.5 text-xs leading-5 text-muted">
              {METRIC_BLIND_SPOTS.map((line) => (
                <li key={line}>{line}</li>
              ))}
              <li>
                For how the surface itself was used — activity, throughput, and provenance — see{' '}
                <Link to="/analytics" className="text-gold hover:text-ivory">
                  Analytics
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
