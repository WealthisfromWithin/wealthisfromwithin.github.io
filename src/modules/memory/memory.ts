import type { SovereignDataset } from '@/data/dataset';
import type {
  Company,
  Decision,
  KnowledgeNode,
  MemoryConfidence,
  MemoryEntry,
  MemoryKind,
  MemoryScope,
  Person,
} from '@/domain';

/* ── Vocabulary ─────────────────────────────────────────────────────────── */

export const memoryKindLabel: Record<MemoryKind, string> = {
  fact: 'Fact',
  preference: 'Preference',
  constraint: 'Constraint',
  context: 'Context',
  lesson: 'Lesson',
};

export const memoryScopeLabel: Record<MemoryScope, string> = {
  operator: 'Operator',
  business: 'Business',
  relationship: 'Relationship',
  system: 'System',
};

/**
 * Provenance, printed as provenance. `inferred` is the weakest claim the store
 * can make and the surface says so rather than translating it into a score.
 */
export const memoryConfidenceLabel: Record<MemoryConfidence, string> = {
  stated: 'Stated',
  observed: 'Observed',
  inferred: 'Inferred',
};

export function memoryKindTone(
  kind: MemoryKind,
): 'critical' | 'warning' | 'info' | 'neutral' | 'muted' {
  switch (kind) {
    case 'constraint':
      return 'warning';
    case 'lesson':
      return 'info';
    case 'preference':
      return 'neutral';
    default:
      return 'muted';
  }
}

/* ── Query ──────────────────────────────────────────────────────────────── */

export const MEMORY_STATES = ['working', 'pinned', 'review', 'retired', 'all'] as const;
export type MemoryState = (typeof MEMORY_STATES)[number];

export const MEMORY_KIND_FILTERS = [
  'all',
  'fact',
  'preference',
  'constraint',
  'context',
  'lesson',
] as const;
export type MemoryKindFilter = (typeof MEMORY_KIND_FILTERS)[number];

export const memoryStateLabel: Record<MemoryState, string> = {
  working: 'Working set',
  pinned: 'Pinned',
  review: 'Needs review',
  retired: 'Retired',
  all: 'All',
};

export const memoryKindFilterLabel: Record<MemoryKindFilter, string> = {
  all: 'Any kind',
  ...memoryKindLabel,
};

export interface MemoryQuery {
  state: MemoryState;
  kind: MemoryKindFilter;
}

export const defaultMemoryQuery: MemoryQuery = { state: 'working', kind: 'all' };

export function parseMemoryQuery(params: URLSearchParams): MemoryQuery {
  const state = params.get('state');
  const kind = params.get('kind');
  return {
    state: MEMORY_STATES.find((value) => value === state) ?? defaultMemoryQuery.state,
    kind: MEMORY_KIND_FILTERS.find((value) => value === kind) ?? defaultMemoryQuery.kind,
  };
}

export function isRetired(entry: MemoryEntry): boolean {
  return entry.retiredAt !== undefined;
}

/** Its review date has passed and nobody has re-confirmed it since. */
export function needsReview(entry: MemoryEntry, now: Date): boolean {
  if (isRetired(entry) || entry.reviewAt === undefined) return false;
  const due = Date.parse(entry.reviewAt);
  return !Number.isNaN(due) && due <= now.getTime();
}

function matches(entry: MemoryEntry, query: MemoryQuery, now: Date): boolean {
  if (query.state === 'working' && isRetired(entry)) return false;
  if (query.state === 'pinned' && (!entry.pinned || isRetired(entry))) return false;
  if (query.state === 'review' && !needsReview(entry, now)) return false;
  if (query.state === 'retired' && !isRetired(entry)) return false;
  if (query.kind !== 'all' && entry.kind !== query.kind) return false;
  return true;
}

export interface MemoryCounts extends Record<MemoryKind, number> {
  total: number;
  working: number;
  pinned: number;
  review: number;
  retired: number;
}

export function memoryCounts(dataset: SovereignDataset, now: Date): MemoryCounts {
  const counts: MemoryCounts = {
    total: dataset.memoryEntries.length,
    working: 0,
    pinned: 0,
    review: 0,
    retired: 0,
    fact: 0,
    preference: 0,
    constraint: 0,
    context: 0,
    lesson: 0,
  };

  for (const entry of dataset.memoryEntries) {
    counts[entry.kind] += 1;
    if (isRetired(entry)) counts.retired += 1;
    else counts.working += 1;
    if (entry.pinned && !isRetired(entry)) counts.pinned += 1;
    if (needsReview(entry, now)) counts.review += 1;
  }

  return counts;
}

/**
 * What must not be missed, first: pinned, then anything past its review date,
 * then constraints, then the rest by how recently they were recalled.
 */
const kindRank: Record<MemoryKind, number> = {
  constraint: 0,
  fact: 1,
  preference: 2,
  lesson: 3,
  context: 4,
};

export function selectMemoryEntries(
  dataset: SovereignDataset,
  query: MemoryQuery = defaultMemoryQuery,
  now: Date = new Date(),
): MemoryEntry[] {
  return dataset.memoryEntries
    .filter((entry) => matches(entry, query, now))
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const review = Number(needsReview(b, now)) - Number(needsReview(a, now));
      if (review !== 0) return review;
      const byKind = kindRank[a.kind] - kindRank[b.kind];
      if (byKind !== 0) return byKind;
      return (
        Date.parse(b.lastRecalledAt ?? b.createdAt) - Date.parse(a.lastRecalledAt ?? a.createdAt) ||
        a.statement.localeCompare(b.statement)
      );
    });
}

/** The memories the surface would hand an agent: pinned and constraints, live only. */
export function workingMemory(dataset: SovereignDataset): MemoryEntry[] {
  return dataset.memoryEntries
    .filter((entry) => !isRetired(entry) && (entry.pinned || entry.kind === 'constraint'))
    .sort((a, b) => kindRank[a.kind] - kindRank[b.kind] || a.statement.localeCompare(b.statement));
}

export function memoriesNeedingReview(dataset: SovereignDataset, now: Date): MemoryEntry[] {
  return dataset.memoryEntries
    .filter((entry) => needsReview(entry, now))
    .sort((a, b) => Date.parse(a.reviewAt ?? '') - Date.parse(b.reviewAt ?? ''));
}

/* ── Joins ──────────────────────────────────────────────────────────────── */

export interface MemoryLinks {
  person: Person | undefined;
  company: Company | undefined;
  decision: Decision | undefined;
  knowledgeNode: KnowledgeNode | undefined;
}

export function memoryLinks(dataset: SovereignDataset, entry: MemoryEntry): MemoryLinks {
  return {
    person: dataset.people.find((row) => row.id === entry.personId),
    company: dataset.companies.find((row) => row.id === entry.companyId),
    decision: dataset.decisions.find((row) => row.id === entry.decisionId),
    knowledgeNode: dataset.knowledgeNodes.find((row) => row.id === entry.knowledgeNodeId),
  };
}
