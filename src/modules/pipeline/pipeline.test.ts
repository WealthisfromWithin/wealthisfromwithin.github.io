import { describe, expect, it } from 'vitest';
import { emptyDataset, type SovereignDataset } from '@/data/dataset';
import { buildDemoDataset } from '@/data/seed';
import { DAY_MS } from '@/lib/clock';
import {
  CLOSED_STAGES,
  OPEN_STAGES,
  PIPELINE_STAGES,
  STALL_DAYS,
  daysInStage,
  expectedValueCents,
  isOpenStage,
  isStalled,
  leadIntelligence,
  nextOpenStage,
  parseStageFilter,
  pipelineSummary,
  selectOpportunities,
  stageBoard,
} from './pipeline';

const now = new Date('2026-08-05T07:30:00.000Z');
const dataset = buildDemoDataset(now);

function withOpportunity(patch: Partial<SovereignDataset['opportunities'][number]>): SovereignDataset {
  return {
    ...dataset,
    opportunities: dataset.opportunities.map((opportunity) =>
      opportunity.id === 'opp-truoak' ? { ...opportunity, ...patch } : opportunity,
    ),
  };
}

describe('pipeline stages', () => {
  it('keeps one ordered funnel with exactly two closed states', () => {
    expect(PIPELINE_STAGES).toEqual([
      'identified',
      'contacted',
      'engaged',
      'qualified',
      'proposal',
      'negotiation',
      'won',
      'lost',
    ]);
    expect(CLOSED_STAGES).toEqual(['won', 'lost']);
    expect(OPEN_STAGES).not.toContain('won');
    expect(OPEN_STAGES).not.toContain('lost');
  });

  it('advances through the open funnel and stops at the end of it', () => {
    expect(nextOpenStage('identified')).toBe('contacted');
    expect(nextOpenStage('proposal')).toBe('negotiation');
    expect(nextOpenStage('negotiation')).toBeNull();
    expect(nextOpenStage('won')).toBeNull();
  });

  it('treats every stage but won and lost as open', () => {
    for (const stage of OPEN_STAGES) expect(isOpenStage(stage)).toBe(true);
    expect(isOpenStage('won')).toBe(false);
    expect(isOpenStage('lost')).toBe(false);
  });

  it('falls back to the open filter for a value it does not serve', () => {
    expect(parseStageFilter(null)).toBe('open');
    expect(parseStageFilter('everything')).toBe('open');
    expect(parseStageFilter('negotiation')).toBe('negotiation');
  });
});

describe('expectedValueCents', () => {
  it('multiplies the value by the probability on the record', () => {
    expect(expectedValueCents({ ...dataset.opportunities[0]!, valueCents: 1000, probability: 50 })).toBe(
      500,
    );
  });

  it('is zero for a lost deal and full value for a won one', () => {
    expect(
      expectedValueCents({ ...dataset.opportunities[0]!, valueCents: 1000, probability: 0 }),
    ).toBe(0);
    expect(
      expectedValueCents({ ...dataset.opportunities[0]!, valueCents: 1000, probability: 100 }),
    ).toBe(1000);
  });
});

describe('stall detection', () => {
  it('counts days since the last stage change', () => {
    const stale = withOpportunity({
      stageChangedAt: new Date(now.getTime() - 20 * DAY_MS).toISOString(),
    });
    const opportunity = stale.opportunities.find((row) => row.id === 'opp-truoak')!;
    expect(daysInStage(opportunity, now)).toBe(20);
    expect(isStalled(opportunity, now)).toBe(true);
  });

  it('does not fire one day short of the threshold', () => {
    const fresh = withOpportunity({
      stageChangedAt: new Date(now.getTime() - (STALL_DAYS - 1) * DAY_MS).toISOString(),
    });
    expect(isStalled(fresh.opportunities.find((row) => row.id === 'opp-truoak')!, now)).toBe(false);
  });

  it('never calls a closed deal stalled', () => {
    const closed = withOpportunity({
      stage: 'won',
      stageChangedAt: new Date(now.getTime() - 90 * DAY_MS).toISOString(),
    });
    expect(isStalled(closed.opportunities.find((row) => row.id === 'opp-truoak')!, now)).toBe(false);
  });

  it('falls back to updatedAt when no stage change was recorded', () => {
    const noStamp = withOpportunity({ stageChangedAt: undefined });
    expect(daysInStage(noStamp.opportunities.find((row) => row.id === 'opp-truoak')!, now)).toBe(0);
  });
});

describe('selectOpportunities', () => {
  it('opens on the open funnel, highest expected value first', () => {
    const rows = selectOpportunities(dataset, 'open');
    expect(rows[0]?.id).toBe('opp-truoak');
    expect(rows.every((row) => isOpenStage(row.stage))).toBe(true);
  });

  it('includes closed deals only under all or their own stage', () => {
    expect(selectOpportunities(dataset, 'all').map((row) => row.id)).toContain('opp-ridgeline');
    expect(selectOpportunities(dataset, 'won').map((row) => row.id)).toEqual(['opp-ridgeline']);
    expect(selectOpportunities(dataset, 'lost').map((row) => row.id)).toEqual(['opp-castlepoint']);
  });
});

describe('pipelineSummary', () => {
  it('separates open value from expected value and closed history', () => {
    const summary = pipelineSummary(dataset, now);
    const open = dataset.opportunities.filter((row) => isOpenStage(row.stage));

    expect(summary.openCount).toBe(open.length);
    expect(summary.openValueCents).toBe(
      open.reduce((total, row) => total + row.valueCents, 0),
    );
    expect(summary.expectedValueCents).toBeLessThan(summary.openValueCents);
    expect(summary.wonCount).toBe(1);
    expect(summary.lostCount).toBe(1);
    expect(summary.stalledCount).toBeGreaterThan(0);
  });

  it('reports a stage for every stage, including the empty ones', () => {
    const summary = pipelineSummary(dataset, now);
    expect(summary.byStage.map((stage) => stage.stage)).toEqual([...PIPELINE_STAGES]);
    expect(summary.byStage.find((stage) => stage.stage === 'identified')?.count).toBe(0);
  });

  it('is all zeroes on an empty store', () => {
    const summary = pipelineSummary(emptyDataset, now);
    expect(summary.openCount).toBe(0);
    expect(summary.openValueCents).toBe(0);
    expect(summary.expectedValueCents).toBe(0);
  });
});

describe('stageBoard', () => {
  it('shows the open stages only', () => {
    expect(stageBoard(dataset).map((column) => column.stage)).toEqual([...OPEN_STAGES]);
  });

  it('accounts for every open opportunity exactly once', () => {
    const total = stageBoard(dataset).reduce((sum, column) => sum + column.count, 0);
    expect(total).toBe(dataset.opportunities.filter((row) => isOpenStage(row.stage)).length);
  });
});

describe('leadIntelligence', () => {
  it('reads the deal, its contact, and its local joins', () => {
    const lead = leadIntelligence(dataset, 'opp-truoak', now);
    expect(lead?.companyName).toBe('TruOak Capital');
    expect(lead?.contactName).toBe('Dana Aldridge');
    expect(lead?.tasks.map((task) => task.id)).toContain('t-brief-truoak');
    expect(lead?.meetings.map((meeting) => meeting.id)).toContain('mtg-truoak-renewal');
    expect(lead?.expectedValueCents).toBe(3_456_000);
  });

  it('calls out a missing next step as the reason nothing will move', () => {
    const noNextStep = withOpportunity({ nextStep: '', nextStepAt: undefined });
    const lead = leadIntelligence(noNextStep, 'opp-truoak', now);
    const signal = lead?.signals.find((row) => row.id === 'next-step-missing');
    expect(signal?.tone).toBe('critical');
  });

  it('flags a stalled deal as its own signal', () => {
    const stale = withOpportunity({
      stageChangedAt: new Date(now.getTime() - 30 * DAY_MS).toISOString(),
    });
    const lead = leadIntelligence(stale, 'opp-truoak', now);
    expect(lead?.stalled).toBe(true);
    expect(lead?.signals.some((signal) => signal.id === 'stalled')).toBe(true);
  });

  it('says when a lead has no named contact instead of inventing one', () => {
    const anonymous = withOpportunity({ personId: undefined });
    const lead = leadIntelligence(anonymous, 'opp-truoak', now);
    expect(lead?.contactName).toBeUndefined();
    expect(lead?.signals.some((signal) => signal.id === 'contact-missing')).toBe(true);
  });

  it('says when nothing was recorded about how the lead arrived', () => {
    const unsourced = withOpportunity({ leadSource: '' });
    const signal = leadIntelligence(unsourced, 'opp-truoak', now)?.signals.find(
      (row) => row.id === 'lead-source',
    );
    expect(signal?.label).toBe('Source unrecorded');
    expect(signal?.tone).toBe('warning');
  });

  it('returns null for an unknown opportunity', () => {
    expect(leadIntelligence(dataset, 'opp-nobody', now)).toBeNull();
  });
});
