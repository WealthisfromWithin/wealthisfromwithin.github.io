import { describe, expect, it } from 'vitest';
import { emptyDataset } from '@/data/dataset';
import { buildDemoDataset } from '@/data/seed';
import {
  defaultMemoryQuery,
  isRetired,
  memoriesNeedingReview,
  memoryCounts,
  memoryLinks,
  needsReview,
  parseMemoryQuery,
  selectMemoryEntries,
  workingMemory,
} from './memory';

const now = new Date('2026-08-05T07:30:00.000Z');
const dataset = buildDemoDataset(now);

function query(search: string) {
  return parseMemoryQuery(new URLSearchParams(search));
}

describe('memory query', () => {
  it('defaults to the working set of any kind', () => {
    expect(query('')).toEqual(defaultMemoryQuery);
  });

  it('refuses a state or kind it does not serve', () => {
    expect(query('state=review&kind=constraint')).toEqual({
      state: 'review',
      kind: 'constraint',
    });
    expect(query('state=forgotten&kind=vibe')).toEqual(defaultMemoryQuery);
  });
});

describe('selectMemoryEntries', () => {
  it('keeps retired memories out of the working set and shows them under their own filter', () => {
    const working = selectMemoryEntries(dataset, { state: 'working', kind: 'all' }, now);
    expect(working.some(isRetired)).toBe(false);

    const retired = selectMemoryEntries(dataset, { state: 'retired', kind: 'all' }, now);
    expect(retired.map((entry) => entry.id)).toContain('mem-retired-intro-rate');
  });

  it('leads with pinned entries, then the ones past their review date', () => {
    const rows = selectMemoryEntries(dataset, { state: 'all', kind: 'all' }, now);
    const pinned = rows.filter((entry) => entry.pinned);

    expect(pinned.length).toBeGreaterThan(0);
    expect(rows.slice(0, pinned.length).every((entry) => entry.pinned)).toBe(true);
  });

  it('lists only entries past their review date under the review filter', () => {
    const rows = selectMemoryEntries(dataset, { state: 'review', kind: 'all' }, now);

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((entry) => needsReview(entry, now))).toBe(true);
    expect(rows.map((entry) => entry.id)).toContain('mem-kestrel-lesson');
  });

  it('never asks for a review of a retired memory', () => {
    const retired = dataset.memoryEntries.find((entry) => isRetired(entry));
    expect(retired).toBeDefined();
    if (!retired) return;

    expect(needsReview({ ...retired, reviewAt: now.toISOString() }, now)).toBe(false);
  });

  it('holds nothing for an empty store', () => {
    expect(selectMemoryEntries(emptyDataset, defaultMemoryQuery, now)).toHaveLength(0);
    expect(memoriesNeedingReview(emptyDataset, now)).toHaveLength(0);
  });
});

describe('memoryCounts', () => {
  it('splits the store into working and retired without double counting', () => {
    const counts = memoryCounts(dataset, now);

    expect(counts.working + counts.retired).toBe(counts.total);
    expect(counts.total).toBe(dataset.memoryEntries.length);
    expect(counts.review).toBe(memoriesNeedingReview(dataset, now).length);
  });
});

describe('workingMemory', () => {
  it('offers the pinned entries and the constraints, and nothing retired', () => {
    const rows = workingMemory(dataset);

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((entry) => !isRetired(entry))).toBe(true);
    expect(rows.every((entry) => entry.pinned || entry.kind === 'constraint')).toBe(true);
    expect(rows[0]?.kind).toBe('constraint');
  });
});

describe('memoryLinks', () => {
  it('joins a memory to the person, company, and decision it came from', () => {
    const entry = dataset.memoryEntries.find((row) => row.id === 'mem-dana-forwards');
    expect(entry).toBeDefined();
    if (!entry) return;

    const links = memoryLinks(dataset, entry);
    expect(links.person?.id).toBe('p-aldridge');
    expect(links.company?.id).toBe('co-truoak');
    expect(links.knowledgeNode?.id).toBe('kn-truoak-decision-style');
    expect(links.decision).toBeUndefined();
  });
});
