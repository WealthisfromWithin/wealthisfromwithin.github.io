import { describe, expect, it } from 'vitest';
import { emptyDataset, type SovereignDataset } from '@/data/dataset';
import { buildDemoDataset } from '@/data/seed';
import { DAY_MS } from '@/lib/clock';
import {
  contentLearningInsights,
  contentPerformance,
  itemPerformance,
  monthlyOptimisation,
  performanceByFormat,
  performanceByHook,
  performanceByPlatform,
} from './learning';

const now = new Date('2026-08-05T07:30:00.000Z');
const dataset = buildDemoDataset(now);

function item(id: string): SovereignDataset['contentItems'][number] {
  const found = dataset.contentItems.find((row) => row.id === id);
  if (!found) throw new Error(`No seeded content item ${id}`);
  return found;
}

describe('itemPerformance', () => {
  it('counts the latest reading per platform, not the sum of the history', () => {
    // Two cumulative LinkedIn readings: 4820 then 6140. Only the later one counts.
    const performance = itemPerformance(dataset, item('c-compounding-essay'));

    expect(performance.readings).toBe(2);
    expect(performance.impressions).toBe(6140);
    expect(performance.engagements).toBe(288);
    expect(performance.clicks).toBe(91);
    expect(performance.conversions).toBe(4);
    expect(performance.engagementRate).toBeCloseTo(288 / 6140, 6);
    expect(performance.lastCapturedAt).toBeDefined();
  });

  it('returns a null rate rather than a zero for an item nobody measured', () => {
    const performance = itemPerformance(dataset, item('c-constraint'));

    expect(performance.readings).toBe(0);
    expect(performance.impressions).toBe(0);
    expect(performance.engagementRate).toBeNull();
    expect(performance.lastCapturedAt).toBeUndefined();
  });
});

describe('contentPerformance', () => {
  it('covers published items only and ranks them by engagement rate', () => {
    const rows = contentPerformance(dataset);

    expect(rows.every((row) => row.item.status === 'published')).toBe(true);
    expect(rows.map((row) => row.item.id)).toContain('c-audit-walkthrough');
    expect(rows.map((row) => row.item.id)).not.toContain('c-constraint');

    const rates = rows.map((row) => row.engagementRate ?? -1);
    expect([...rates].sort((a, b) => b - a)).toEqual(rates);
  });

  it('is empty on an empty store', () => {
    expect(contentPerformance(emptyDataset)).toEqual([]);
  });
});

describe('performance groups', () => {
  const rows = contentPerformance(dataset).filter((row) => row.readings > 0);

  it('drops items with no readings so a group is never inflated by silence', () => {
    const withNoReadings = contentPerformance(dataset).filter((row) => row.readings === 0);
    const grouped = performanceByPlatform(contentPerformance(dataset));
    const counted = grouped.reduce((total, group) => total + group.items, 0);

    expect(counted).toBe(contentPerformance(dataset).length - withNoReadings.length);
  });

  it('groups by platform and sums impressions inside each bucket', () => {
    const groups = performanceByPlatform(rows);
    const linkedin = groups.find((group) => group.key === 'linkedin');

    expect(linkedin?.label).toBe('LinkedIn');
    expect(linkedin?.items).toBe(2);
    expect(linkedin?.impressions).toBe(6140 + 2680);
    expect(linkedin?.engagementRate).toBeCloseTo((288 + 84) / (6140 + 2680), 6);
  });

  it('groups by format with the readable label', () => {
    const groups = performanceByFormat(rows);
    expect(groups.map((group) => group.key).sort()).toEqual(
      ['article', 'newsletter', 'post', 'video'].sort(),
    );
    expect(groups.find((group) => group.key === 'video')?.label).toBe('Video');
  });

  it('groups by the style of the hook each item used', () => {
    const groups = performanceByHook(dataset, rows);

    expect(groups.length).toBeGreaterThan(0);
    for (const group of groups) {
      expect(group.label.endsWith('hook')).toBe(true);
    }
  });
});

describe('contentLearningInsights', () => {
  it('says nothing when nothing was measured', () => {
    expect(contentLearningInsights(emptyDataset)).toEqual([]);
    expect(contentLearningInsights({ ...dataset, contentMetrics: [] })).toEqual([]);
  });

  it('prints the sample size beside every claim', () => {
    const insights = contentLearningInsights(dataset);

    expect(insights.length).toBeGreaterThan(0);
    for (const insight of insights) {
      expect(insight.evidence.length).toBeGreaterThan(0);
      expect(insight.headline.length).toBeGreaterThan(0);
    }
  });

  it('compares platforms only when two of them carry readings', () => {
    const single: SovereignDataset = {
      ...dataset,
      contentMetrics: dataset.contentMetrics.filter((metric) => metric.platform === 'linkedin'),
    };

    expect(contentLearningInsights(single).map((insight) => insight.id)).not.toContain(
      'insight:platform',
    );
    expect(contentLearningInsights(dataset).map((insight) => insight.id)).toContain(
      'insight:platform',
    );
  });

  it('reports conversions only when some were recorded', () => {
    const zeroed: SovereignDataset = {
      ...dataset,
      contentMetrics: dataset.contentMetrics.map((metric) => ({ ...metric, conversions: 0 })),
    };

    expect(contentLearningInsights(zeroed).map((insight) => insight.id)).not.toContain(
      'insight:conversion',
    );

    const conversion = contentLearningInsights(dataset).find(
      (insight) => insight.id === 'insight:conversion',
    );
    expect(conversion?.headline).toContain('conversions');
  });
});

describe('monthlyOptimisation', () => {
  it('splits the readings into the last thirty days and the thirty before them', () => {
    const optimisation = monthlyOptimisation(dataset, now);

    // Seeded captures: -3, -5, -11, -18 days in window; -33 and -39 in the previous one.
    // A window sums every reading it contains, unlike itemPerformance which
    // keeps the latest per platform, because it is measuring the period.
    expect(optimisation.current.items).toBe(3);
    expect(optimisation.previous.items).toBe(1);
    expect(optimisation.current.impressions).toBe(4820 + 6140 + 1240 + 910);
    expect(optimisation.previous.impressions).toBe(2210 + 2680);
  });

  it('states the deltas as numbers derived from those two windows', () => {
    const optimisation = monthlyOptimisation(dataset, now);
    const current = optimisation.current.engagementRate ?? 0;
    const previous = optimisation.previous.engagementRate ?? 0;

    expect(optimisation.engagementRateDelta).toBeCloseTo((current - previous) * 100, 6);
    expect(optimisation.impressionDeltaPercent).toBeCloseTo(
      ((optimisation.current.impressions - optimisation.previous.impressions) /
        optimisation.previous.impressions) *
        100,
      6,
    );
  });

  it('refuses a delta rather than dividing by an empty window', () => {
    const optimisation = monthlyOptimisation(
      { ...dataset, contentMetrics: [] },
      new Date(now.getTime() + 400 * DAY_MS),
    );

    expect(optimisation.current.engagementRate).toBeNull();
    expect(optimisation.engagementRateDelta).toBeNull();
    expect(optimisation.impressionDeltaPercent).toBeNull();
  });
});
