import type { SovereignDataset } from '@/data/dataset';
import { formatCurrencyCents, formatDelta, formatMetricValue } from '@/lib/format';
import { DAY_MS, startOfDay } from '@/lib/clock';
import { expectedValueCents, isOpenStage, isStalled } from '@/modules/pipeline/pipeline';

/**
 * Business and financial KPIs, counted from the local domain.
 *
 * No finance API is connected to this surface, and none is faked. "Revenue" here
 * means the value the operator recorded on an opportunity that reached `won` —
 * not an invoice, not a payment, and not a figure any accounting system
 * confirmed. Every KPI therefore carries the sentence it was derived from, and
 * the page states what it cannot know: cost, margin, cash, and tax are absent
 * because nothing in this store records them.
 */

/* ── Window ─────────────────────────────────────────────────────────────── */

export const METRIC_WINDOWS = ['30d', '90d', '365d', 'all'] as const;
export type MetricWindow = (typeof METRIC_WINDOWS)[number];

export const metricWindowLabel: Record<MetricWindow, string> = {
  '30d': '30 days',
  '90d': '90 days',
  '365d': '12 months',
  all: 'All recorded',
};

export function parseMetricWindow(value: string | null): MetricWindow {
  return METRIC_WINDOWS.find((option) => option === value) ?? '90d';
}

function windowDays(window: MetricWindow): number | null {
  switch (window) {
    case '30d':
      return 30;
    case '90d':
      return 90;
    case '365d':
      return 365;
    case 'all':
      return null;
  }
}

export function metricWindowStart(window: MetricWindow, now: Date): Date | null {
  const days = windowDays(window);
  return days === null ? null : new Date(startOfDay(now).getTime() - (days - 1) * DAY_MS);
}

function inWindow(value: string | undefined, start: Date | null, now: Date): boolean {
  if (value === undefined) return false;
  const at = Date.parse(value);
  if (Number.isNaN(at)) return false;
  if (at > now.getTime()) return false;
  return start === null || at >= start.getTime();
}

/* ── KPI shape ──────────────────────────────────────────────────────────── */

export type KpiTone = 'critical' | 'warning' | 'info' | 'neutral' | 'sentinel' | 'muted';

export interface Kpi {
  id: string;
  label: string;
  /** Already formatted for display, because the unit is part of the reading. */
  value: string;
  /** How the number was counted, in one sentence. Never omitted. */
  basis: string;
  /** How many rows it was counted from, so a reading of one says so. */
  sample: number;
  tone: KpiTone;
  href?: string;
  /** True when demo rows contributed to the figure. */
  demo: boolean;
}

export interface KpiGroup {
  id: string;
  title: string;
  note: string;
  kpis: Kpi[];
}

function percent(part: number, whole: number): string {
  if (whole === 0) return '—';
  return `${String(Math.round((part / whole) * 100))}%`;
}

function anyDemo(rows: readonly { source: string }[]): boolean {
  return rows.some((row) => row.source === 'demo');
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? null;
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/* ── Groups ─────────────────────────────────────────────────────────────── */

function revenueGroup(dataset: SovereignDataset, window: MetricWindow, now: Date): KpiGroup {
  const start = metricWindowStart(window, now);
  const open = dataset.opportunities.filter((row) => isOpenStage(row.stage));
  const closedInWindow = dataset.opportunities.filter(
    (row) => !isOpenStage(row.stage) && inWindow(row.stageChangedAt ?? row.updatedAt, start, now),
  );
  const wonInWindow = closedInWindow.filter((row) => row.stage === 'won');
  const lostInWindow = closedInWindow.filter((row) => row.stage === 'lost');
  const wonValue = wonInWindow.reduce((total, row) => total + row.valueCents, 0);

  return {
    id: 'revenue',
    title: 'Revenue and pipeline',
    note: 'Deal values recorded by the operator. No invoice, payment, or accounting system is involved.',
    kpis: [
      {
        id: 'won-value',
        label: 'Closed-won value',
        value: formatCurrencyCents(wonValue),
        basis: `${String(wonInWindow.length)} ${wonInWindow.length === 1 ? 'deal' : 'deals'} moved to won in this window, summed at the value on each record.`,
        sample: wonInWindow.length,
        tone: wonValue > 0 ? 'sentinel' : 'muted',
        href: '/pipeline?stage=won',
        demo: anyDemo(wonInWindow),
      },
      {
        id: 'open-value',
        label: 'Open pipeline',
        value: formatCurrencyCents(open.reduce((total, row) => total + row.valueCents, 0)),
        basis: `Face value of ${String(open.length)} open ${open.length === 1 ? 'opportunity' : 'opportunities'}, ignoring probability.`,
        sample: open.length,
        tone: 'info',
        href: '/pipeline',
        demo: anyDemo(open),
      },
      {
        id: 'expected-value',
        label: 'Weighted expected value',
        value: formatCurrencyCents(open.reduce((total, row) => total + expectedValueCents(row), 0)),
        basis: 'Value × the probability written on each record. The probability is a judgement, not a model output.',
        sample: open.length,
        tone: 'info',
        href: '/pipeline',
        demo: anyDemo(open),
      },
      {
        id: 'win-rate',
        label: 'Win rate',
        value: percent(wonInWindow.length, closedInWindow.length),
        basis:
          closedInWindow.length === 0
            ? 'Nothing closed in this window, so there is no rate to report.'
            : `${String(wonInWindow.length)} won against ${String(lostInWindow.length)} lost among deals closed in this window.`,
        sample: closedInWindow.length,
        tone: closedInWindow.length === 0 ? 'muted' : 'neutral',
        href: '/pipeline?stage=all',
        demo: anyDemo(closedInWindow),
      },
      {
        id: 'average-won',
        label: 'Average won deal',
        value:
          wonInWindow.length === 0
            ? '—'
            : formatCurrencyCents(Math.round(wonValue / wonInWindow.length)),
        basis:
          wonInWindow.length === 0
            ? 'No deal was won in this window.'
            : `Mean across ${String(wonInWindow.length)} won ${wonInWindow.length === 1 ? 'deal' : 'deals'}. A mean over a handful of deals moves with any one of them.`,
        sample: wonInWindow.length,
        tone: 'neutral',
        href: '/pipeline?stage=won',
        demo: anyDemo(wonInWindow),
      },
      {
        id: 'stalled-value',
        label: 'Value in stalled deals',
        value: formatCurrencyCents(
          open
            .filter((row) => isStalled(row, now))
            .reduce((total, row) => total + row.valueCents, 0),
        ),
        basis: 'Open deals with no stage movement for two weeks or more. Nothing here is moving on its own.',
        sample: open.filter((row) => isStalled(row, now)).length,
        tone: open.some((row) => isStalled(row, now)) ? 'warning' : 'muted',
        href: '/pipeline',
        demo: anyDemo(open.filter((row) => isStalled(row, now))),
      },
    ],
  };
}

function deliveryGroup(dataset: SovereignDataset, window: MetricWindow, now: Date): KpiGroup {
  const start = metricWindowStart(window, now);
  const completed = dataset.tasks.filter((task) => inWindow(task.completedAt, start, now));
  const cycleTimes = completed
    .map((task) => {
      const from = Date.parse(task.createdAt);
      const to = Date.parse(task.completedAt ?? '');
      return Number.isNaN(from) || Number.isNaN(to) ? null : (to - from) / DAY_MS;
    })
    .filter((days): days is number => days !== null && days >= 0);
  const blocked = dataset.tasks.filter((task) => task.status === 'blocked');
  const activeProjects = dataset.projects.filter((project) => project.status === 'active');

  return {
    id: 'delivery',
    title: 'Delivery',
    note: 'Execution counted from task and project records in this browser.',
    kpis: [
      {
        id: 'tasks-completed',
        label: 'Tasks completed',
        value: String(completed.length),
        basis: `Tasks carrying a completion date inside the window, out of ${String(dataset.tasks.length)} in the store.`,
        sample: dataset.tasks.length,
        tone: completed.length > 0 ? 'sentinel' : 'muted',
        href: '/tasks?status=done',
        demo: anyDemo(completed),
      },
      {
        id: 'cycle-time',
        label: 'Median days to close a task',
        value:
          cycleTimes.length === 0
            ? '—'
            : `${median(cycleTimes)?.toFixed(1) ?? '—'}d`,
        basis:
          cycleTimes.length === 0
            ? 'No task in this window carries both a creation and a completion date.'
            : `Median from creation to completion across ${String(cycleTimes.length)} tasks. Seeded rows were created when the store was seeded, which shortens this.`,
        sample: cycleTimes.length,
        tone: 'neutral',
        href: '/tasks',
        demo: anyDemo(completed),
      },
      {
        id: 'blocked-work',
        label: 'Blocked tasks',
        value: String(blocked.length),
        basis:
          blocked.length === 0
            ? 'Nothing in the store is marked blocked.'
            : `${String(blocked.filter((task) => task.blockedReason === undefined).length)} of them carry no reason, which is its own problem.`,
        sample: dataset.tasks.length,
        tone: blocked.length > 0 ? 'warning' : 'sentinel',
        href: '/tasks?status=blocked',
        demo: anyDemo(blocked),
      },
      {
        id: 'active-projects',
        label: 'Active projects',
        value: String(activeProjects.length),
        basis: `${String(dataset.projects.filter((project) => project.status === 'blocked').length)} more are blocked, and ${String(dataset.projects.filter((project) => project.status === 'complete').length)} are complete.`,
        sample: dataset.projects.length,
        tone: 'info',
        href: '/projects',
        demo: anyDemo(activeProjects),
      },
    ],
  };
}

function contentGroup(dataset: SovereignDataset, window: MetricWindow, now: Date): KpiGroup {
  const start = metricWindowStart(window, now);
  const published = dataset.contentItems.filter((item) => inWindow(item.publishedAt, start, now));
  const impressions = dataset.contentMetrics.reduce((total, row) => total + row.impressions, 0);
  const engagements = dataset.contentMetrics.reduce((total, row) => total + row.engagements, 0);
  const conversions = dataset.contentMetrics.reduce((total, row) => total + row.conversions, 0);
  const days = windowDays(window);

  return {
    id: 'content',
    title: 'Content throughput',
    note: 'Publishing is recorded by hand; performance is readings entered by hand or seeded.',
    kpis: [
      {
        id: 'published',
        label: 'Packages published',
        value: String(published.length),
        basis: 'Recorded publishes. No platform on this surface has ever confirmed a post went out.',
        sample: dataset.contentItems.length,
        tone: published.length > 0 ? 'sentinel' : 'muted',
        href: '/content',
        demo: anyDemo(published),
      },
      {
        id: 'cadence',
        label: 'Publishes per week',
        value:
          days === null || published.length === 0
            ? '—'
            : (published.length / (days / 7)).toFixed(1),
        basis:
          days === null
            ? 'The all-time window has no fixed length, so a rate would be arbitrary.'
            : `${String(published.length)} publishes spread across ${String(Math.round(days / 7))} weeks.`,
        sample: published.length,
        tone: 'neutral',
        href: '/content/calendar',
        demo: anyDemo(published),
      },
      {
        id: 'engagement-rate',
        label: 'Engagement rate',
        value: impressions === 0 ? '—' : percent(engagements, impressions),
        basis:
          dataset.contentMetrics.length === 0
            ? 'No performance readings are recorded.'
            : `${String(engagements)} engagements against ${String(impressions)} impressions across ${String(dataset.contentMetrics.length)} readings.`,
        sample: dataset.contentMetrics.length,
        tone: 'info',
        href: '/content/analytics',
        demo: anyDemo(dataset.contentMetrics),
      },
      {
        id: 'conversions',
        label: 'Recorded conversions',
        value: String(conversions),
        basis:
          'Counted from the readings on the packages. Nothing links a conversion to an opportunity yet, so this is not attributed revenue.',
        sample: dataset.contentMetrics.length,
        tone: conversions > 0 ? 'info' : 'muted',
        href: '/content/analytics',
        demo: anyDemo(dataset.contentMetrics),
      },
    ],
  };
}

function leverageGroup(dataset: SovereignDataset, window: MetricWindow, now: Date): KpiGroup {
  const start = metricWindowStart(window, now);
  const decided = dataset.approvals.filter(
    (approval) => approval.status !== 'pending' && inWindow(approval.decidedAt, start, now),
  );
  const latencies = decided
    .map((approval) => {
      const from = Date.parse(approval.createdAt);
      const to = Date.parse(approval.decidedAt ?? '');
      return Number.isNaN(from) || Number.isNaN(to) ? null : (to - from) / 3_600_000;
    })
    .filter((hours): hours is number => hours !== null && hours >= 0);
  const pending = dataset.approvals.filter((approval) => approval.status === 'pending');
  const runs = dataset.automationRuns.filter((run) => inWindow(run.at, start, now));
  const applied = runs.filter((run) => run.outcome === 'applied');
  const refused = runs.filter((run) => run.outcome === 'refused');

  return {
    id: 'leverage',
    title: 'Gates and leverage',
    note: 'How quickly decisions get made, and what the local automation fabric actually did.',
    kpis: [
      {
        id: 'gate-latency',
        label: 'Median hours to decide a gate',
        value: latencies.length === 0 ? '—' : `${(median(latencies) ?? 0).toFixed(1)}h`,
        basis:
          latencies.length === 0
            ? 'No gate was decided in this window.'
            : `Median across ${String(decided.length)} decided gates, measured from when each gate was raised.`,
        sample: decided.length,
        tone: 'neutral',
        href: '/approvals?status=all',
        demo: anyDemo(decided),
      },
      {
        id: 'gates-open',
        label: 'Gates still open',
        value: String(pending.length),
        basis:
          pending.length === 0
            ? 'Nothing is waiting on a human.'
            : `${String(pending.filter((approval) => approval.automationRunId !== undefined).length)} of them were opened by an automation rule rather than by a person.`,
        sample: dataset.approvals.length,
        tone: pending.length > 0 ? 'warning' : 'sentinel',
        href: '/approvals?status=pending',
        demo: anyDemo(pending),
      },
      {
        id: 'automation-applied',
        label: 'Automation runs that did something',
        value: `${String(applied.length)} of ${String(runs.length)}`,
        basis:
          runs.length === 0
            ? 'No rule was run in this window. Nothing on this surface runs on a timer.'
            : `${String(refused.length)} could not run at all, and are recorded as refusing rather than as passing.`,
        sample: runs.length,
        tone: refused.length > applied.length ? 'warning' : 'info',
        href: '/automations',
        demo: anyDemo(runs),
      },
      {
        id: 'automation-reach',
        label: 'Records an automation touched',
        value: String(applied.reduce((total, run) => total + run.matched, 0)),
        basis: 'Matched records on the runs that applied. Each one was still written locally and nothing left this browser.',
        sample: applied.length,
        tone: 'info',
        href: '/automations',
        demo: anyDemo(applied),
      },
    ],
  };
}

/**
 * The metric rows the store carries as records, kept apart from everything above
 * because they were *declared*, not counted. A seeded or hand-entered figure and
 * a figure derived from the domain are different claims about the operation.
 */
function declaredGroup(dataset: SovereignDataset): KpiGroup {
  return {
    id: 'declared',
    title: 'Declared metrics',
    note: 'Recorded as figures rather than counted from records. Kept separate on purpose.',
    kpis: [...dataset.metrics]
      .sort((a, b) => Math.abs(b.deltaPercent) - Math.abs(a.deltaPercent))
      .map((metric) => ({
        id: `declared-${metric.id}`,
        label: metric.label,
        value: formatMetricValue(metric.value, metric.unit),
        basis: `${metric.origin.length > 0 ? metric.origin : 'No origin recorded'} · ${formatDelta(metric.deltaPercent)} over ${metric.window}. Nothing in this store verifies it.`,
        sample: 1,
        tone: metric.deltaPercent > 0 ? 'info' : metric.deltaPercent < 0 ? 'warning' : 'neutral',
        demo: metric.source === 'demo',
      })),
  };
}

export function kpiGroups(
  dataset: SovereignDataset,
  window: MetricWindow,
  now: Date,
): KpiGroup[] {
  return [
    revenueGroup(dataset, window, now),
    deliveryGroup(dataset, window, now),
    contentGroup(dataset, window, now),
    leverageGroup(dataset, window, now),
    declaredGroup(dataset),
  ].filter((group) => group.kpis.length > 0);
}

/**
 * What the financial picture is missing, named on the surface. A KPI page that
 * shows revenue without saying it has no cost side invites the reader to treat
 * it as a P&L.
 */
export const METRIC_BLIND_SPOTS: readonly string[] = [
  'No cost, margin, cash, or tax figure exists in this store. Revenue here is deal value recorded on an opportunity, so nothing on this page is a profit-and-loss statement.',
  'No accounting, payments, or banking system is connected, and no finance API is called from this bundle. Nothing here was reconciled against money that moved.',
  'Recognition is by stage change: a deal counts on the day it was marked won, not on the day it was invoiced or paid.',
];
