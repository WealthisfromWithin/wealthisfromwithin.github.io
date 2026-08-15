import type { SovereignDataset } from '@/data/dataset';
import type {
  Company,
  ContentIdea,
  KnowledgeNode,
  Opportunity,
  ResearchItem,
  ResearchStatus,
} from '@/domain';
import { priorityRank } from '@/domain';
import { endOfDay, startOfDay } from '@/lib/clock';

/* ── Vocabulary ─────────────────────────────────────────────────────────── */

export const researchStatusLabel: Record<ResearchStatus, string> = {
  queued: 'Queued',
  active: 'In progress',
  answered: 'Answered',
  parked: 'Parked',
};

export function researchStatusTone(
  status: ResearchStatus,
): 'critical' | 'warning' | 'info' | 'neutral' | 'muted' {
  switch (status) {
    case 'active':
      return 'info';
    case 'queued':
      return 'warning';
    case 'answered':
      return 'neutral';
    default:
      return 'muted';
  }
}

/* ── Query ──────────────────────────────────────────────────────────────── */

export const RESEARCH_FILTERS = ['open', 'queued', 'active', 'answered', 'parked', 'all'] as const;
export type ResearchFilter = (typeof RESEARCH_FILTERS)[number];

export const researchFilterLabel: Record<ResearchFilter, string> = {
  open: 'Open',
  all: 'All',
  ...researchStatusLabel,
};

export function parseResearchFilter(value: string | null): ResearchFilter {
  return RESEARCH_FILTERS.find((filter) => filter === value) ?? 'open';
}

export function isOpen(item: ResearchItem): boolean {
  return item.status === 'queued' || item.status === 'active';
}

export function isOverdue(item: ResearchItem, now: Date): boolean {
  if (!isOpen(item) || item.dueAt === undefined) return false;
  const due = Date.parse(item.dueAt);
  return !Number.isNaN(due) && due < startOfDay(now).getTime();
}

export function isDueToday(item: ResearchItem, now: Date): boolean {
  if (!isOpen(item) || item.dueAt === undefined) return false;
  const due = Date.parse(item.dueAt);
  return due >= startOfDay(now).getTime() && due <= endOfDay(now).getTime();
}

function matches(item: ResearchItem, filter: ResearchFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'open') return isOpen(item);
  return item.status === filter;
}

export interface ResearchCounts extends Record<ResearchStatus, number> {
  total: number;
  open: number;
  overdue: number;
  dueToday: number;
  findings: number;
}

export function researchCounts(dataset: SovereignDataset, now: Date): ResearchCounts {
  const counts: ResearchCounts = {
    total: dataset.researchItems.length,
    open: 0,
    overdue: 0,
    dueToday: 0,
    findings: 0,
    queued: 0,
    active: 0,
    answered: 0,
    parked: 0,
  };

  for (const item of dataset.researchItems) {
    counts[item.status] += 1;
    if (isOpen(item)) counts.open += 1;
    if (isOverdue(item, now)) counts.overdue += 1;
    if (isDueToday(item, now)) counts.dueToday += 1;
    counts.findings += item.findings.length;
  }

  return counts;
}

const statusRank: Record<ResearchStatus, number> = {
  active: 0,
  queued: 1,
  answered: 2,
  parked: 3,
};

function dueRank(item: ResearchItem): number {
  if (item.dueAt === undefined) return Number.MAX_SAFE_INTEGER;
  const at = Date.parse(item.dueAt);
  return Number.isNaN(at) ? Number.MAX_SAFE_INTEGER : at;
}

/**
 * In progress before queued, then by date, then by priority. Undated questions
 * sort last: a question with no date is not urgent, it is unscheduled.
 */
export function selectResearchItems(
  dataset: SovereignDataset,
  filter: ResearchFilter = 'open',
): ResearchItem[] {
  return dataset.researchItems
    .filter((item) => matches(item, filter))
    .sort((a, b) => {
      const byStatus = statusRank[a.status] - statusRank[b.status];
      if (byStatus !== 0) return byStatus;
      const byDate = dueRank(a) - dueRank(b);
      if (byDate !== 0) return byDate;
      return (
        priorityRank[a.priority] - priorityRank[b.priority] || a.question.localeCompare(b.question)
      );
    });
}

/** Open questions whose date has arrived or passed, most overdue first. */
export function researchDue(dataset: SovereignDataset, now: Date): ResearchItem[] {
  return dataset.researchItems
    .filter((item) => isOverdue(item, now) || isDueToday(item, now))
    .sort((a, b) => dueRank(a) - dueRank(b));
}

export function findResearchItem(
  dataset: SovereignDataset,
  id: string | undefined,
): ResearchItem | undefined {
  if (id === undefined) return undefined;
  return dataset.researchItems.find((item) => item.id === id);
}

/* ── Joins ──────────────────────────────────────────────────────────────── */

export interface ResearchLinks {
  knowledgeNode: KnowledgeNode | undefined;
  opportunity: Opportunity | undefined;
  contentIdea: ContentIdea | undefined;
  company: Company | undefined;
}

export function researchLinks(dataset: SovereignDataset, item: ResearchItem): ResearchLinks {
  return {
    knowledgeNode: dataset.knowledgeNodes.find((row) => row.id === item.knowledgeNodeId),
    opportunity: dataset.opportunities.find((row) => row.id === item.opportunityId),
    contentIdea: dataset.contentIdeas.find((row) => row.id === item.contentIdeaId),
    company: dataset.companies.find((row) => row.id === item.companyId),
  };
}
