import { describe, expect, it } from 'vitest';
import { emptyDataset } from '@/data/dataset';
import { buildDemoDataset } from '@/data/seed';
import {
  findResearchItem,
  isDueToday,
  isOpen,
  isOverdue,
  parseResearchFilter,
  researchCounts,
  researchDue,
  researchLinks,
  selectResearchItems,
} from './research';

const now = new Date('2026-08-05T07:30:00.000Z');
const dataset = buildDemoDataset(now);

describe('research filter', () => {
  it('defaults to the open questions', () => {
    expect(parseResearchFilter(null)).toBe('open');
    expect(parseResearchFilter('answered')).toBe('answered');
    expect(parseResearchFilter('solved')).toBe('open');
  });
});

describe('selectResearchItems', () => {
  it('shows only questions with no answer under the open filter', () => {
    const rows = selectResearchItems(dataset);

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every(isOpen)).toBe(true);
  });

  it('puts work in progress before the queue, then sorts by date', () => {
    const rows = selectResearchItems(dataset);

    expect(rows[0]?.status).toBe('active');
    const queued = rows.filter((item) => item.status === 'queued');
    expect(queued[0]?.id).toBe('res-compliance-language');
  });

  it('sorts undated questions last, because undated is unscheduled rather than urgent', () => {
    const rows = selectResearchItems(dataset, 'all');
    const undated = rows.filter((item) => item.status === 'queued' && item.dueAt === undefined);

    for (const item of undated) {
      const dated = rows.filter(
        (row) => row.status === 'queued' && row.dueAt !== undefined,
      );
      for (const other of dated) {
        expect(rows.indexOf(item)).toBeGreaterThan(rows.indexOf(other));
      }
    }
  });

  it('holds nothing for an empty store', () => {
    expect(selectResearchItems(emptyDataset)).toHaveLength(0);
    expect(researchDue(emptyDataset, now)).toHaveLength(0);
  });
});

describe('dates', () => {
  it('calls an open question overdue only once its date has passed', () => {
    const overdue = findResearchItem(dataset, 'res-compliance-language');
    expect(overdue && isOverdue(overdue, now)).toBe(true);
    expect(overdue && isDueToday(overdue, now)).toBe(false);
  });

  it('never calls an answered or parked question due', () => {
    const answered = findResearchItem(dataset, 'res-linkedin-format');
    expect(answered).toBeDefined();
    if (!answered) return;

    const stamped = { ...answered, dueAt: new Date(0).toISOString() };
    expect(isOverdue(stamped, now)).toBe(false);
    expect(isDueToday(stamped, now)).toBe(false);
  });

  it('lists what is due or past due, most overdue first', () => {
    const due = researchDue(dataset, now);

    expect(due.map((item) => item.id)).toContain('res-compliance-language');
    expect(due.every((item) => isOverdue(item, now) || isDueToday(item, now))).toBe(true);
  });
});

describe('researchCounts', () => {
  it('counts open questions, dates, and every finding recorded by hand', () => {
    const counts = researchCounts(dataset, now);

    expect(counts.total).toBe(dataset.researchItems.length);
    expect(counts.open).toBe(counts.queued + counts.active);
    expect(counts.overdue).toBe(1);
    expect(counts.findings).toBe(
      dataset.researchItems.reduce((total, item) => total + item.findings.length, 0),
    );
  });
});

describe('researchLinks', () => {
  it('joins a question to the record that raised it', () => {
    const item = findResearchItem(dataset, 'res-retainer-benchmarks');
    expect(item).toBeDefined();
    if (!item) return;

    const links = researchLinks(dataset, item);
    expect(links.knowledgeNode?.id).toBe('kn-open-question-retainer-floor');
    expect(links.opportunity).toBeUndefined();
  });

  it('finds nothing for an id the store does not hold', () => {
    expect(findResearchItem(dataset, 'res-nope')).toBeUndefined();
    expect(findResearchItem(dataset, undefined)).toBeUndefined();
  });
});
