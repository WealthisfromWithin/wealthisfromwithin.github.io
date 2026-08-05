import type { SovereignDataset } from '@/data/dataset';
import { companyHref, opportunityHref, personHref } from '@/app/href';
import { formatCurrencyCents } from '@/lib/format';
import { meetingKindLabel } from '@/modules/meetings/meetings';
import { pipelineStageLabel } from '@/modules/pipeline/pipeline';
import { projectStatusLabel } from '@/modules/projects/projects';
import { taskStatusLabel } from '@/modules/tasks/tasks';
import { rankByFuzzy, type RankedResult } from './fuzzy';

export type SearchKind =
  | 'person'
  | 'company'
  | 'task'
  | 'project'
  | 'meeting'
  | 'mission'
  | 'opportunity'
  | 'content'
  | 'integration'
  | 'notification'
  | 'approval';

export interface SearchDocument {
  id: string;
  kind: SearchKind;
  title: string;
  subtitle: string;
  keywords: string[];
  route: string;
  demo: boolean;
}

export const searchKindLabel: Record<SearchKind, string> = {
  person: 'Person',
  company: 'Company',
  task: 'Task',
  project: 'Project',
  meeting: 'Meeting',
  mission: 'Mission',
  opportunity: 'Opportunity',
  content: 'Content',
  integration: 'Integration',
  notification: 'Signal',
  approval: 'Approval',
};

/**
 * Flattens the local store into one searchable surface. Routes point only at
 * modules that exist; records whose module is not built yet resolve to the
 * brief rather than a dead link.
 */
export function buildSearchIndex(dataset: SovereignDataset): SearchDocument[] {
  const companies = new Map(dataset.companies.map((company) => [company.id, company.name]));
  const documents: SearchDocument[] = [];

  for (const person of dataset.people) {
    documents.push({
      id: `person:${person.id}`,
      kind: 'person',
      title: person.name,
      subtitle: [person.role, person.companyId ? companies.get(person.companyId) : undefined]
        .filter(Boolean)
        .join(' · '),
      keywords: [...person.tags, person.email ?? '', person.notes],
      route: personHref(person.id),
      demo: person.source === 'demo',
    });
  }

  for (const company of dataset.companies) {
    documents.push({
      id: `company:${company.id}`,
      kind: 'company',
      title: company.name,
      subtitle: [company.segment, company.status].filter(Boolean).join(' · '),
      keywords: [company.domain ?? ''],
      route: companyHref(company.id),
      demo: company.source === 'demo',
    });
  }

  for (const task of dataset.tasks) {
    documents.push({
      id: `task:${task.id}`,
      kind: 'task',
      title: task.title,
      subtitle: `${taskStatusLabel[task.status]} · ${task.priority}`,
      keywords: [task.context, task.blockedReason ?? ''],
      route: task.status === 'done' ? '/tasks?status=done' : '/tasks',
      demo: task.source === 'demo',
    });
  }

  for (const project of dataset.projects) {
    documents.push({
      id: `project:${project.id}`,
      kind: 'project',
      title: project.title,
      subtitle: projectStatusLabel[project.status],
      keywords: [project.objective, project.blockedReason ?? ''],
      route: '/projects?status=all',
      demo: project.source === 'demo',
    });
  }

  for (const meeting of dataset.meetings) {
    documents.push({
      id: `meeting:${meeting.id}`,
      kind: 'meeting',
      title: meeting.title,
      subtitle: [
        meetingKindLabel[meeting.kind],
        meeting.companyId ? companies.get(meeting.companyId) : undefined,
      ]
        .filter(Boolean)
        .join(' · '),
      keywords: [meeting.notes, meeting.location],
      route: '/meetings?when=all',
      demo: meeting.source === 'demo',
    });
  }

  for (const mission of dataset.missions) {
    documents.push({
      id: `mission:${mission.id}`,
      kind: 'mission',
      title: `${mission.code} · ${mission.title}`,
      subtitle: mission.status,
      keywords: [mission.objective],
      route: '/',
      demo: mission.source === 'demo',
    });
  }

  for (const opportunity of dataset.opportunities) {
    documents.push({
      id: `opportunity:${opportunity.id}`,
      kind: 'opportunity',
      title: opportunity.name,
      subtitle: `${pipelineStageLabel[opportunity.stage]} · ${formatCurrencyCents(opportunity.valueCents)}`,
      keywords: [opportunity.nextStep, opportunity.signal, opportunity.leadSource],
      route: opportunityHref(opportunity.id),
      demo: opportunity.source === 'demo',
    });
  }

  for (const item of dataset.contentItems) {
    documents.push({
      id: `content:${item.id}`,
      kind: 'content',
      title: item.title,
      subtitle: `${item.status} · ${item.channel}`,
      keywords: [item.blockedReason ?? ''],
      route: '/',
      demo: item.source === 'demo',
    });
  }

  for (const integration of dataset.integrations) {
    documents.push({
      id: `integration:${integration.id}`,
      kind: 'integration',
      title: integration.name,
      subtitle: integration.state.replace('_', ' '),
      keywords: [...integration.capabilities, integration.category],
      route: '/integrations',
      demo: integration.source === 'demo',
    });
  }

  for (const notification of dataset.notifications) {
    documents.push({
      id: `notification:${notification.id}`,
      kind: 'notification',
      title: notification.title,
      subtitle: [notification.origin, notification.read ? 'read' : 'unread']
        .filter(Boolean)
        .join(' · '),
      keywords: [notification.body, notification.severity],
      route: '/inbox',
      demo: notification.source === 'demo',
    });
  }

  for (const approval of dataset.approvals) {
    documents.push({
      id: `approval:${approval.id}`,
      kind: 'approval',
      title: approval.title,
      subtitle: `${approval.status} · ${approval.kind} · ${approval.risk} risk`,
      keywords: [approval.summary, approval.requestedBy],
      route: approval.status === 'pending' ? '/approvals' : '/approvals?status=all',
      demo: approval.source === 'demo',
    });
  }

  return documents;
}

export function searchDocuments(
  query: string,
  documents: readonly SearchDocument[],
  limit = 12,
): RankedResult<SearchDocument>[] {
  if (query.trim().length === 0) return [];
  return rankByFuzzy(
    query,
    documents,
    (document) => [document.title, document.subtitle, document.keywords.join(' ')],
    { limit, minScore: 0 },
  );
}

export * from './fuzzy';
