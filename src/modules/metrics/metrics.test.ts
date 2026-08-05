import { describe, expect, it } from 'vitest';
import { isSafeInternalHref } from '@/app/href';
import type { SovereignDataset } from '@/data/dataset';
import { buildDemoDataset } from '@/data/seed';
import {
  kpiGroups,
  METRIC_BLIND_SPOTS,
  METRIC_WINDOWS,
  metricWindowLabel,
  metricWindowStart,
  parseMetricWindow,
} from './metrics';

const NOW = new Date('2026-08-05T09:00:00.000Z');
const dataset: SovereignDataset = buildDemoDataset(NOW);

function groupOf(id: string, window: Parameters<typeof kpiGroups>[1] = 'all') {
  const group = kpiGroups(dataset, window, NOW).find((row) => row.id === id);
  if (group === undefined) throw new Error(`no ${id} group`);
  return group;
}

function kpiOf(groupId: string, kpiId: string, window: Parameters<typeof kpiGroups>[1] = 'all') {
  const kpi = groupOf(groupId, window).kpis.find((row) => row.id === kpiId);
  if (kpi === undefined) throw new Error(`no ${kpiId} kpi`);
  return kpi;
}

describe('metric window', () => {
  it('defaults to ninety days and ignores a window it does not offer', () => {
    expect(parseMetricWindow(null)).toBe('90d');
    expect(parseMetricWindow('7d')).toBe('90d');
    expect(parseMetricWindow('365d')).toBe('365d');
    expect(parseMetricWindow('all')).toBe('all');
  });

  it('labels every window and leaves the all-time window unbounded', () => {
    for (const window of METRIC_WINDOWS) {
      expect(metricWindowLabel[window].length).toBeGreaterThan(0);
    }
    expect(metricWindowStart('all', NOW)).toBeNull();
    expect(metricWindowStart('30d', NOW)?.getTime()).toBeLessThan(NOW.getTime());
  });
});

describe('kpi shape', () => {
  it('carries a basis sentence, a sample size, and a safe href on every reading', () => {
    for (const group of kpiGroups(dataset, 'all', NOW)) {
      expect(group.title.length).toBeGreaterThan(0);
      expect(group.note.length).toBeGreaterThan(0);
      expect(group.kpis.length).toBeGreaterThan(0);
      for (const kpi of group.kpis) {
        expect(kpi.basis.length).toBeGreaterThan(15);
        expect(kpi.value.length).toBeGreaterThan(0);
        expect(kpi.sample).toBeGreaterThanOrEqual(0);
        if (kpi.href !== undefined) expect(isSafeInternalHref(kpi.href)).toBe(true);
      }
    }
  });

  it('gives every reading a unique id across the whole page', () => {
    const ids = kpiGroups(dataset, 'all', NOW).flatMap((group) =>
      group.kpis.map((kpi) => kpi.id),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('flags demo provenance where demo rows fed the number', () => {
    expect(kpiOf('revenue', 'open-value').demo).toBe(true);
    expect(groupOf('declared').kpis.every((kpi) => kpi.demo)).toBe(true);
  });
});

describe('revenue', () => {
  it('sums won deals at their recorded value and says how many there were', () => {
    const won = dataset.opportunities.filter((row) => row.stage === 'won');
    const kpi = kpiOf('revenue', 'won-value');
    expect(kpi.sample).toBe(won.length);
    expect(kpi.basis).toContain('summed at the value on each record');
  });

  it('weights expected value below face value, because probability is under one', () => {
    const face = kpiOf('revenue', 'open-value').value;
    const weighted = kpiOf('revenue', 'expected-value').value;
    const cents = (value: string) => Number(value.replace(/[^0-9.]/g, ''));
    expect(cents(weighted)).toBeLessThan(cents(face));
  });

  it('refuses a win rate when nothing closed in the window', () => {
    const open: SovereignDataset = {
      ...dataset,
      opportunities: dataset.opportunities.map((row) => ({ ...row, stage: 'proposal' as const })),
    };
    const kpi = kpiGroups(open, 'all', NOW)
      .find((group) => group.id === 'revenue')
      ?.kpis.find((row) => row.id === 'win-rate');
    expect(kpi?.value).toBe('—');
    expect(kpi?.basis).toContain('no rate to report');
    expect(kpi?.tone).toBe('muted');
  });

  it('counts a win rate from the deals closed in the window only', () => {
    const kpi = kpiOf('revenue', 'win-rate');
    const closed = dataset.opportunities.filter(
      (row) => row.stage === 'won' || row.stage === 'lost',
    );
    const won = closed.filter((row) => row.stage === 'won');
    expect(kpi.sample).toBe(closed.length);
    expect(kpi.value).toBe(`${String(Math.round((won.length / closed.length) * 100))}%`);
  });

  it('narrows the closed-won figure when the window narrows', () => {
    const all = kpiOf('revenue', 'won-value', 'all').sample;
    const month = kpiOf('revenue', 'won-value', '30d').sample;
    expect(month).toBeLessThanOrEqual(all);
  });

  it('names the value sitting in deals nothing has moved', () => {
    const kpi = kpiOf('revenue', 'stalled-value');
    expect(kpi.basis).toContain('no stage movement');
    expect(kpi.sample).toBeGreaterThan(0);
    expect(kpi.tone).toBe('warning');
  });
});

describe('delivery and content', () => {
  it('says which blocked tasks carry no reason', () => {
    const kpi = kpiOf('delivery', 'blocked-work');
    expect(Number(kpi.value)).toBe(dataset.tasks.filter((task) => task.status === 'blocked').length);
    expect(kpi.basis).toContain('carry no reason');
  });

  it('refuses a cycle time when no task carries both dates', () => {
    const unfinished: SovereignDataset = {
      ...dataset,
      tasks: dataset.tasks.map((task) => ({ ...task, completedAt: undefined })),
    };
    const kpi = kpiGroups(unfinished, 'all', NOW)
      .find((group) => group.id === 'delivery')
      ?.kpis.find((row) => row.id === 'cycle-time');
    expect(kpi?.value).toBe('—');
    expect(kpi?.sample).toBe(0);
  });

  it('refuses a publishing rate over an unbounded window', () => {
    expect(kpiOf('content', 'cadence', 'all').value).toBe('—');
    expect(kpiOf('content', 'cadence', 'all').basis).toContain('no fixed length');
    expect(kpiOf('content', 'cadence', '90d').basis).toContain('weeks');
  });

  it('says publishing was never confirmed by a platform', () => {
    expect(kpiOf('content', 'published').basis).toContain('has ever confirmed a post went out');
    expect(kpiOf('content', 'conversions').basis).toContain('not attributed revenue');
  });

  it('refuses an engagement rate with no readings', () => {
    const unmeasured: SovereignDataset = { ...dataset, contentMetrics: [] };
    const kpi = kpiGroups(unmeasured, 'all', NOW)
      .find((group) => group.id === 'content')
      ?.kpis.find((row) => row.id === 'engagement-rate');
    expect(kpi?.value).toBe('—');
    expect(kpi?.basis).toContain('No performance readings');
  });

  it('excludes a content metric captured outside the selected window from engagement and conversions', () => {
    const inWindowRow = {
      ...dataset.contentMetrics[0]!,
      id: 'cm-window-in',
      capturedAt: new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      impressions: 1000,
      engagements: 100,
      conversions: 5,
    };
    const outOfWindowRow = {
      ...dataset.contentMetrics[0]!,
      id: 'cm-window-out',
      capturedAt: new Date(NOW.getTime() - 400 * 24 * 60 * 60 * 1000).toISOString(),
      impressions: 9000,
      engagements: 9000,
      conversions: 900,
    };
    const windowed: SovereignDataset = {
      ...dataset,
      contentMetrics: [inWindowRow, outOfWindowRow],
    };

    const engagementRate = kpiGroups(windowed, '30d', NOW)
      .find((group) => group.id === 'content')
      ?.kpis.find((row) => row.id === 'engagement-rate');
    const conversions = kpiGroups(windowed, '30d', NOW)
      .find((group) => group.id === 'content')
      ?.kpis.find((row) => row.id === 'conversions');

    expect(engagementRate?.sample).toBe(1);
    expect(engagementRate?.value).toBe('10%');
    expect(conversions?.sample).toBe(1);
    expect(conversions?.value).toBe('5');

    const allTime = kpiGroups(windowed, 'all', NOW)
      .find((group) => group.id === 'content')
      ?.kpis.find((row) => row.id === 'conversions');
    expect(allTime?.sample).toBe(2);
    expect(allTime?.value).toBe('905');
  });
});

describe('gates and leverage', () => {
  it('counts the open gates and says how many an automation opened', () => {
    const kpi = kpiOf('leverage', 'gates-open');
    const pending = dataset.approvals.filter((approval) => approval.status === 'pending');
    expect(Number(kpi.value)).toBe(pending.length);
    expect(kpi.basis).toContain('opened by an automation rule');
  });

  it('reports automation runs against the whole log and warns when refusals lead', () => {
    const kpi = kpiOf('leverage', 'automation-applied');
    const applied = dataset.automationRuns.filter((run) => run.outcome === 'applied');
    expect(kpi.value).toBe(
      `${String(applied.length)} of ${String(dataset.automationRuns.length)}`,
    );

    const refusing: SovereignDataset = {
      ...dataset,
      automationRuns: dataset.automationRuns.map((run) => ({
        ...run,
        outcome: 'refused' as const,
      })),
    };
    const warned = kpiGroups(refusing, 'all', NOW)
      .find((group) => group.id === 'leverage')
      ?.kpis.find((row) => row.id === 'automation-applied');
    expect(warned?.tone).toBe('warning');
  });

  it('says nothing runs on a timer when the log is empty', () => {
    const idle: SovereignDataset = { ...dataset, automationRuns: [] };
    const kpi = kpiGroups(idle, 'all', NOW)
      .find((group) => group.id === 'leverage')
      ?.kpis.find((row) => row.id === 'automation-applied');
    expect(kpi?.basis).toContain('runs on a timer');
    expect(kpi?.value).toBe('0 of 0');
  });

  it('counts reach from the matched records on the runs that applied', () => {
    const kpi = kpiOf('leverage', 'automation-reach');
    const applied = dataset.automationRuns.filter((run) => run.outcome === 'applied');
    expect(Number(kpi.value)).toBe(applied.reduce((total, run) => total + run.matched, 0));
    expect(kpi.basis).toContain('nothing left this browser');
  });
});

describe('declared metrics', () => {
  it('keeps recorded figures apart from counted ones and names them as unverified', () => {
    const declared = groupOf('declared');
    expect(declared.kpis).toHaveLength(dataset.metrics.length);
    expect(declared.note).toContain('Recorded as figures rather than counted');
    for (const kpi of declared.kpis) {
      expect(kpi.basis).toContain('Nothing in this store verifies it');
      expect(kpi.sample).toBe(1);
    }
  });

  it('leads with the figure that moved most, in either direction', () => {
    const declared = groupOf('declared');
    const first = dataset.metrics.find(
      (metric) => `declared-${metric.id}` === declared.kpis[0]?.id,
    );
    expect(Math.abs(first?.deltaPercent ?? 0)).toBe(
      Math.max(...dataset.metrics.map((metric) => Math.abs(metric.deltaPercent))),
    );
  });

  it('drops the group entirely rather than showing an empty panel', () => {
    const bare: SovereignDataset = { ...dataset, metrics: [] };
    expect(kpiGroups(bare, 'all', NOW).map((group) => group.id)).not.toContain('declared');
  });
});

describe('blind spots', () => {
  it('names the absent cost side, the absent reconciliation, and the recognition rule', () => {
    expect(METRIC_BLIND_SPOTS).toHaveLength(3);
    expect(METRIC_BLIND_SPOTS.join(' ')).toContain('profit-and-loss');
    expect(METRIC_BLIND_SPOTS.join(' ')).toContain('No accounting, payments, or banking system');
    expect(METRIC_BLIND_SPOTS.join(' ')).toContain('marked won');
  });
});
