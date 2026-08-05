import { describe, expect, it } from 'vitest';
import type { SovereignDataset } from '@/data/dataset';
import { buildDemoDataset } from '@/data/seed';
import { isSafeInternalHref } from '@/app/href';
import { DAY_MS } from '@/lib/clock';
import {
  activityByDay,
  activityChannelLabel,
  analyticsCaveats,
  ANALYTICS_WINDOWS,
  analyticsWindowLabel,
  approvalLatencyHours,
  channelMix,
  hoursBetween,
  loopReadings,
  parseAnalyticsWindow,
  provenanceSplit,
  throughputRows,
  windowDays,
  windowStart,
} from './analytics';

const NOW = new Date('2026-08-05T09:00:00.000Z');
const dataset: SovereignDataset = buildDemoDataset(NOW);

describe('analytics window', () => {
  it('defaults to thirty days and refuses anything it does not offer', () => {
    expect(parseAnalyticsWindow(null)).toBe('30d');
    expect(parseAnalyticsWindow('all-time')).toBe('30d');
    expect(parseAnalyticsWindow('7d')).toBe('7d');
    expect(parseAnalyticsWindow('all')).toBe('all');
  });

  it('labels every window and gives the all-time window no start', () => {
    for (const window of ANALYTICS_WINDOWS) {
      expect(analyticsWindowLabel[window].length).toBeGreaterThan(0);
    }
    expect(windowDays('all')).toBeNull();
    expect(windowStart('all', NOW)).toBeNull();
    expect(windowStart('7d', NOW)?.getTime()).toBeLessThan(NOW.getTime());
  });

  it('counts the current day as one of the window days', () => {
    const start = windowStart('7d', NOW);
    expect(start).not.toBeNull();
    // Six whole days back plus today, not seven days back.
    expect(NOW.getTime() - (start?.getTime() ?? 0)).toBeLessThan(7 * DAY_MS);
  });
});

describe('activity', () => {
  it('returns one bucket per day, oldest first, even for silent days', () => {
    const days = activityByDay(dataset, NOW, 14);
    expect(days).toHaveLength(14);
    expect(days.every((day) => day.label.length > 0)).toBe(true);
    expect([...days].sort((a, b) => a.key.localeCompare(b.key)).map((day) => day.key)).toEqual(
      days.map((day) => day.key),
    );
  });

  it('drops events outside the charted days rather than folding them into the edges', () => {
    const charted = activityByDay(dataset, NOW, 3).reduce((total, day) => total + day.count, 0);
    expect(charted).toBeLessThan(dataset.events.length);
    expect(activityByDay({ ...dataset, events: [] }, NOW).every((day) => day.count === 0)).toBe(true);
  });

  it('splits the window by channel and shares add up to roughly a hundred', () => {
    const mix = channelMix(dataset, 'all', NOW);
    expect(mix.length).toBeGreaterThan(1);
    expect(mix.every((row) => row.label === activityChannelLabel[row.channel])).toBe(true);
    // Sorted by volume, so the first row is the loudest channel.
    expect(mix[0]?.count).toBeGreaterThanOrEqual(mix[1]?.count ?? 0);
    const shares = mix.reduce((total, row) => total + row.share, 0);
    expect(Math.abs(shares - 100)).toBeLessThanOrEqual(mix.length);
  });

  it('reads an empty window as empty rather than as a zero share', () => {
    expect(channelMix({ ...dataset, events: [] }, 'all', NOW)).toEqual([]);
  });

  it('ignores an event stamped in the future', () => {
    const ahead: SovereignDataset = {
      ...dataset,
      events: [
        {
          ...(dataset.events[0] as SovereignDataset['events'][number]),
          id: 'evt-future',
          at: new Date(NOW.getTime() + 5 * DAY_MS).toISOString(),
        },
      ],
    };
    expect(channelMix(ahead, '30d', NOW)).toEqual([]);
  });
});

describe('throughput', () => {
  it('reports rows, provenance, and a safe href for every surface it counts', () => {
    const rows = throughputRows(dataset, 'all', NOW);
    expect(rows.length).toBeGreaterThan(6);
    for (const row of rows) {
      expect(isSafeInternalHref(row.href)).toBe(true);
      expect(row.demo + row.operator).toBe(row.rows);
      expect(row.created).toBeLessThanOrEqual(row.rows);
      expect(row.touched).toBeLessThanOrEqual(row.rows);
    }
  });

  it('narrows created counts as the window narrows, and never the row count', () => {
    const all = throughputRows(dataset, 'all', NOW);
    const week = throughputRows(dataset, '7d', NOW);
    const total = (rows: readonly { created: number }[]) =>
      rows.reduce((sum, row) => sum + row.created, 0);

    expect(total(week)).toBeLessThanOrEqual(total(all));
    expect(week.map((row) => row.id).sort()).toEqual(all.map((row) => row.id).sort());
    for (const row of week) {
      expect(row.rows).toBe(all.find((other) => other.id === row.id)?.rows);
    }
  });

  it('leads with the surface that moved most in the window', () => {
    const rows = throughputRows(dataset, 'all', NOW);
    const activity = (row: { created: number; touched: number }) => row.created + row.touched;
    expect(activity(rows[0] as { created: number; touched: number })).toBeGreaterThanOrEqual(
      activity(rows[rows.length - 1] as { created: number; touched: number }),
    );
  });
});

describe('loop readings', () => {
  it('gives every reading a basis sentence and a sample size', () => {
    const readings = loopReadings(dataset, 'all', NOW);
    expect(readings.length).toBeGreaterThanOrEqual(6);
    for (const reading of readings) {
      expect(reading.basis.length).toBeGreaterThan(20);
      expect(reading.sample).toBeGreaterThanOrEqual(0);
      if (reading.href !== undefined) expect(isSafeInternalHref(reading.href)).toBe(true);
    }
  });

  it('says a median cannot be taken instead of printing zero', () => {
    const undecided: SovereignDataset = {
      ...dataset,
      approvals: dataset.approvals.map((approval) => ({
        ...approval,
        status: 'pending' as const,
        decidedAt: undefined,
      })),
    };
    expect(approvalLatencyHours(undecided, 'all', NOW)).toBeNull();
    const reading = loopReadings(undecided, 'all', NOW).find((row) => row.id === 'approval-latency');
    expect(reading?.value).toBe('—');
    expect(reading?.basis).toContain('nothing to take a median of');
  });

  it('takes a median rather than a mean, so one slow gate does not set the reading', () => {
    expect(hoursBetween(undefined, NOW.toISOString())).toBeNull();
    expect(hoursBetween('not-a-date', NOW.toISOString())).toBeNull();
    expect(hoursBetween('2026-08-05T00:00:00.000Z', '2026-08-05T06:00:00.000Z')).toBe(6);

    const at = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();
    const gates: SovereignDataset = {
      ...dataset,
      approvals: [1, 2, 300].map((hours, index) => ({
        ...(dataset.approvals[0] as SovereignDataset['approvals'][number]),
        id: `apr-latency-${String(index)}`,
        status: 'approved' as const,
        createdAt: at(hours + 1),
        decidedAt: at(1),
      })),
    };
    expect(approvalLatencyHours(gates, 'all', NOW)).toBe(2);
  });

  it('counts refused AI turns as an outcome rather than as an error', () => {
    const reading = loopReadings(dataset, 'all', NOW).find((row) => row.id === 'kernel-refusals');
    expect(reading?.basis).toContain('refusal is the expected outcome');
    expect(reading?.value).toMatch(/^\d+ of \d+$/);
  });

  it('reports automation runs against the whole log, not just the ones that worked', () => {
    const reading = loopReadings(dataset, 'all', NOW).find((row) => row.id === 'automation-runs');
    const applied = dataset.automationRuns.filter((run) => run.outcome === 'applied').length;
    expect(reading?.value).toBe(`${String(applied)} of ${String(dataset.automationRuns.length)}`);
    expect(reading?.sample).toBe(dataset.automationRuns.length);
  });
});

describe('provenance', () => {
  it('splits the whole store into demo and operator rows', () => {
    const split = provenanceSplit(dataset);
    expect(split.total).toBeGreaterThan(100);
    expect(split.demo + split.operator).toBe(split.total);
    expect(split.demoShare).toBeGreaterThan(0);
    expect(split.touched).toBeLessThanOrEqual(split.total);
  });

  it('reads a cleared store as empty rather than as a hundred percent operator', () => {
    const cleared = Object.fromEntries(
      Object.keys(dataset).map((key) => [key, []]),
    ) as unknown as SovereignDataset;
    const empty = provenanceSplit(cleared);
    expect(empty).toMatchObject({ total: 0, demo: 0, operator: 0, demoShare: 0 });
  });

  it('states its own blind spots, including the demo share', () => {
    const caveats = analyticsCaveats(dataset);
    expect(caveats.length).toBeGreaterThanOrEqual(3);
    expect(caveats[0]).toContain('Nothing observes the operator');
    expect(caveats.some((line) => line.includes('demo data'))).toBe(true);
    expect(caveats.some((line) => line.includes('No platform API'))).toBe(true);
  });

  it('drops the demo caveat once the demo rows are gone', () => {
    const operatorOnly = Object.fromEntries(
      Object.entries(dataset).map(([key, rows]) => [
        key,
        (rows as { source: string }[]).map((row) => ({ ...row, source: 'local' })),
      ]),
    ) as unknown as SovereignDataset;
    expect(analyticsCaveats(operatorOnly).some((line) => line.includes('demo data'))).toBe(false);
  });
});
