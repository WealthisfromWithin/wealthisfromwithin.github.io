import type { SovereignDataset } from '@/data/dataset';
import { normalizeInternalHref } from '@/app/href';
import { DAY_MS, startOfDay, endOfDay } from '@/lib/clock';
import { formatCurrencyCents, formatDelta, formatMetricValue } from '@/lib/format';
import { priorityRank } from '@/domain';
import { countByState } from '@/integrations/state';

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

  for (const approval of dataset.approvals) {
    // A decided gate is no longer demanding attention, whatever its risk.
    if (approval.status !== 'pending' || approval.risk === 'info') continue;
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

  const overdue = dataset.tasks.filter(
    (task) => task.status !== 'done' && task.dueAt !== undefined && Date.parse(task.dueAt) < now.getTime(),
  );
  for (const task of overdue) {
    items.push({
      id: `task:${task.id}`,
      title: `Overdue: ${task.title}`,
      detail: task.context,
      meta: task.priority,
      tone: task.priority === 'critical' ? 'critical' : 'warning',
      demo: isDemo(task.source),
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

function opportunitySection(dataset: SovereignDataset): BriefItem[] {
  const companies = new Map(dataset.companies.map((company) => [company.id, company.name]));

  return dataset.opportunities
    .filter((opportunity) => opportunity.stage !== 'won' && opportunity.stage !== 'lost')
    .sort(
      (a, b) => b.valueCents * b.probability - a.valueCents * a.probability,
    )
    .map((opportunity) => ({
      id: `opportunity:${opportunity.id}`,
      title: opportunity.name,
      detail: [
        opportunity.companyId ? companies.get(opportunity.companyId) : undefined,
        opportunity.stage,
        opportunity.signal,
      ]
        .filter(Boolean)
        .join(' · '),
      meta: `${formatCurrencyCents(opportunity.valueCents)} · ${String(opportunity.probability)}%`,
      tone: opportunity.probability >= 60 ? 'info' : 'neutral',
      demo: isDemo(opportunity.source),
    }));
}

function todaySection(dataset: SovereignDataset, now: Date): BriefItem[] {
  const dayStart = startOfDay(now).getTime();
  const dayEnd = endOfDay(now).getTime();

  const candidates = dataset.tasks.filter((task) => {
    if (task.status === 'done' || task.status === 'blocked') return false;
    if (task.status === 'in_progress') return true;
    if (!task.dueAt) return false;
    const due = Date.parse(task.dueAt);
    return due >= dayStart && due <= dayEnd;
  });

  return candidates
    .sort((a, b) => {
      const byPriority = priorityRank[a.priority] - priorityRank[b.priority];
      if (byPriority !== 0) return byPriority;
      return (a.dueAt ? Date.parse(a.dueAt) : Number.MAX_SAFE_INTEGER) -
        (b.dueAt ? Date.parse(b.dueAt) : Number.MAX_SAFE_INTEGER);
    })
    .map((task) => ({
      id: `task:${task.id}`,
      title: task.title,
      detail: task.context,
      meta: [
        task.priority,
        task.status === 'in_progress' ? 'in progress' : null,
        task.estimateMinutes ? `${String(task.estimateMinutes)}m` : null,
      ]
        .filter((part): part is string => Boolean(part))
        .join(' · '),
      tone: task.priority === 'critical' ? 'critical' : task.priority === 'high' ? 'warning' : 'neutral',
      demo: isDemo(task.source),
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
    });
  }

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
    });
  }

  return items;
}

function leverageSection(dataset: SovereignDataset): BriefItem[] {
  return [...dataset.metrics]
    .sort((a, b) => Math.abs(b.deltaPercent) - Math.abs(a.deltaPercent))
    .map((metric) => ({
      id: `metric:${metric.id}`,
      title: metric.label,
      detail: metric.origin,
      meta: `${formatMetricValue(metric.value, metric.unit)} · ${formatDelta(metric.deltaPercent)} ${metric.window}`,
      tone: metric.deltaPercent > 0 ? 'info' : metric.deltaPercent < 0 ? 'warning' : 'neutral',
      demo: isDemo(metric.source),
    }));
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
    items: section.items.slice(0, SECTION_LIMIT),
  }));

  const demoItemCount = sections
    .flatMap((section) => section.items)
    .filter((item) => item.demo).length;

  return { generatedAt: now.toISOString(), sections, demoItemCount };
}
