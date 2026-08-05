import { describe, expect, it } from 'vitest';
import { emptyDataset } from '@/data/dataset';
import { buildDemoDataset } from '@/data/seed';
import {
  defaultKnowledgeQuery,
  isArchived,
  isLinked,
  knowledgeCounts,
  knowledgeLinks,
  knowledgeTags,
  parseKnowledgeQuery,
  selectKnowledgeNodes,
  findKnowledgeNode,
} from './knowledge';

const now = new Date('2026-08-05T07:30:00.000Z');
const dataset = buildDemoDataset(now);

function query(search: string) {
  return parseKnowledgeQuery(new URLSearchParams(search));
}

describe('knowledge query', () => {
  it('defaults to the live nodes of any kind', () => {
    expect(query('')).toEqual(defaultKnowledgeQuery);
  });

  it('reads a legal view and kind, and refuses anything else', () => {
    expect(query('view=archived&kind=playbook')).toEqual({ view: 'archived', kind: 'playbook' });
    expect(query('view=deleted&kind=rumour')).toEqual(defaultKnowledgeQuery);
  });
});

describe('selectKnowledgeNodes', () => {
  it('leads with the pinned nodes', () => {
    const rows = selectKnowledgeNodes(dataset);
    const pinned = rows.filter((node) => node.pinned);

    expect(pinned.length).toBeGreaterThan(0);
    expect(rows.slice(0, pinned.length).every((node) => node.pinned)).toBe(true);
  });

  it('hides archived nodes from the working view and shows them under their own', () => {
    const active = selectKnowledgeNodes(dataset, { view: 'active', kind: 'all' });
    expect(active.some(isArchived)).toBe(false);

    const archived = selectKnowledgeNodes(dataset, { view: 'archived', kind: 'all' });
    expect(archived.every(isArchived)).toBe(true);
  });

  it('filters by kind without changing the view', () => {
    const rows = selectKnowledgeNodes(dataset, { view: 'all', kind: 'insight' });

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((node) => node.kind === 'insight')).toBe(true);
  });

  it('returns nothing rather than inventing rows for an empty store', () => {
    expect(selectKnowledgeNodes(emptyDataset)).toHaveLength(0);
    expect(knowledgeCounts(emptyDataset).total).toBe(0);
  });
});

describe('knowledgeCounts', () => {
  it('counts the working set, the pins, and what is linked to a record', () => {
    const counts = knowledgeCounts(dataset);

    expect(counts.total).toBe(dataset.knowledgeNodes.length);
    expect(counts.active + counts.archived).toBe(counts.total);
    expect(counts.linked).toBe(dataset.knowledgeNodes.filter(isLinked).length);
    expect(counts.pinned).toBeGreaterThan(0);
  });
});

describe('knowledgeLinks', () => {
  it('joins a node to the records it names and the rows that point back', () => {
    const node = findKnowledgeNode(dataset, 'kn-compounding-thesis');
    expect(node).toBeDefined();
    if (!node) return;

    const links = knowledgeLinks(dataset, node);

    expect(links.people.map((person) => person.id)).toEqual(['p-aldridge']);
    expect(links.contentItem?.id).toBe('c-compounding-essay');
    expect(links.documents.map((document) => document.id)).toEqual(['doc-truoak-renewal-memo']);
    expect(links.decisions.map((decision) => decision.id)).toContain('dec-no-discount');
  });

  it('reads a relation from either end, so a link is never one-way in the surface', () => {
    const node = findKnowledgeNode(dataset, 'kn-compounding-thesis');
    expect(node).toBeDefined();
    if (!node) return;

    const related = knowledgeLinks(dataset, node).related.map((row) => row.id);
    // Named by this node…
    expect(related).toContain('kn-advisory-intake');
    // …and naming it from the other side.
    expect(related).toContain('kn-open-question-retainer-floor');
  });

  it('returns an empty join rather than a partial record for an unknown id', () => {
    expect(findKnowledgeNode(dataset, 'kn-nope')).toBeUndefined();
    expect(findKnowledgeNode(dataset, undefined)).toBeUndefined();
  });
});

describe('knowledgeTags', () => {
  it('counts tags on live nodes only, most used first', () => {
    const tags = knowledgeTags(dataset);

    expect(tags.length).toBeGreaterThan(0);
    for (let index = 1; index < tags.length; index += 1) {
      expect((tags[index - 1]?.count ?? 0) >= (tags[index]?.count ?? 0)).toBe(true);
    }
  });
});
