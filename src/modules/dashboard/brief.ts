import type { SovereignDataset } from '@/data/dataset';
import { contentHref, normalizeInternalHref, opportunityHref } from '@/app/href';
import { DAY_MS, formatClockTime } from '@/lib/clock';
import { formatCurrencyCents, formatDelta, formatMetricValue } from '@/lib/format';
import { countByState } from '@/integrations/state';
import { dayAgenda } from '@/modules/calendar/calendar';
import {
  contentAwaitingApproval,
  contentDueToday,
  contentFormatLabel,
  contentStatusLabel,
} from '@/modules/content/content';
import { contentLearningInsights } from '@/modules/content/learning';
import {
  daysInStage,
  expectedValueCents,
  isStalled,
  pipelineStageLabel,
  selectOpportunities,
} from '@/modules/pipeline/pipeline';
import { isOverdue } from '@/modules/tasks/tasks';

export const BRIEF_QUESTIONS = [
  'attention',
  'opportunities',
  'today',
  'overnight',
  'blocked',
  'leverage',
] as const;

export type BriefQuestionId = (typeof BRIEF_QUESTIONS)[number];

export type BriefTone = 'critical' | 'warning' | 'info' | 'neutral';

export interface BriefItem {
  id: string;
  title: string;
  detail: string;
  meta: string;
  tone: BriefTone;
  /** True when the underlying record is demo data and must be badged. */
  demo: boolean;
  href?: string;
}

export interface BriefSection {
  id: BriefQuestionId;
  question: string;
  lens: string;
  items: BriefItem[];
  /** Matching rows before the density limit, so truncation is stated, not hidden. */
  total: number;
  emptyMessage: string;
}

export interface MorningBrief {
  generatedAt: string;
  sections: BriefSection[];
  demoItemCount: number;
}

const SECTION_LIMIT = 6;

/**
 * The attention question is the one the surface exists to answer, and Wave 3
 * gave it two more sources (overdue work and stalled deals). It gets a deeper cut
 * before truncation; every section still prints `shown/total` when it truncates.
 */
const ATTENTION_LIMIT = 9;

function isDemo(source: string): boolean {
  return source === 'demo';
}

function attentionSection(dataset: SovereignDataset, now: Date): BriefItem[] {
  const items: BriefItem[] = [];

  for (const notification of dataset.notifications) {
    if (notification.read || notification.severity === 'info') continue;
    items.push({
      id: `notification:${notification.id}`,
      title: notification.title,
      detail: notification.body,
      meta: notification.origin,
      tone: notification.severity === 'critical' ? 'critical' : 'warning',
      demo: isDemo(notification.source),
      href: normalizeInternalHref(notification.href, '/inbox'),
    });
  }

  // A content gate is listed once, against the package it holds up, so the
  // operator lands on the copy rather than on a queue row about the copy.
  const contentGates = new Set(
    dataset.contentItems
      .filter((item) => item.status === 'in_review' && item.approvalId !== undefined)
      .map((item) => item.approvalId),
  );

  for (const approval of dataset.approvals) {
    // A decided gate is no longer demanding attention, whatever its risk.
    if (approval.status !== 'pending' || approval.risk === 'info') continue;
    if (contentGates.has(approval.id)) continue;
    items.push({
      id: `approval:${approval.id}`,
      title: `Approval: ${approval.title}`,
      detail: approval.summary,
      meta: `Requested by ${approval.requestedBy}`,
      tone: approval.risk === 'critical' ? 'critical' : 'warning',
      demo: isDemo(approval.source),
      href: '/approvals',
    });
  }

  for (const item of contentAwaitingApproval(dataset)) {
    items.push({
      id: `content:${item.id}`,
      title: `Approval: ${item.title}`,
      detail:
        item.approvalId === undefined
          ? 'In review with no gate attached.'
          : 'Customer-facing copy holding an open gate in the Approval Queue.',
      meta: `${contentFormatLabel[item.format]}${item.channel.length > 0 ? ` · ${item.channel}` : ''}`,
      tone: 'warning',
      demo: isDemo(item.source),
      href: contentHref(item.id),
    });
  }

  for (const task of dataset.tasks.filter((task) => isOverdue(task, now))) {
    items.push({
      id: `task:${task.id}`,
      title: `Overdue: ${task.title}`,
      detail: task.context,
      meta: task.priority,
      tone: task.priority === 'critical' ? 'critical' : 'warning',
      demo: isDemo(task.source),
      href: '/tasks?status=open',
    });
  }

  // A deal that has not moved in two weeks is asking for a decision as loudly
  // as an open gate; the pipeline is where that decision gets made.
  for (const opportunity of dataset.opportunities) {
    if (!isStalled(opportunity, now)) continue;
    const days = daysInStage(opportunity, now);
    items.push({
      id: `opportunity:${opportunity.id}`,
      title: `Stalled: ${opportunity.name}`,
      detail:
        opportunity.nextStep.length > 0
          ? `Next step on the record: ${opportunity.nextStep}.`
          : 'No next step is recorded, so nothing will move it.',
      meta: `${pipelineStageLabel[opportunity.stage]} · ${days === null ? '—' : `${String(days)}d`}`,
      tone: 'warning',
      demo: isDemo(opportunity.source),
      href: opportunityHref(opportunity.id),
    });
  }

  const counts = countByState(dataset.integrations);
  if (counts.awaiting_credentials > 0) {
    items.push({
      id: 'integrations:awaiting',
      title: `${String(counts.awaiting_credentials)} integrations await credentials`,
      detail: 'No external system can act until these are configured.',
      meta: 'Integration registry',
      tone: 'warning',
      demo: false,
      href: '/integrations',
    });
  }

  const toneOrder: Record<BriefTone, number> = { critical: 0, warning: 1, info: 2, neutral: 3 };
  return items.sort((a, b) => toneOrder[a.tone] - toneOrder[b.tone]);
}

/** Reads the pipeline module's own selector so the Brief and `/pipeline` agree. */
function opportunitySection(dataset: SovereignDataset): BriefItem[] {
  const companies = new Map(dataset.companies.map((company) => [company.id, company.name]));

  return selectOpportunities(dataset, 'open').map((opportunity) => ({
    id: `opportunity:${opportunity.id}`,
    title: opportunity.name,
    detail: [
      opportunity.companyId ? companies.get(opportunity.companyId) : undefined,
      pipelineStageLabel[opportunity.stage],
      opportunity.signal,
    ]
      .filter(Boolean)
      .join(' · '),
    meta: `${formatCurrencyCents(expectedValueCents(opportunity))} exp · ${String(opportunity.probability)}%`,
    tone: opportunity.probability >= 60 ? 'info' : 'neutral',
    demo: isDemo(opportunity.source),
    href: opportunityHref(opportunity.id),
  }));
}

/**
 * Today is the calendar's own agenda — meetings and work due before midnight —
 * plus work already in flight, which has no time but is the thing being done.
 */
function todaySection(dataset: SovereignDataset, now: Date): BriefItem[] {
  // Blocked work belongs to the blocked question, not to today's plan.
  const blocked = new Set(
    dataset.tasks.filter((task) => task.status === 'blocked').map((task) => task.id),
  );

  const items: BriefItem[] = dayAgenda(dataset, now)
    .filter((entry) => !entry.done && !(entry.kind === 'task' && blocked.has(entry.recordId)))
    .map((entry) => ({
      id: `${entry.kind}:${entry.recordId}`,
      title: entry.kind === 'meeting' ? `${formatClockTime(new Date(entry.at))} ${entry.title}` : entry.title,
      detail: entry.detail,
      meta: entry.meta,
      tone: entry.kind === 'meeting' ? 'info' : 'neutral',
      demo: entry.demo,
      href: entry.kind === 'meeting' ? '/meetings' : '/tasks?status=open',
    }));

  const alreadyListed = new Set(items.map((item) => item.id));
  for (const task of dataset.tasks) {
    if (task.status !== 'in_progress') continue;
    if (alreadyListed.has(`task:${task.id}`)) continue;
    items.push({
      id: `task:${task.id}`,
      title: task.title,
      detail: task.context,
      meta: [task.priority, 'in progress'].join(' · '),
      tone: task.priority === 'critical' ? 'critical' : 'neutral',
      demo: isDemo(task.source),
      href: '/tasks?status=in_progress',
    });
  }

  // Content carries a publish date rather than a due date, so it is not on the
  // calendar's agenda; today's plan is incomplete without it.
  for (const item of contentDueToday(dataset, now)) {
    items.push({
      id: `content:${item.id}`,
      title: `${formatClockTime(new Date(item.scheduledFor ?? ''))} ${item.title}`,
      detail:
        item.status === 'scheduled' || item.status === 'approved'
          ? 'Due to publish today. Publishing is recorded by hand.'
          : `Dated today and still ${contentStatusLabel[item.status].toLowerCase()}.`,
      meta: `${contentFormatLabel[item.format]}${item.channel.length > 0 ? ` · ${item.channel}` : ''}`,
      tone: item.status === 'scheduled' || item.status === 'approved' ? 'info' : 'neutral',
      demo: isDemo(item.source),
      href: contentHref(item.id),
    });
  }

  // Meetings and dated work in clock order, then undated work in flight.
  return items;
}

function blockedProjects(dataset: SovereignDataset): BriefItem[] {
  return dataset.projects
    .filter((project) => project.status === 'blocked')
    .map((project) => ({
      id: `project:${project.id}`,
      title: project.title,
      detail: project.blockedReason ?? 'No reason recorded.',
      meta: 'project',
      tone: 'warning' as const,
      demo: isDemo(project.source),
      href: '/projects?status=blocked',
    }));
}

function overnightSection(dataset: SovereignDataset, now: Date): BriefItem[] {
  const since = now.getTime() - DAY_MS;

  return dataset.events
    .filter((event) => {
      const at = Date.parse(event.at);
      return !Number.isNaN(at) && at >= since && at <= now.getTime();
    })
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .map((event) => ({
      id: `event:${event.id}`,
      title: event.title,
      detail: event.detail,
      meta: event.channel,
      tone: event.channel === 'automation' ? 'warning' : 'info',
      demo: isDemo(event.source),
    }));
}

function blockedSection(dataset: SovereignDataset): BriefItem[] {
  const items: BriefItem[] = [];

  for (const task of dataset.tasks) {
    if (task.status !== 'blocked') continue;
    items.push({
      id: `task:${task.id}`,
      title: task.title,
      detail: task.blockedReason ?? 'No reason recorded.',
      meta: task.blockedSince ? `blocked since ${task.blockedSince.slice(0, 10)}` : 'task',
      tone: 'warning',
      demo: isDemo(task.source),
      href: '/tasks?status=blocked',
    });
  }

  items.push(...blockedProjects(dataset));

  for (const mission of dataset.missions) {
    if (mission.status !== 'blocked') continue;
    items.push({
      id: `mission:${mission.id}`,
      title: `${mission.code} · ${mission.title}`,
      detail: mission.blockedReason ?? 'No reason recorded.',
      meta: `${String(mission.progress)}% complete`,
      tone: 'critical',
      demo: isDemo(mission.source),
    });
  }

  for (const item of dataset.contentItems) {
    if (item.status !== 'blocked') continue;
    items.push({
      id: `content:${item.id}`,
      title: item.title,
      detail: item.blockedReason ?? 'No reason recorded.',
      meta: item.channel,
      tone: 'warning',
      demo: isDemo(item.source),
      href: contentHref(item.id),
    });
  }

  return items;
}

function leverageSection(dataset: SovereignDataset): BriefItem[] {
  const items: BriefItem[] = [...dataset.metrics]
    .sort((a, b) => Math.abs(b.deltaPercent) - Math.abs(a.deltaPercent))
    .map((metric) => ({
      id: `metric:${metric.id}`,
      title: metric.label,
      detail: metric.origin,
      meta: `${formatMetricValue(metric.value, metric.unit)} · ${formatDelta(metric.deltaPercent)} ${metric.window}`,
      tone: metric.deltaPercent > 0 ? 'info' : metric.deltaPercent < 0 ? 'warning' : 'neutral',
      demo: isDemo(metric.source),
    }));

  // One learning insight, counted from recorded readings. It leads the section
  // because it is the only line here derived from outcomes rather than inputs.
  const [insight] = contentLearningInsights(dataset);
  if (insight) {
    items.unshift({
      id: insight.id,
      title: insight.headline,
      detail: insight.detail,
      meta: insight.evidence,
      tone: 'info',
      demo: dataset.contentMetrics.some((metric) => metric.source === 'demo'),
      href: '/content/analytics',
    });
  }

  return items;
}

/**
 * The six questions the Command Center exists to answer
 * (ARCHITECTURE_AUDIT §5.4). Pure over the dataset so it is testable and can be
 * repointed at a remote read-model later without touching the UI.
 */
export function buildMorningBrief(dataset: SovereignDataset, now: Date): MorningBrief {
  const sections: BriefSection[] = ([
    {
      id: 'attention',
      question: 'What needs attention?',
      lens: 'Unread signals, open gates, and anything already past due.',
      items: attentionSection(dataset, now),
      emptyMessage: 'Nothing is demanding a decision.',
    },
    {
      id: 'opportunities',
      question: 'What opportunities exist?',
      lens: 'Open pipeline ranked by expected value.',
      items: opportunitySection(dataset),
      emptyMessage: 'No open opportunities in the local store.',
    },
    {
      id: 'today',
      question: 'What should I do today?',
      lens: 'Work in flight or due before midnight, highest priority first.',
      items: todaySection(dataset, now),
      emptyMessage: 'Nothing is scheduled for today.',
    },
    {
      id: 'overnight',
      question: 'What changed overnight?',
      lens: 'Every recorded event in the last 24 hours.',
      items: overnightSection(dataset, now),
      emptyMessage: 'No activity recorded in the last 24 hours.',
    },
    {
      id: 'blocked',
      question: 'What is blocked?',
      lens: 'Work that cannot move and the reason it cannot.',
      items: blockedSection(dataset),
      emptyMessage: 'Nothing is blocked.',
    },
    {
      id: 'leverage',
      question: 'What is producing leverage?',
      lens: 'Measured movement, largest change first.',
      items: leverageSection(dataset),
      emptyMessage: 'No leverage metrics recorded.',
    },
  ] satisfies Omit<BriefSection, 'total'>[]).map((section) => ({
    ...section,
    total: section.items.length,
    items: section.items.slice(0, section.id === 'attention' ? ATTENTION_LIMIT : SECTION_LIMIT),
  }));

  const demoItemCount = sections
    .flatMap((section) => section.items)
    .filter((item) => item.demo).length;

  return { generatedAt: now.toISOString(), sections, demoItemCount };
}
