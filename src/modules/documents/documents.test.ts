import { describe, expect, it } from 'vitest';
import { emptyDataset } from '@/data/dataset';
import { buildDemoDataset } from '@/data/seed';
import {
  defaultDocumentQuery,
  documentBlocks,
  documentCounts,
  documentLinks,
  findDocument,
  parseDocumentQuery,
  selectDocuments,
  wordCount,
} from './documents';

const now = new Date('2026-08-05T07:30:00.000Z');
const dataset = buildDemoDataset(now);

function query(search: string) {
  return parseDocumentQuery(new URLSearchParams(search));
}

describe('document query', () => {
  it('defaults to what is in use, of any kind', () => {
    expect(query('')).toEqual(defaultDocumentQuery);
  });

  it('refuses a status or kind it does not serve', () => {
    expect(query('status=final&kind=sop')).toEqual({ status: 'final', kind: 'sop' });
    expect(query('status=shredded&kind=pdf')).toEqual(defaultDocumentQuery);
  });
});

describe('selectDocuments', () => {
  it('keeps archived documents out of the in-use view', () => {
    const rows = selectDocuments(dataset);
    expect(rows.every((document) => document.status !== 'archived')).toBe(true);
  });

  it('puts drafts before finals, because a draft is unfinished work', () => {
    const rows = selectDocuments(dataset, { status: 'all', kind: 'all' });
    const firstFinal = rows.findIndex((document) => document.status === 'final');
    const lastDraft = rows.map((document) => document.status).lastIndexOf('draft');

    expect(firstFinal).toBeGreaterThan(lastDraft);
  });

  it('filters by kind', () => {
    const rows = selectDocuments(dataset, { status: 'all', kind: 'proposal' });
    expect(rows.map((document) => document.id)).toEqual(['doc-harbour-proposal']);
  });

  it('holds nothing for an empty store', () => {
    expect(selectDocuments(emptyDataset)).toHaveLength(0);
    expect(documentCounts(emptyDataset).words).toBe(0);
  });
});

describe('documentCounts', () => {
  it('counts words from the body on read, so the count cannot drift', () => {
    const counts = documentCounts(dataset);

    expect(counts.total).toBe(dataset.documents.length);
    expect(counts.words).toBe(
      dataset.documents.reduce((total, document) => total + wordCount(document.body), 0),
    );
    expect(wordCount('   ')).toBe(0);
    expect(wordCount('two words')).toBe(2);
  });
});

describe('documentBlocks', () => {
  it('reads headings, subheadings, and list items and nothing else', () => {
    const blocks = documentBlocks(
      ['# Title', '', '## Section', '- first', '2. second', 'A paragraph', 'continued.'].join('\n'),
    );

    expect(blocks.map((block) => [block.kind, block.text])).toEqual([
      ['heading', 'Title'],
      ['subheading', 'Section'],
      ['list', 'first'],
      ['list', 'second'],
      ['paragraph', 'A paragraph continued.'],
    ]);
  });

  it('emits markup as text rather than parsing it, so a body cannot inject anything', () => {
    const blocks = documentBlocks('<script>alert(1)</script>');

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.kind).toBe('paragraph');
    expect(blocks[0]?.text).toBe('<script>alert(1)</script>');
  });

  it('gives every block a unique key and drops blank lines', () => {
    const blocks = documentBlocks('one\n\n\ntwo\n');
    expect(blocks).toHaveLength(2);
    expect(new Set(blocks.map((block) => block.id)).size).toBe(2);
  });

  it('produces nothing for an empty body', () => {
    expect(documentBlocks('')).toHaveLength(0);
  });
});

describe('documentLinks', () => {
  it('joins a document to the records it belongs to and the knowledge that cites it', () => {
    const document = findDocument(dataset, 'doc-truoak-renewal-memo');
    expect(document).toBeDefined();
    if (!document) return;

    const links = documentLinks(dataset, document);
    expect(links.company?.id).toBe('co-truoak');
    expect(links.person?.id).toBe('p-aldridge');
    expect(links.opportunity?.id).toBe('opp-truoak');
    expect(links.knowledgeNodes.map((node) => node.id)).toContain('kn-compounding-thesis');
  });

  it('finds nothing for an id the store does not hold', () => {
    expect(findDocument(dataset, 'doc-nope')).toBeUndefined();
    expect(findDocument(dataset, undefined)).toBeUndefined();
  });
});
