import type { SovereignDataset } from '@/data/dataset';
import {
  companyHref,
  contentHref,
  decisionHref,
  documentHref,
  knowledgeHref,
  opportunityHref,
  personHref,
} from '@/app/href';
import { formatCurrencyCents } from '@/lib/format';
import {
  contentFormatLabel,
  contentStatusLabel,
  ideaScore,
  ideaStatusLabel,
} from '@/modules/content/content';
import { decisionStatusLabel } from '@/modules/decisions/decisions';
import { documentKindLabel, documentStatusLabel } from '@/modules/documents/documents';
import { knowledgeKindLabel } from '@/modules/knowledge/knowledge';
import { meetingKindLabel } from '@/modules/meetings/meetings';
import { memoryKindLabel, memoryScopeLabel } from '@/modules/memory/memory';
import { pipelineStageLabel } from '@/modules/pipeline/pipeline';
import { projectStatusLabel } from '@/modules/projects/projects';
import { promptIntentLabel } from '@/modules/prompts/prompts';
import { researchStatusLabel } from '@/modules/research/research';
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
  | 'idea'
  | 'campaign'
  | 'hook'
  | 'cta'
  | 'asset'
  | 'template'
  | 'integration'
  | 'notification'
  | 'approval'
  | 'knowledge'
  | 'memory'
  | 'document'
  | 'decision'
  | 'prompt'
  | 'research';

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
  idea: 'Idea',
  campaign: 'Campaign',
  hook: 'Hook',
  cta: 'CTA',
  asset: 'Asset',
  template: 'Template',
  integration: 'Integration',
  notification: 'Signal',
  approval: 'Approval',
  knowledge: 'Knowledge',
  memory: 'Memory',
  document: 'Document',
  decision: 'Decision',
  prompt: 'Prompt',
  research: 'Question',
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
      subtitle: [contentStatusLabel[item.status], contentFormatLabel[item.format], item.channel]
        .filter((part) => part.length > 0)
        .join(' · '),
      keywords: [item.body, item.videoScript, item.blockedReason ?? '', ...item.tags],
      route: contentHref(item.id),
      demo: item.source === 'demo',
    });
  }

  for (const idea of dataset.contentIdeas) {
    documents.push({
      id: `idea:${idea.id}`,
      kind: 'idea',
      title: idea.title,
      subtitle: `${ideaStatusLabel[idea.status]} · score ${ideaScore(idea).toFixed(1)}`,
      keywords: [idea.summary, idea.origin, ...idea.tags],
      route: idea.status === 'captured' ? '/content/ideas' : '/content/ideas?status=all',
      demo: idea.source === 'demo',
    });
  }

  for (const campaign of dataset.campaigns) {
    documents.push({
      id: `campaign:${campaign.id}`,
      kind: 'campaign',
      title: campaign.name,
      subtitle: campaign.status,
      keywords: [campaign.objective, campaign.goal],
      route: '/content/campaigns',
      demo: campaign.source === 'demo',
    });
  }

  for (const hook of dataset.hooks) {
    documents.push({
      id: `hook:${hook.id}`,
      kind: 'hook',
      title: hook.text,
      subtitle: `${hook.style} hook`,
      keywords: [hook.notes],
      route: '/content/library',
      demo: hook.source === 'demo',
    });
  }

  for (const cta of dataset.ctas) {
    documents.push({
      id: `cta:${cta.id}`,
      kind: 'cta',
      title: cta.text,
      subtitle: cta.intent.replace('_', ' '),
      keywords: [cta.notes, cta.destination],
      route: '/content/library?type=ctas',
      demo: cta.source === 'demo',
    });
  }

  for (const asset of dataset.contentAssets) {
    documents.push({
      id: `asset:${asset.id}`,
      kind: 'asset',
      title: asset.title,
      subtitle: asset.kind,
      keywords: [asset.notes, asset.location, ...asset.tags],
      route: '/content/library?type=assets',
      demo: asset.source === 'demo',
    });
  }

  for (const template of dataset.contentTemplates) {
    documents.push({
      id: `template:${template.id}`,
      kind: 'template',
      title: template.title,
      subtitle: contentFormatLabel[template.format],
      keywords: [template.structure, template.whenToUse],
      route: '/content/library?type=templates',
      demo: template.source === 'demo',
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

  for (const node of dataset.knowledgeNodes) {
    documents.push({
      id: `knowledge:${node.id}`,
      kind: 'knowledge',
      title: node.title,
      subtitle: [knowledgeKindLabel[node.kind], node.summary].filter((part) => part.length > 0).join(' · '),
      keywords: [node.body, node.origin, ...node.tags],
      route: knowledgeHref(node.id),
      demo: node.source === 'demo',
    });
  }

  for (const entry of dataset.memoryEntries) {
    documents.push({
      id: `memory:${entry.id}`,
      kind: 'memory',
      title: entry.statement,
      subtitle: `${memoryKindLabel[entry.kind]} · ${memoryScopeLabel[entry.scope]}`,
      keywords: [entry.detail, entry.origin, entry.confidence, ...entry.tags],
      route: entry.retiredAt === undefined ? '/memory' : '/memory?state=retired',
      demo: entry.source === 'demo',
    });
  }

  for (const document of dataset.documents) {
    documents.push({
      id: `document:${document.id}`,
      kind: 'document',
      title: document.title,
      subtitle: `${documentStatusLabel[document.status]} · ${documentKindLabel[document.kind]}`,
      // The body is indexed as text, exactly as it is rendered.
      keywords: [document.summary, document.body, document.location, ...document.tags],
      route: documentHref(document.id),
      demo: document.source === 'demo',
    });
  }

  for (const decision of dataset.decisions) {
    documents.push({
      id: `decision:${decision.id}`,
      kind: 'decision',
      title: decision.title,
      subtitle: [decisionStatusLabel[decision.status], decision.choice]
        .filter((part) => part.length > 0)
        .join(' · '),
      keywords: [decision.context, decision.rationale, ...decision.alternatives, ...decision.tags],
      route: decisionHref(decision.id),
      demo: decision.source === 'demo',
    });
  }

  for (const prompt of dataset.prompts) {
    documents.push({
      id: `prompt:${prompt.id}`,
      kind: 'prompt',
      title: prompt.title,
      subtitle: `${promptIntentLabel[prompt.intent]} · used ${String(prompt.useCount)}`,
      keywords: [prompt.body, prompt.notes, ...prompt.variables, ...prompt.tags],
      route: prompt.intent === 'draft' ? '/prompts' : `/prompts?intent=${prompt.intent}`,
      demo: prompt.source === 'demo',
    });
  }

  for (const item of dataset.researchItems) {
    documents.push({
      id: `research:${item.id}`,
      kind: 'research',
      title: item.question,
      subtitle: [researchStatusLabel[item.status], item.topic]
        .filter((part) => part.length > 0)
        .join(' · '),
      keywords: [item.answer, ...item.findings.map((finding) => finding.note), ...item.tags],
      route:
        item.status === 'queued' || item.status === 'active'
          ? '/research'
          : `/research?status=${item.status}`,
      demo: item.source === 'demo',
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
