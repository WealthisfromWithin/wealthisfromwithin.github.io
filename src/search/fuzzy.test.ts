import { describe, expect, it } from 'vitest';
import { fuzzyMatch, rankByFuzzy } from './fuzzy';
import { buildSearchIndex, searchDocuments } from './index';
import { enabledModules } from '@/app/modules';
import { buildDemoDataset } from '@/data/seed';

const now = new Date('2026-08-05T07:30:00.000Z');

describe('fuzzyMatch', () => {
  it('matches a subsequence and records indices', () => {
    const match = fuzzyMatch('mbr', 'Morning Brief');
    expect(match).not.toBeNull();
    expect(match?.indices).toEqual([0, 8, 9]);
  });

  it('returns null when a character is missing', () => {
    expect(fuzzyMatch('zzz', 'Morning Brief')).toBeNull();
  });

  it('treats an empty query as a neutral match', () => {
    expect(fuzzyMatch('  ', 'anything')).toEqual({ score: 0, indices: [] });
  });

  it('scores a prefix higher than a scattered match', () => {
    const prefix = fuzzyMatch('int', 'Integrations');
    const scattered = fuzzyMatch('int', 'Institutional retention notes');
    expect(prefix?.score).toBeGreaterThan(scattered?.score ?? 0);
  });

  it('ranks the closest label first', () => {
    const ranked = rankByFuzzy('settings', ['Settings', 'Set target', 'Mission settings log'], (v) => [v]);
    expect(ranked[0]?.item).toBe('Settings');
  });

  it('drops scattered noise below the score floor', () => {
    const scattered = 'x a x l x d x r x i x d x g x e x';
    const match = fuzzyMatch('aldridge', scattered);
    expect(match).not.toBeNull();
    expect(match?.score ?? 0).toBeLessThan(12);
    expect(rankByFuzzy('aldridge', [scattered], (value) => [value], { minScore: 12 })).toEqual([]);
    expect(rankByFuzzy('aldridge', ['Dana Aldridge'], (value) => [value], { minScore: 12 })).toHaveLength(1);
  });
});

describe('searchDocuments', () => {
  const index = buildSearchIndex(buildDemoDataset(now));

  it('returns nothing for an empty query', () => {
    expect(searchDocuments('   ', index)).toEqual([]);
  });

  it('finds a seeded person', () => {
    const results = searchDocuments('aldridge', index);
    expect(results[0]?.item.title).toBe('Dana Aldridge');
    expect(results[0]?.item.kind).toBe('person');
    expect(results[0]?.item.demo).toBe(true);
  });

  it('finds a seeded task', () => {
    const results = searchDocuments('renewal framing', index);
    expect(results.some((result) => result.item.kind === 'task')).toBe(true);
  });

  it('routes integrations at the integrations module', () => {
    const results = searchDocuments('notion', index);
    expect(results[0]?.item.route).toBe('/integrations');
    expect(results[0]?.item.demo).toBe(false);
  });

  it('finds a seeded notification and sends it to the inbox', () => {
    const results = searchDocuments('learning digest', index);
    const signal = results.find((result) => result.item.kind === 'notification');
    expect(signal?.item.route).toBe('/inbox');
    expect(signal?.item.demo).toBe(true);
  });

  it('finds a seeded approval and sends it to the queue', () => {
    const results = searchDocuments('re-engagement sequence', index);
    const approval = results.find((result) => result.item.kind === 'approval');
    expect(approval?.item.route.startsWith('/approvals')).toBe(true);
    expect(approval?.item.demo).toBe(true);
  });

  it('never routes to a module that is not built', () => {
    const enabled = new Set(enabledModules().map((module) => module.path));
    for (const document of index) {
      expect(enabled.has(document.route.split('?')[0] ?? '')).toBe(true);
    }
  });
});
