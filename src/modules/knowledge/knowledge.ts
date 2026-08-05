import type { SovereignDataset } from '@/data/dataset';
import type {
  Company,
  ContentItem,
  Decision,
  KnowledgeKind,
  KnowledgeNode,
  Meeting,
  MemoryEntry,
  Opportunity,
  Person,
  ResearchItem,
  SovereignDocument,
} from '@/domain';

/* ── Vocabulary ─────────────────────────────────────────────────────────── */

export const knowledgeKindLabel: Record<KnowledgeKind, string> = {
  note: 'Note',
  insight: 'Insight',
  reference: 'Reference',
  playbook: 'Playbook',
  question: 'Open question',
};

export function knowledgeKindTone(
  kind: KnowledgeKind,
): 'critical' | 'warning' | 'info' | 'neutral' | 'muted' {
  switch (kind) {
    case 'insight':
      return 'info';
    case 'question':
      return 'warning';
    case 'playbook':
      return 'neutral';
    default:
      return 'muted';
  }
}

/* ── Query ──────────────────────────────────────────────────────────────── */

export const KNOWLEDGE_VIEWS = ['active', 'pinned', 'archived', 'all'] as const;
export type KnowledgeView = (typeof KNOWLEDGE_VIEWS)[number];

export const KNOWLEDGE_KIND_FILTERS = [
  'all',
  'note',
  'insight',
  'reference',
  'playbook',
  'question',
] as const;
export type KnowledgeKindFilter = (typeof KNOWLEDGE_KIND_FILTERS)[number];

export const knowledgeViewLabel: Record<KnowledgeView, string> = {
  active: 'In use',
  pinned: 'Pinned',
  archived: 'Archived',
  all: 'All',
};

export const knowledgeKindFilterLabel: Record<KnowledgeKindFilter, string> = {
  all: 'Any kind',
  ...knowledgeKindLabel,
};

export interface KnowledgeQuery {
  view: KnowledgeView;
  kind: KnowledgeKindFilter;
}

export const defaultKnowledgeQuery: KnowledgeQuery = { view: 'active', kind: 'all' };

export function parseKnowledgeQuery(params: URLSearchParams): KnowledgeQuery {
  const view = params.get('view');
  const kind = params.get('kind');
  return {
    view: KNOWLEDGE_VIEWS.find((value) => value === view) ?? defaultKnowledgeQuery.view,
    kind: KNOWLEDGE_KIND_FILTERS.find((value) => value === kind) ?? defaultKnowledgeQuery.kind,
  };
}

export function isArchived(node: KnowledgeNode): boolean {
  return node.archivedAt !== undefined;
}

function matches(node: KnowledgeNode, query: KnowledgeQuery): boolean {
  if (query.view === 'active' && isArchived(node)) return false;
  if (query.view === 'pinned' && (!node.pinned || isArchived(node))) return false;
  if (query.view === 'archived' && !isArchived(node)) return false;
  if (query.kind !== 'all' && node.kind !== query.kind) return false;
  return true;
}

export interface KnowledgeCounts extends Record<KnowledgeKind, number> {
  total: number;
  active: number;
  pinned: number;
  archived: number;
  linked: number;
}

/** A node is "linked" when it points at a record elsewhere in the store. */
export function isLinked(node: KnowledgeNode): boolean {
  return (
    node.personIds.length > 0 ||
    node.documentIds.length > 0 ||
    node.relatedNodeIds.length > 0 ||
    node.companyId !== undefined ||
    node.opportunityId !== undefined ||
    node.contentItemId !== undefined ||
    node.meetingId !== undefined
  );
}

export function knowledgeCounts(dataset: SovereignDataset): KnowledgeCounts {
  const counts: KnowledgeCounts = {
    total: dataset.knowledgeNodes.length,
    active: 0,
    pinned: 0,
    archived: 0,
    linked: 0,
    note: 0,
    insight: 0,
    reference: 0,
    playbook: 0,
    question: 0,
  };

  for (const node of dataset.knowledgeNodes) {
    counts[node.kind] += 1;
    if (isArchived(node)) counts.archived += 1;
    else counts.active += 1;
    if (node.pinned && !isArchived(node)) counts.pinned += 1;
    if (isLinked(node)) counts.linked += 1;
  }

  return counts;
}

/**
 * Pinned first, then the most recently touched. Recency is the honest ranking
 * here: nothing in this store measures how useful a node has been.
 */
export function selectKnowledgeNodes(
  dataset: SovereignDataset,
  query: KnowledgeQuery = defaultKnowledgeQuery,
): KnowledgeNode[] {
  return dataset.knowledgeNodes
    .filter((node) => matches(node, query))
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return (
        Date.parse(b.touchedAt ?? b.updatedAt) - Date.parse(a.touchedAt ?? a.updatedAt) ||
        a.title.localeCompare(b.title)
      );
    });
}

export function findKnowledgeNode(
  dataset: SovereignDataset,
  id: string | undefined,
): KnowledgeNode | undefined {
  if (id === undefined) return undefined;
  return dataset.knowledgeNodes.find((node) => node.id === id);
}

/** Every tag in use, with how many live nodes carry it, most used first. */
export function knowledgeTags(dataset: SovereignDataset): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const node of dataset.knowledgeNodes) {
    if (isArchived(node)) continue;
    for (const tag of node.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/* ── Joins ──────────────────────────────────────────────────────────────── */

export interface KnowledgeLinks {
  people: Person[];
  company: Company | undefined;
  opportunity: Opportunity | undefined;
  contentItem: ContentItem | undefined;
  meeting: Meeting | undefined;
  documents: SovereignDocument[];
  related: KnowledgeNode[];
  /** Rows elsewhere that point back at this node. */
  memories: MemoryEntry[];
  decisions: Decision[];
  research: ResearchItem[];
}

export function knowledgeLinks(dataset: SovereignDataset, node: KnowledgeNode): KnowledgeLinks {
  return {
    people: dataset.people.filter((person) => node.personIds.includes(person.id)),
    company: dataset.companies.find((row) => row.id === node.companyId),
    opportunity: dataset.opportunities.find((row) => row.id === node.opportunityId),
    contentItem: dataset.contentItems.find((row) => row.id === node.contentItemId),
    meeting: dataset.meetings.find((row) => row.id === node.meetingId),
    documents: dataset.documents.filter((row) => node.documentIds.includes(row.id)),
    related: dataset.knowledgeNodes.filter(
      (row) => node.relatedNodeIds.includes(row.id) || row.relatedNodeIds.includes(node.id),
    ),
    memories: dataset.memoryEntries.filter((row) => row.knowledgeNodeId === node.id),
    decisions: dataset.decisions.filter((row) => row.knowledgeNodeId === node.id),
    research: dataset.researchItems.filter((row) => row.knowledgeNodeId === node.id),
  };
}
