import type { SovereignDataset } from '@/data/dataset';
import type { ContentFormat, ContentItem, ContentMetric, ContentPlatform } from '@/domain';
import { DAY_MS } from '@/lib/clock';
import { contentFormatLabel, contentPlatformLabel } from './content';

/**
 * Performance and learning, counted from `contentMetrics` rows only.
 *
 * Every number here is a sum or a ratio of readings someone typed in or the
 * seeder wrote. There is no analytics connector, no attribution model, and no
 * forecast: an insight states what the recorded rows say and how many rows said
 * it, so a sample of two is visibly a sample of two.
 */

export interface ItemPerformance {
  item: ContentItem;
  /** The most recent reading per platform, summed. Readings are cumulative. */
  impressions: number;
  engagements: number;
  clicks: number;
  conversions: number;
  /** engagements ÷ impressions, or null when nothing was ever recorded. */
  engagementRate: number | null;
  readings: number;
  lastCapturedAt: string | undefined;
}

function latestPerPlatform(metrics: readonly ContentMetric[]): ContentMetric[] {
  const latest = new Map<ContentPlatform, ContentMetric>();
  for (const metric of metrics) {
    const current = latest.get(metric.platform);
    if (!current || Date.parse(metric.capturedAt) > Date.parse(current.capturedAt)) {
      latest.set(metric.platform, metric);
    }
  }
  return [...latest.values()];
}

export function itemPerformance(
  dataset: SovereignDataset,
  item: ContentItem,
): ItemPerformance {
  const metrics = dataset.contentMetrics.filter((metric) => metric.contentItemId === item.id);
  const current = latestPerPlatform(metrics);

  const impressions = current.reduce((total, metric) => total + metric.impressions, 0);
  const engagements = current.reduce((total, metric) => total + metric.engagements, 0);
  const lastCapturedAt = metrics
    .map((metric) => metric.capturedAt)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];

  return {
    item,
    impressions,
    engagements,
    clicks: current.reduce((total, metric) => total + metric.clicks, 0),
    conversions: current.reduce((total, metric) => total + metric.conversions, 0),
    engagementRate: impressions > 0 ? engagements / impressions : null,
    readings: metrics.length,
    lastCapturedAt,
  };
}

/** Published items ranked by engagement rate; items with no readings sink. */
export function contentPerformance(dataset: SovereignDataset): ItemPerformance[] {
  return dataset.contentItems
    .filter((item) => item.status === 'published')
    .map((item) => itemPerformance(dataset, item))
    .sort((a, b) => (b.engagementRate ?? -1) - (a.engagementRate ?? -1));
}

export interface PerformanceGroup {
  key: string;
  label: string;
  items: number;
  impressions: number;
  engagements: number;
  engagementRate: number | null;
}

function group(
  rows: readonly ItemPerformance[],
  keyOf: (row: ItemPerformance) => string | undefined,
  labelOf: (key: string) => string,
): PerformanceGroup[] {
  const buckets = new Map<string, PerformanceGroup>();

  for (const row of rows) {
    const key = keyOf(row);
    if (key === undefined || row.readings === 0) continue;
    const bucket = buckets.get(key) ?? {
      key,
      label: labelOf(key),
      items: 0,
      impressions: 0,
      engagements: 0,
      engagementRate: null,
    };
    bucket.items += 1;
    bucket.impressions += row.impressions;
    bucket.engagements += row.engagements;
    buckets.set(key, bucket);
  }

  return [...buckets.values()]
    .map((bucket) => ({
      ...bucket,
      engagementRate: bucket.impressions > 0 ? bucket.engagements / bucket.impressions : null,
    }))
    .sort((a, b) => (b.engagementRate ?? -1) - (a.engagementRate ?? -1));
}

export function performanceByFormat(rows: readonly ItemPerformance[]): PerformanceGroup[] {
  return group(
    rows,
    (row) => row.item.format,
    (key) => contentFormatLabel[key as ContentFormat],
  );
}

export function performanceByPlatform(rows: readonly ItemPerformance[]): PerformanceGroup[] {
  return group(
    rows,
    (row) => row.item.platform,
    (key) => contentPlatformLabel[key as ContentPlatform],
  );
}

export function performanceByHook(
  dataset: SovereignDataset,
  rows: readonly ItemPerformance[],
): PerformanceGroup[] {
  const styles = new Map(dataset.hooks.map((hook) => [hook.id, hook.style]));
  return group(
    rows,
    (row) => (row.item.hookId ? styles.get(row.item.hookId) : undefined),
    (key) => `${key.charAt(0).toUpperCase()}${key.slice(1)} hook`,
  );
}

export interface LearningInsight {
  id: string;
  headline: string;
  detail: string;
  /** The count the claim rests on, printed next to it. */
  evidence: string;
}

function ratePercent(rate: number | null): string {
  return rate === null ? '—' : `${(rate * 100).toFixed(1)}%`;
}

/**
 * The learning loop's local shape: a comparison is only offered when two groups
 * both carry readings, and each insight names its sample size. With one
 * published item there is nothing to learn, and the list says so by being empty.
 */
export function contentLearningInsights(dataset: SovereignDataset): LearningInsight[] {
  const rows = contentPerformance(dataset).filter((row) => row.readings > 0);
  if (rows.length === 0) return [];

  const insights: LearningInsight[] = [];

  const platforms = performanceByPlatform(rows);
  if (platforms.length >= 2) {
    const [best, ...rest] = platforms;
    const worst = rest[rest.length - 1];
    if (best && worst) {
      insights.push({
        id: 'insight:platform',
        headline: `${best.label} engages ${ratePercent(best.engagementRate)} against ${worst.label} at ${ratePercent(worst.engagementRate)}`,
        detail:
          'Engagements divided by impressions on the latest reading of each published item.',
        evidence: `${String(best.items)} item(s) on ${best.label}, ${String(worst.items)} on ${worst.label}`,
      });
    }
  }

  const formats = performanceByFormat(rows);
  if (formats.length >= 2) {
    const [best] = formats;
    if (best) {
      insights.push({
        id: 'insight:format',
        headline: `${best.label} is the strongest recorded format at ${ratePercent(best.engagementRate)}`,
        detail: `Across ${String(formats.length)} formats with readings.`,
        evidence: `${String(best.items)} published item(s), ${String(best.impressions)} impressions`,
      });
    }
  }

  const hooks = performanceByHook(dataset, rows);
  if (hooks.length >= 2) {
    const [best] = hooks;
    if (best) {
      insights.push({
        id: 'insight:hook',
        headline: `${best.label}s carry the best engagement at ${ratePercent(best.engagementRate)}`,
        detail: 'Grouped by the style recorded on the hook each item used.',
        evidence: `${String(best.items)} published item(s) used this style`,
      });
    }
  }

  const conversions = rows.reduce((total, row) => total + row.conversions, 0);
  if (conversions > 0) {
    const top = [...rows].sort((a, b) => b.conversions - a.conversions)[0];
    if (top) {
      insights.push({
        id: 'insight:conversion',
        headline: `${String(conversions)} recorded conversions across published content`,
        detail: `"${top.item.title}" accounts for ${String(top.conversions)} of them.`,
        evidence: `${String(rows.length)} published item(s) with readings`,
      });
    }
  }

  return insights;
}

export interface OptimisationWindow {
  label: string;
  items: number;
  impressions: number;
  engagements: number;
  conversions: number;
  engagementRate: number | null;
}

export interface MonthlyOptimisation {
  current: OptimisationWindow;
  previous: OptimisationWindow;
  /** Percentage-point change in engagement rate, or null when a window is empty. */
  engagementRateDelta: number | null;
  impressionDeltaPercent: number | null;
}

function windowOf(
  label: string,
  metrics: readonly ContentMetric[],
  fromMs: number,
  toMs: number,
): OptimisationWindow {
  const inWindow = metrics.filter((metric) => {
    const at = Date.parse(metric.capturedAt);
    return !Number.isNaN(at) && at >= fromMs && at < toMs;
  });

  const impressions = inWindow.reduce((total, metric) => total + metric.impressions, 0);
  const engagements = inWindow.reduce((total, metric) => total + metric.engagements, 0);

  return {
    label,
    items: new Set(inWindow.map((metric) => metric.contentItemId)).size,
    impressions,
    engagements,
    conversions: inWindow.reduce((total, metric) => total + metric.conversions, 0),
    engagementRate: impressions > 0 ? engagements / impressions : null,
  };
}

/**
 * Thirty days against the thirty before them, over the readings captured in each
 * window. It compares what was measured, not what was published.
 */
export function monthlyOptimisation(dataset: SovereignDataset, now: Date): MonthlyOptimisation {
  const nowMs = now.getTime();
  const thirty = 30 * DAY_MS;

  const current = windowOf('Last 30 days', dataset.contentMetrics, nowMs - thirty, nowMs + 1);
  const previous = windowOf(
    'Previous 30 days',
    dataset.contentMetrics,
    nowMs - 2 * thirty,
    nowMs - thirty,
  );

  return {
    current,
    previous,
    engagementRateDelta:
      current.engagementRate === null || previous.engagementRate === null
        ? null
        : (current.engagementRate - previous.engagementRate) * 100,
    impressionDeltaPercent:
      previous.impressions === 0
        ? null
        : ((current.impressions - previous.impressions) / previous.impressions) * 100,
  };
}
