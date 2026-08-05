import type { SovereignDataset } from '@/data/dataset';
import type {
  Company,
  DocumentKind,
  DocumentStatus,
  KnowledgeNode,
  Meeting,
  Opportunity,
  Person,
  Project,
  SovereignDocument,
} from '@/domain';

/* ── Vocabulary ─────────────────────────────────────────────────────────── */

export const documentKindLabel: Record<DocumentKind, string> = {
  brief: 'Brief',
  proposal: 'Proposal',
  memo: 'Memo',
  sop: 'SOP',
  transcript: 'Transcript',
  reference: 'Reference',
};

export const documentStatusLabel: Record<DocumentStatus, string> = {
  draft: 'Draft',
  final: 'Final',
  archived: 'Archived',
};

export function documentStatusTone(
  status: DocumentStatus,
): 'critical' | 'warning' | 'info' | 'neutral' | 'muted' {
  switch (status) {
    case 'final':
      return 'info';
    case 'draft':
      return 'warning';
    default:
      return 'muted';
  }
}

/* ── Query ──────────────────────────────────────────────────────────────── */

export const DOCUMENT_STATUS_FILTERS = ['open', 'draft', 'final', 'archived', 'all'] as const;
export type DocumentStatusFilter = (typeof DOCUMENT_STATUS_FILTERS)[number];

export const DOCUMENT_KIND_FILTERS = [
  'all',
  'brief',
  'proposal',
  'memo',
  'sop',
  'transcript',
  'reference',
] as const;
export type DocumentKindFilter = (typeof DOCUMENT_KIND_FILTERS)[number];

export const documentStatusFilterLabel: Record<DocumentStatusFilter, string> = {
  open: 'In use',
  all: 'All',
  ...documentStatusLabel,
};

export const documentKindFilterLabel: Record<DocumentKindFilter, string> = {
  all: 'Any kind',
  ...documentKindLabel,
};

export interface DocumentQuery {
  status: DocumentStatusFilter;
  kind: DocumentKindFilter;
}

export const defaultDocumentQuery: DocumentQuery = { status: 'open', kind: 'all' };

export function parseDocumentQuery(params: URLSearchParams): DocumentQuery {
  const status = params.get('status');
  const kind = params.get('kind');
  return {
    status:
      DOCUMENT_STATUS_FILTERS.find((value) => value === status) ?? defaultDocumentQuery.status,
    kind: DOCUMENT_KIND_FILTERS.find((value) => value === kind) ?? defaultDocumentQuery.kind,
  };
}

function matches(document: SovereignDocument, query: DocumentQuery): boolean {
  if (query.status === 'open' && document.status === 'archived') return false;
  if (query.status !== 'open' && query.status !== 'all' && document.status !== query.status) {
    return false;
  }
  if (query.kind !== 'all' && document.kind !== query.kind) return false;
  return true;
}

export interface DocumentCounts extends Record<DocumentStatus, number> {
  total: number;
  open: number;
  words: number;
}

/** Words are counted from the body on read, so the count cannot drift from the text. */
export function wordCount(body: string): number {
  const trimmed = body.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

export function documentCounts(dataset: SovereignDataset): DocumentCounts {
  const counts: DocumentCounts = {
    total: dataset.documents.length,
    open: 0,
    words: 0,
    draft: 0,
    final: 0,
    archived: 0,
  };

  for (const document of dataset.documents) {
    counts[document.status] += 1;
    if (document.status !== 'archived') counts.open += 1;
    counts.words += wordCount(document.body);
  }

  return counts;
}

const statusRank: Record<DocumentStatus, number> = { draft: 0, final: 1, archived: 2 };

export function selectDocuments(
  dataset: SovereignDataset,
  query: DocumentQuery = defaultDocumentQuery,
): SovereignDocument[] {
  return dataset.documents
    .filter((document) => matches(document, query))
    .sort(
      (a, b) =>
        statusRank[a.status] - statusRank[b.status] ||
        Date.parse(b.touchedAt ?? b.updatedAt) - Date.parse(a.touchedAt ?? a.updatedAt) ||
        a.title.localeCompare(b.title),
    );
}

export function findDocument(
  dataset: SovereignDataset,
  id: string | undefined,
): SovereignDocument | undefined {
  if (id === undefined) return undefined;
  return dataset.documents.find((document) => document.id === id);
}

/* ── Rendering ──────────────────────────────────────────────────────────── */

export type DocumentBlockKind = 'heading' | 'subheading' | 'list' | 'paragraph';

export interface DocumentBlock {
  id: string;
  kind: DocumentBlockKind;
  /** Always plain text. A block is rendered as a text node, never as markup. */
  text: string;
}

/**
 * Splits a document body into blocks for rendering.
 *
 * It reads two markdown affordances — `#`/`##` headings and `-`/`1.` list items
 * — and nothing else. Everything is emitted as text, so a document containing
 * `<script>` renders those characters and cannot inject markup
 * (ARCHITECTURE_AUDIT §5.9). This is deliberately not a markdown parser: a
 * parser that produces HTML would need sanitising, and sanitising is the class
 * of bug this avoids entirely.
 */
export function documentBlocks(body: string): DocumentBlock[] {
  const blocks: DocumentBlock[] = [];
  const lines = body.split('\n');
  let paragraph: string[] = [];

  const flush = () => {
    if (paragraph.length === 0) return;
    blocks.push({
      id: `b${String(blocks.length)}`,
      kind: 'paragraph',
      text: paragraph.join(' ').trim(),
    });
    paragraph = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (line.length === 0) {
      flush();
      continue;
    }
    if (line.startsWith('## ')) {
      flush();
      blocks.push({ id: `b${String(blocks.length)}`, kind: 'subheading', text: line.slice(3) });
      continue;
    }
    if (line.startsWith('# ')) {
      flush();
      blocks.push({ id: `b${String(blocks.length)}`, kind: 'heading', text: line.slice(2) });
      continue;
    }
    const listItem = /^(?:[-*]\s+|\d+\.\s+)(.*)$/.exec(line);
    if (listItem) {
      flush();
      blocks.push({ id: `b${String(blocks.length)}`, kind: 'list', text: listItem[1] ?? '' });
      continue;
    }
    paragraph.push(line);
  }

  flush();
  return blocks;
}

/* ── Joins ──────────────────────────────────────────────────────────────── */

export interface DocumentLinks {
  company: Company | undefined;
  person: Person | undefined;
  opportunity: Opportunity | undefined;
  project: Project | undefined;
  meeting: Meeting | undefined;
  knowledgeNodes: KnowledgeNode[];
}

export function documentLinks(
  dataset: SovereignDataset,
  document: SovereignDocument,
): DocumentLinks {
  return {
    company: dataset.companies.find((row) => row.id === document.companyId),
    person: dataset.people.find((row) => row.id === document.personId),
    opportunity: dataset.opportunities.find((row) => row.id === document.opportunityId),
    project: dataset.projects.find((row) => row.id === document.projectId),
    meeting: dataset.meetings.find((row) => row.id === document.meetingId),
    knowledgeNodes: dataset.knowledgeNodes.filter((node) =>
      node.documentIds.includes(document.id),
    ),
  };
}
