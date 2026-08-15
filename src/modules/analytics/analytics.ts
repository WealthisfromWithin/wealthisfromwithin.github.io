import type { SovereignDataset } from '@/data/dataset';
import { DATASET_KEYS } from '@/data/dataset';
import type { ActivityEvent } from '@/domain';
import { DAY_MS, dateKey, formatDayLabel, startOfDay } from '@/lib/clock';

/**
 * Product analytics over the local store.
 *
 * Everything here is counted from rows this browser holds: activity events the
 * write path recorded, records created or touched in a window, and the outcomes
 * of the loops the surface runs. There is no analytics connector, no page-view
 * beacon, and no session tracking — nothing observes the operator, so the only
 * thing this module can report is what the store was asked to write.
 *
 * That boundary is stated on the surface rather than papered over: a number here
 * means "recorded in this browser", and a surface with no rows reads as unused
 * rather than as zero traffic.
 */

/* ── Window ─────────────────────────────────────────────────────────────── */

export const ANALYTICS_WINDOWS = ['7d', '30d', '90d', 'all'] as const;
export type AnalyticsWindow = (typeof ANALYTICS_WINDOWS)[number];

export const analyticsWindowLabel: Record<AnalyticsWindow, string> = {
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
  all: 'All recorded',
};

export function parseAnalyticsWindow(value: string | null): AnalyticsWindow {
  return ANALYTICS_WINDOWS.find((option) => option === value) ?? '30d';
}

export function windowDays(window: AnalyticsWindow): number | null {
  switch (window) {
    case '7d':
      return 7;
    case '30d':
      return 30;
    case '90d':
      return 90;
    case 'all':
      return null;
  }
}

/** The instant a window opens, or null when the window is everything recorded. */
export function windowStart(window: AnalyticsWindow, now: Date): Date | null {
  const days = windowDays(window);
  return days === null ? null : new Date(startOfDay(now).getTime() - (days - 1) * DAY_MS);
}

function withinWindow(value: string | undefined, start: Date | null, now: Date): boolean {
  if (value === undefined) return false;
  const at = Date.parse(value);
  if (Number.isNaN(at)) return false;
  if (at > now.getTime()) return false;
  return start === null || at >= start.getTime();
}

/* ── Activity ───────────────────────────────────────────────────────────── */

export interface ActivityDay {
  /** Local calendar date, so a day is the operator's day rather than UTC's. */
  key: string;
  label: string;
  count: number;
}

/**
 * Recorded events per day, oldest first. Fixed at a small number of days
 * whatever the window is: a hundred one-pixel bars is decoration, not a reading.
 */
export function activityByDay(dataset: SovereignDataset, now: Date, days = 14): ActivityDay[] {
  const buckets = new Map<string, number>();
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    buckets.set(dateKey(new Date(startOfDay(now).getTime() - offset * DAY_MS)), 0);
  }

  for (const event of dataset.events) {
    const at = Date.parse(event.at);
    if (Number.isNaN(at)) continue;
    const key = dateKey(new Date(at));
    const current = buckets.get(key);
    if (current !== undefined) buckets.set(key, current + 1);
  }

  return [...buckets].map(([key, count]) => ({
    key,
    label: formatDayLabel(new Date(`${key}T12:00:00`)),
    count,
  }));
}

export type ActivityChannel = ActivityEvent['channel'];

export const activityChannelLabel: Record<ActivityChannel, string> = {
  pipeline: 'Pipeline',
  content: 'Content',
  automation: 'Automation',
  system: 'System',
  inbox: 'Inbox',
  execution: 'Execution',
  relationship: 'Relationships',
  cognition: 'Cognition',
};

export interface ChannelCount {
  channel: ActivityChannel;
  label: string;
  count: number;
  /** Share of the window's events, 0–100. Zero when nothing was recorded. */
  share: number;
}

export function channelMix(
  dataset: SovereignDataset,
  window: AnalyticsWindow,
  now: Date,
): ChannelCount[] {
  const start = windowStart(window, now);
  const inWindow = dataset.events.filter((event) => withinWindow(event.at, start, now));
  const total = inWindow.length;

  const counts = new Map<ActivityChannel, number>();
  for (const event of inWindow) {
    counts.set(event.channel, (counts.get(event.channel) ?? 0) + 1);
  }

  return [...counts]
    .map(([channel, count]) => ({
      channel,
      label: activityChannelLabel[channel],
      count,
      share: total === 0 ? 0 : Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/* ── Throughput ─────────────────────────────────────────────────────────── */

/**
 * The surfaces worth counting rows for, and where each one lives. Deliberately
 * not every dataset key: a table of thirty rows reports nothing, and the
 * library tables move only when the operator is editing the library itself.
 */
const THROUGHPUT_SURFACES = [
  { key: 'tasks', label: 'Tasks', href: '/tasks' },
  { key: 'projects', label: 'Projects', href: '/projects' },
  { key: 'opportunities', label: 'Opportunities', href: '/pipeline' },
  { key: 'contentItems', label: 'Content packages', href: '/content' },
  { key: 'contentIdeas', label: 'Content ideas', href: '/content/ideas' },
  { key: 'decisions', label: 'Decisions', href: '/decisions' },
  { key: 'knowledgeNodes', label: 'Knowledge', href: '/knowledge' },
  { key: 'memoryEntries', label: 'Memory', href: '/memory' },
  { key: 'documents', label: 'Documents', href: '/documents' },
  { key: 'researchItems', label: 'Research', href: '/research' },
  { key: 'agentMessages', label: 'AI turns', href: '/ai' },
  { key: 'automationRuns', label: 'Automation runs', href: '/automations' },
] as const satisfies readonly { key: keyof SovereignDataset; label: string; href: string }[];

export interface ThroughputRow {
  id: string;
  label: string;
  href: string;
  rows: number;
  created: number;
  /** Rows the operator authored or changed, from `touchedAt`. */
  touched: number;
  demo: number;
  /** Rows that are not demo data, whatever else they are. */
  operator: number;
}

export function throughputRows(
  dataset: SovereignDataset,
  window: AnalyticsWindow,
  now: Date,
): ThroughputRow[] {
  const start = windowStart(window, now);

  return THROUGHPUT_SURFACES.map((surface) => {
    const rows = dataset[surface.key];
    return {
      id: surface.key,
      label: surface.label,
      href: surface.href,
      rows: rows.length,
      created: rows.filter((row) => withinWindow(row.createdAt, start, now)).length,
      touched: rows.filter((row) => withinWindow(row.touchedAt, start, now)).length,
      demo: rows.filter((row) => row.source === 'demo').length,
      operator: rows.filter((row) => row.source !== 'demo').length,
    };
  }).sort((a, b) => b.created + b.touched - (a.created + a.touched) || a.label.localeCompare(b.label));
}

/* ── Loops ──────────────────────────────────────────────────────────────── */

/**
 * One reading of one loop the surface runs, with the basis it was counted on.
 * `basis` is not decoration: a number without the sentence explaining how it was
 * derived is the thing this codebase refuses to print.
 */
export interface LoopReading {
  id: string;
  label: string;
  value: string;
  basis: string;
  /** How many rows the reading was taken from. */
  sample: number;
  href?: string;
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? null;
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/** Hours between two timestamps, or null when either is missing or unparseable. */
export function hoursBetween(from: string | undefined, to: string | undefined): number | null {
  if (from === undefined || to === undefined) return null;
  const start = Date.parse(from);
  const end = Date.parse(to);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return (end - start) / 3_600_000;
}

export function approvalLatencyHours(
  dataset: SovereignDataset,
  window: AnalyticsWindow,
  now: Date,
): number | null {
  const start = windowStart(window, now);
  const latencies = dataset.approvals
    .filter((approval) => approval.status !== 'pending')
    .filter((approval) => withinWindow(approval.decidedAt, start, now))
    .map((approval) => hoursBetween(approval.createdAt, approval.decidedAt))
    .filter((hours): hours is number => hours !== null && hours >= 0);
  return median(latencies);
}

export function loopReadings(
  dataset: SovereignDataset,
  window: AnalyticsWindow,
  now: Date,
): LoopReading[] {
  const start = windowStart(window, now);
  const readings: LoopReading[] = [];

  const published = dataset.contentItems.filter((item) =>
    withinWindow(item.publishedAt, start, now),
  );
  readings.push({
    id: 'content-published',
    label: 'Packages recorded as published',
    value: String(published.length),
    basis: 'Publishing is recorded by hand on this surface; no platform confirmed any of these.',
    sample: dataset.contentItems.length,
    href: '/content',
  });

  const promoted = dataset.contentIdeas.filter((idea) => idea.promotedItemId !== undefined);
  readings.push({
    id: 'idea-conversion',
    label: 'Ideas that became drafts',
    value:
      dataset.contentIdeas.length === 0
        ? '—'
        : `${String(Math.round((promoted.length / dataset.contentIdeas.length) * 100))}%`,
    basis: `${String(promoted.length)} of ${String(dataset.contentIdeas.length)} captured ideas carry a promoted package.`,
    sample: dataset.contentIdeas.length,
    href: '/content/ideas',
  });

  const decided = dataset.approvals.filter(
    (approval) => approval.status !== 'pending' && withinWindow(approval.decidedAt, start, now),
  );
  const latency = approvalLatencyHours(dataset, window, now);
  readings.push({
    id: 'approval-latency',
    label: 'Median time to decide a gate',
    value: latency === null ? '—' : `${latency.toFixed(latency < 10 ? 1 : 0)}h`,
    basis:
      latency === null
        ? 'No gate was decided in this window, so there is nothing to take a median of.'
        : `Median across ${String(decided.length)} gates decided in this window, measured from when the gate was raised.`,
    sample: decided.length,
    href: '/approvals',
  });

  const turns = dataset.agentMessages.filter(
    (message) => message.role === 'user' && withinWindow(message.at, start, now),
  );
  const refusedTurns = dataset.agentMessages.filter(
    (message) => message.outcome === 'refused' && withinWindow(message.at, start, now),
  );
  readings.push({
    id: 'kernel-refusals',
    label: 'AI turns the kernel refused',
    value: `${String(refusedTurns.length)} of ${String(turns.length)}`,
    basis:
      'A refusal is the expected outcome while no provider is configured, and it is recorded like any other turn.',
    sample: turns.length,
    href: '/ai',
  });

  const runs = dataset.automationRuns.filter((run) => withinWindow(run.at, start, now));
  const applied = runs.filter((run) => run.outcome === 'applied').length;
  readings.push({
    id: 'automation-runs',
    label: 'Automation runs that changed something',
    value: `${String(applied)} of ${String(runs.length)}`,
    basis:
      'The rest matched nothing, stopped at a gate, or could not run. Every run is in the log either way.',
    sample: runs.length,
    href: '/automations',
  });

  const completed = dataset.tasks.filter((task) => withinWindow(task.completedAt, start, now));
  readings.push({
    id: 'tasks-completed',
    label: 'Tasks completed',
    value: String(completed.length),
    basis: `Counted from the completion date on the task, out of ${String(dataset.tasks.length)} in the store.`,
    sample: dataset.tasks.length,
    href: '/tasks?status=done',
  });

  return readings;
}

/* ── Provenance ─────────────────────────────────────────────────────────── */

export interface ProvenanceSplit {
  total: number;
  demo: number;
  operator: number;
  /** Rows carrying `touchedAt`: the ones a reseed will not overwrite. */
  touched: number;
  /** Demo share of the store, 0–100. */
  demoShare: number;
}

export function provenanceSplit(dataset: SovereignDataset): ProvenanceSplit {
  let total = 0;
  let demo = 0;
  let touched = 0;

  for (const key of DATASET_KEYS) {
    for (const row of dataset[key]) {
      total += 1;
      if (row.source === 'demo') demo += 1;
      if (row.touchedAt !== undefined) touched += 1;
    }
  }

  return {
    total,
    demo,
    operator: total - demo,
    touched,
    demoShare: total === 0 ? 0 : Math.round((demo / total) * 100),
  };
}

/**
 * What these numbers cannot tell the operator. Rendered on the page, because a
 * dashboard that omits its own blind spots reads as more authoritative than it is.
 */
export function analyticsCaveats(dataset: SovereignDataset): string[] {
  const caveats = [
    'Nothing observes the operator. There is no page-view beacon, no session recording, and no analytics connector — every number here is a row this browser was asked to write.',
    'Activity is only recorded for actions taken through this surface. Work done elsewhere leaves no event, so a quiet day and an unrecorded day look the same.',
  ];

  if (dataset.contentMetrics.length > 0) {
    caveats.push(
      `Content performance is ${String(dataset.contentMetrics.length)} readings entered by hand or seeded. No platform API has ever reported a number into this store.`,
    );
  }

  const split = provenanceSplit(dataset);
  if (split.demo > 0) {
    caveats.push(
      `${String(split.demoShare)}% of the rows behind these figures are demo data. Clear the demo store in Settings to read the operation alone.`,
    );
  }

  return caveats;
}
