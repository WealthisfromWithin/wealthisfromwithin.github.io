import { describe, expect, it } from 'vitest';
import { emptyDataset } from '@/data/dataset';
import { buildDemoDataset } from '@/data/seed';
import { canTransitionDecision } from '@/domain';
import {
  decisionCounts,
  decisionLinks,
  decisionsAwaitingCall,
  findDecision,
  isDueForReview,
  isOverdue,
  parseDecisionFilter,
  recentDecisions,
  selectDecisions,
} from './decisions';

const now = new Date('2026-08-05T07:30:00.000Z');
const dataset = buildDemoDataset(now);

describe('decision filter', () => {
  it('defaults to the open log rather than the whole history', () => {
    expect(parseDecisionFilter(null)).toBe('open');
    expect(parseDecisionFilter('nonsense')).toBe('open');
    expect(parseDecisionFilter('withdrawn')).toBe('withdrawn');
  });
});

describe('selectDecisions', () => {
  it('puts the calls nobody has made first, oldest deadline leading', () => {
    const rows = selectDecisions(dataset);
    const proposed = rows.filter((decision) => decision.status === 'proposed');

    expect(proposed.length).toBeGreaterThan(0);
    expect(rows.slice(0, proposed.length).every((row) => row.status === 'proposed')).toBe(true);
    expect(proposed[0]?.id).toBe('dec-drop-enrichment');
  });

  it('keeps superseded and withdrawn history out of the open view', () => {
    const open = selectDecisions(dataset, 'open').map((decision) => decision.id);
    expect(open).not.toContain('dec-weekly-cadence');
    expect(selectDecisions(dataset, 'all').map((decision) => decision.id)).toContain(
      'dec-weekly-cadence',
    );
  });

  it('lists the decided calls newest first', () => {
    const decided = selectDecisions(dataset, 'decided');
    expect(decided[0]?.id).toBe('dec-manual-publishing');
  });

  it('holds nothing for an empty store', () => {
    expect(selectDecisions(emptyDataset)).toHaveLength(0);
    expect(decisionsAwaitingCall(emptyDataset)).toHaveLength(0);
  });
});

describe('overdue and review dates', () => {
  it('calls a proposed decision overdue only once its date has passed', () => {
    const overdue = findDecision(dataset, 'dec-drop-enrichment');
    const upcoming = findDecision(dataset, 'dec-editor-hire');

    expect(overdue && isOverdue(overdue, now)).toBe(true);
    expect(upcoming && isOverdue(upcoming, now)).toBe(false);
  });

  it('never calls a decided call overdue, whatever date it carries', () => {
    const decided = findDecision(dataset, 'dec-no-discount');
    expect(decided).toBeDefined();
    if (!decided) return;

    expect(isOverdue({ ...decided, dueAt: new Date(0).toISOString() }, now)).toBe(false);
    expect(isDueForReview(decided, now)).toBe(false);
    expect(isDueForReview({ ...decided, reviewAt: new Date(0).toISOString() }, now)).toBe(true);
  });
});

describe('decisionCounts', () => {
  it('counts the open log, the overdue calls, and the one-way doors', () => {
    const counts = decisionCounts(dataset, now);

    expect(counts.total).toBe(dataset.decisions.length);
    expect(counts.proposed + counts.decided).toBe(counts.open);
    expect(counts.overdue).toBe(1);
    expect(counts.irreversible).toBe(1);
  });
});

describe('decisionLinks', () => {
  it('reads a supersession from both ends', () => {
    const replaced = findDecision(dataset, 'dec-weekly-cadence');
    const replacement = findDecision(dataset, 'dec-manual-publishing');
    expect(replaced && replacement).toBeTruthy();
    if (!replaced || !replacement) return;

    expect(decisionLinks(dataset, replaced).supersededBy?.id).toBe('dec-manual-publishing');
    expect(decisionLinks(dataset, replacement).supersedes.map((row) => row.id)).toEqual([
      'dec-weekly-cadence',
    ]);
  });

  it('lists the memories a decision produced', () => {
    const decision = findDecision(dataset, 'dec-no-discount');
    expect(decision).toBeDefined();
    if (!decision) return;

    expect(decisionLinks(dataset, decision).memories.map((entry) => entry.id)).toContain(
      'mem-no-discounts',
    );
  });
});

describe('recentDecisions', () => {
  it('reports only the calls that were actually made, newest first', () => {
    const rows = recentDecisions(dataset, 2);

    expect(rows).toHaveLength(2);
    expect(rows.every((decision) => decision.status === 'decided')).toBe(true);
  });
});

describe('the transition table', () => {
  it('lets an open call be made or withdrawn, and a made call be replaced or reopened', () => {
    expect(canTransitionDecision('proposed', 'decided')).toBe(true);
    expect(canTransitionDecision('proposed', 'withdrawn')).toBe(true);
    expect(canTransitionDecision('decided', 'superseded')).toBe(true);
    expect(canTransitionDecision('decided', 'proposed')).toBe(true);
  });

  it('keeps closed history closed', () => {
    expect(canTransitionDecision('superseded', 'decided')).toBe(false);
    expect(canTransitionDecision('withdrawn', 'proposed')).toBe(false);
    expect(canTransitionDecision('proposed', 'superseded')).toBe(false);
  });
});
