import type { SovereignDataset } from '@/data/dataset';
import type {
  Company,
  ContentItem,
  Decision,
  DecisionStatus,
  KnowledgeNode,
  MemoryEntry,
  Opportunity,
  Person,
  Project,
} from '@/domain';

/* ── Vocabulary ─────────────────────────────────────────────────────────── */

export const decisionStatusLabel: Record<DecisionStatus, string> = {
  proposed: 'Awaiting a call',
  decided: 'Decided',
  superseded: 'Superseded',
  withdrawn: 'Withdrawn',
};

export function decisionStatusTone(
  status: DecisionStatus,
): 'critical' | 'warning' | 'info' | 'neutral' | 'muted' {
  switch (status) {
    case 'proposed':
      return 'warning';
    case 'decided':
      return 'info';
    default:
      return 'muted';
  }
}

/* ── Query ──────────────────────────────────────────────────────────────── */

export const DECISION_FILTERS = [
  'open',
  'proposed',
  'decided',
  'superseded',
  'withdrawn',
  'all',
] as const;
export type DecisionFilter = (typeof DECISION_FILTERS)[number];

export const decisionFilterLabel: Record<DecisionFilter, string> = {
  open: 'Open and decided',
  all: 'All',
  ...decisionStatusLabel,
};

export function parseDecisionFilter(value: string | null): DecisionFilter {
  return DECISION_FILTERS.find((filter) => filter === value) ?? 'open';
}

/** Proposed, past the date the operator set for making the call. */
export function isOverdue(decision: Decision, now: Date): boolean {
  if (decision.status !== 'proposed' || decision.dueAt === undefined) return false;
  const due = Date.parse(decision.dueAt);
  return !Number.isNaN(due) && due < now.getTime();
}

/** Decided, past the date the operator set for revisiting it. */
export function isDueForReview(decision: Decision, now: Date): boolean {
  if (decision.status !== 'decided' || decision.reviewAt === undefined) return false;
  const at = Date.parse(decision.reviewAt);
  return !Number.isNaN(at) && at <= now.getTime();
}

function matches(decision: Decision, filter: DecisionFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'open') return decision.status === 'proposed' || decision.status === 'decided';
  return decision.status === filter;
}

export interface DecisionCounts extends Record<DecisionStatus, number> {
  total: number;
  open: number;
  overdue: number;
  review: number;
  irreversible: number;
}

export function decisionCounts(dataset: SovereignDataset, now: Date): DecisionCounts {
  const counts: DecisionCounts = {
    total: dataset.decisions.length,
    open: 0,
    overdue: 0,
    review: 0,
    irreversible: 0,
    proposed: 0,
    decided: 0,
    superseded: 0,
    withdrawn: 0,
  };

  for (const decision of dataset.decisions) {
    counts[decision.status] += 1;
    if (decision.status === 'proposed' || decision.status === 'decided') counts.open += 1;
    if (isOverdue(decision, now)) counts.overdue += 1;
    if (isDueForReview(decision, now)) counts.review += 1;
    if (!decision.reversible && decision.status === 'decided') counts.irreversible += 1;
  }

  return counts;
}

/**
 * Calls still to make first, oldest deadline leading, then the decided ones
 * most recent first. A decision waiting on a human outranks one already made.
 */
const statusRank: Record<DecisionStatus, number> = {
  proposed: 0,
  decided: 1,
  superseded: 2,
  withdrawn: 3,
};

function dateRank(decision: Decision): number {
  const value = decision.dueAt ?? decision.decidedAt ?? decision.createdAt;
  const at = Date.parse(value);
  return Number.isNaN(at) ? Number.MAX_SAFE_INTEGER : at;
}

export function selectDecisions(
  dataset: SovereignDataset,
  filter: DecisionFilter = 'open',
): Decision[] {
  return dataset.decisions
    .filter((decision) => matches(decision, filter))
    .sort((a, b) => {
      const byStatus = statusRank[a.status] - statusRank[b.status];
      if (byStatus !== 0) return byStatus;
      if (a.status === 'proposed') return dateRank(a) - dateRank(b);
      return dateRank(b) - dateRank(a) || a.title.localeCompare(b.title);
    });
}

export function decisionsAwaitingCall(dataset: SovereignDataset): Decision[] {
  return selectDecisions(dataset, 'proposed');
}

export function recentDecisions(dataset: SovereignDataset, limit = 5): Decision[] {
  return dataset.decisions
    .filter((decision) => decision.status === 'decided')
    .sort((a, b) => Date.parse(b.decidedAt ?? '') - Date.parse(a.decidedAt ?? ''))
    .slice(0, limit);
}

export function findDecision(
  dataset: SovereignDataset,
  id: string | undefined,
): Decision | undefined {
  if (id === undefined) return undefined;
  return dataset.decisions.find((decision) => decision.id === id);
}

/* ── Joins ──────────────────────────────────────────────────────────────── */

export interface DecisionLinks {
  people: Person[];
  company: Company | undefined;
  opportunity: Opportunity | undefined;
  project: Project | undefined;
  contentItem: ContentItem | undefined;
  knowledgeNode: KnowledgeNode | undefined;
  supersededBy: Decision | undefined;
  /** The decision this one replaced, read from the other end of the same link. */
  supersedes: Decision[];
  memories: MemoryEntry[];
}

export function decisionLinks(dataset: SovereignDataset, decision: Decision): DecisionLinks {
  return {
    people: dataset.people.filter((person) => decision.personIds.includes(person.id)),
    company: dataset.companies.find((row) => row.id === decision.companyId),
    opportunity: dataset.opportunities.find((row) => row.id === decision.opportunityId),
    project: dataset.projects.find((row) => row.id === decision.projectId),
    contentItem: dataset.contentItems.find((row) => row.id === decision.contentItemId),
    knowledgeNode: dataset.knowledgeNodes.find((row) => row.id === decision.knowledgeNodeId),
    supersededBy: dataset.decisions.find((row) => row.id === decision.supersededById),
    supersedes: dataset.decisions.filter((row) => row.supersededById === decision.id),
    memories: dataset.memoryEntries.filter((row) => row.decisionId === decision.id),
  };
}
