import type { SovereignDataset } from '@/data/dataset';
import type { Meeting, Opportunity, PipelineStage, Task } from '@/domain';
import { pipelineStageSchema } from '@/domain';
import { DAY_MS } from '@/lib/clock';

/**
 * Stage order is the LeadScheduler progression adapted to the enum this store
 * already ships (`ARCHITECTURE_AUDIT` §5.5): Prospecting → Outreach → Qualified
 * → Meeting Booked → Proposal → Won/Lost maps onto identified → contacted →
 * engaged → qualified → proposal → negotiation → won/lost. The doctrine is the
 * shape — one ordered funnel with explicit closed states — not the labels.
 */
export const PIPELINE_STAGES: readonly PipelineStage[] = pipelineStageSchema.options;

export const CLOSED_STAGES: readonly PipelineStage[] = ['won', 'lost'];

export const OPEN_STAGES: readonly PipelineStage[] = PIPELINE_STAGES.filter(
  (stage) => !CLOSED_STAGES.includes(stage),
);

export const pipelineStageLabel: Record<PipelineStage, string> = {
  identified: 'Identified',
  contacted: 'Contacted',
  engaged: 'Engaged',
  qualified: 'Qualified',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
};

export const PIPELINE_STAGE_FILTERS = ['open', 'all', ...PIPELINE_STAGES] as const;
export type PipelineStageFilter = (typeof PIPELINE_STAGE_FILTERS)[number];

export const stageFilterLabel: Record<PipelineStageFilter, string> = {
  open: 'Open',
  all: 'All',
  ...pipelineStageLabel,
};

export function parseStageFilter(value: string | null): PipelineStageFilter {
  return PIPELINE_STAGE_FILTERS.find((filter) => filter === value) ?? 'open';
}

export function isOpenStage(stage: PipelineStage): boolean {
  return !CLOSED_STAGES.includes(stage);
}

/** The stage after this one, or `null` at the end of the open funnel. */
export function nextOpenStage(stage: PipelineStage): PipelineStage | null {
  const index = OPEN_STAGES.indexOf(stage);
  if (index < 0) return null;
  return OPEN_STAGES[index + 1] ?? null;
}

/** Value × probability, both read from the record. Nothing is modelled here. */
export function expectedValueCents(opportunity: Opportunity): number {
  return Math.round((opportunity.valueCents * opportunity.probability) / 100);
}

export interface StageSummary {
  stage: PipelineStage;
  label: string;
  count: number;
  valueCents: number;
  expectedValueCents: number;
}

export interface PipelineSummary {
  openCount: number;
  openValueCents: number;
  expectedValueCents: number;
  wonCount: number;
  wonValueCents: number;
  lostCount: number;
  stalledCount: number;
  byStage: StageSummary[];
}

/** Days with no stage movement. A stalled deal is the pipeline's real signal. */
export const STALL_DAYS = 14;

export function daysInStage(opportunity: Opportunity, now: Date): number | null {
  const since = opportunity.stageChangedAt ?? opportunity.updatedAt;
  const parsed = Date.parse(since);
  if (Number.isNaN(parsed)) return null;
  return Math.floor((now.getTime() - parsed) / DAY_MS);
}

export function isStalled(opportunity: Opportunity, now: Date): boolean {
  if (!isOpenStage(opportunity.stage)) return false;
  const days = daysInStage(opportunity, now);
  return days !== null && days >= STALL_DAYS;
}

export function pipelineSummary(dataset: SovereignDataset, now: Date): PipelineSummary {
  const open = dataset.opportunities.filter((row) => isOpenStage(row.stage));
  const won = dataset.opportunities.filter((row) => row.stage === 'won');

  return {
    openCount: open.length,
    openValueCents: open.reduce((total, row) => total + row.valueCents, 0),
    expectedValueCents: open.reduce((total, row) => total + expectedValueCents(row), 0),
    wonCount: won.length,
    wonValueCents: won.reduce((total, row) => total + row.valueCents, 0),
    lostCount: dataset.opportunities.filter((row) => row.stage === 'lost').length,
    stalledCount: open.filter((row) => isStalled(row, now)).length,
    byStage: PIPELINE_STAGES.map((stage) => {
      const rows = dataset.opportunities.filter((row) => row.stage === stage);
      return {
        stage,
        label: pipelineStageLabel[stage],
        count: rows.length,
        valueCents: rows.reduce((total, row) => total + row.valueCents, 0),
        expectedValueCents: rows.reduce((total, row) => total + expectedValueCents(row), 0),
      };
    }),
  };
}

/** Highest expected value first, because that is what the next hour should serve. */
export function selectOpportunities(
  dataset: SovereignDataset,
  filter: PipelineStageFilter = 'open',
): Opportunity[] {
  return dataset.opportunities
    .filter((opportunity) => {
      if (filter === 'all') return true;
      if (filter === 'open') return isOpenStage(opportunity.stage);
      return opportunity.stage === filter;
    })
    .sort(
      (a, b) =>
        expectedValueCents(b) - expectedValueCents(a) || a.name.localeCompare(b.name),
    );
}

export interface StageColumn extends StageSummary {
  opportunities: Opportunity[];
}

/** Open stages only: a board of closed columns is a report, not a work surface. */
export function stageBoard(dataset: SovereignDataset): StageColumn[] {
  return OPEN_STAGES.map((stage) => {
    const opportunities = selectOpportunities(dataset, stage);
    return {
      stage,
      label: pipelineStageLabel[stage],
      count: opportunities.length,
      valueCents: opportunities.reduce((total, row) => total + row.valueCents, 0),
      expectedValueCents: opportunities.reduce((total, row) => total + expectedValueCents(row), 0),
      opportunities,
    };
  });
}

export type LeadSignalTone = 'critical' | 'warning' | 'info' | 'neutral';

export interface LeadSignal {
  id: string;
  label: string;
  detail: string;
  tone: LeadSignalTone;
}

export interface LeadIntelligence {
  opportunity: Opportunity;
  companyName: string | undefined;
  contactName: string | undefined;
  daysInStage: number | null;
  stalled: boolean;
  expectedValueCents: number;
  tasks: Task[];
  meetings: Meeting[];
  nextMeeting: Meeting | undefined;
  signals: LeadSignal[];
}

/**
 * Lead intelligence is read off the record and the local joins around it. Each
 * signal names its own evidence; there is no score and no inference.
 */
export function leadIntelligence(
  dataset: SovereignDataset,
  opportunityId: string,
  now: Date,
): LeadIntelligence | null {
  const opportunity = dataset.opportunities.find((row) => row.id === opportunityId);
  if (!opportunity) return null;

  const company = dataset.companies.find((row) => row.id === opportunity.companyId);
  const contact = dataset.people.find((row) => row.id === opportunity.personId);
  const tasks = dataset.tasks
    .filter((task) => task.opportunityId === opportunity.id)
    .sort((a, b) => {
      if (a.status !== b.status) {
        if (a.status === 'done') return 1;
        if (b.status === 'done') return -1;
      }
      return (
        (a.dueAt ? Date.parse(a.dueAt) : Number.MAX_SAFE_INTEGER) -
        (b.dueAt ? Date.parse(b.dueAt) : Number.MAX_SAFE_INTEGER)
      );
    });
  const meetings = dataset.meetings
    .filter((meeting) => meeting.opportunityId === opportunity.id)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));

  const days = daysInStage(opportunity, now);
  const stalled = isStalled(opportunity, now);
  const nextMeeting = meetings.find((meeting) => Date.parse(meeting.startsAt) >= now.getTime());
  const signals: LeadSignal[] = [];

  signals.push({
    id: 'stage',
    label: `Stage · ${pipelineStageLabel[opportunity.stage]}`,
    detail:
      days === null
        ? 'No stage change has been recorded.'
        : `${String(days)} ${days === 1 ? 'day' : 'days'} in this stage.`,
    tone: stalled ? 'warning' : 'neutral',
  });

  if (stalled) {
    signals.push({
      id: 'stalled',
      label: 'Stalled',
      detail: `No stage movement in ${String(STALL_DAYS)} days or more.`,
      tone: 'critical',
    });
  }

  if (opportunity.nextStep.length === 0) {
    signals.push({
      id: 'next-step-missing',
      label: 'No next step',
      detail: 'The record names no next action, so nothing will move it.',
      tone: 'critical',
    });
  } else {
    const dueAt = opportunity.nextStepAt ? Date.parse(opportunity.nextStepAt) : null;
    const overdue = dueAt !== null && dueAt < now.getTime();
    signals.push({
      id: 'next-step',
      label: `Next step · ${opportunity.nextStep}`,
      detail:
        dueAt === null
          ? 'No date set for the next step.'
          : overdue
            ? 'Past its date.'
            : 'Scheduled.',
      tone: overdue ? 'warning' : 'info',
    });
  }

  if (contact) {
    signals.push({
      id: 'contact',
      label: `Contact · ${contact.name}`,
      detail: `Relationship strength ${String(contact.relationshipStrength)} recorded on the person.`,
      tone: contact.relationshipStrength >= 60 ? 'info' : 'warning',
    });
  } else {
    signals.push({
      id: 'contact-missing',
      label: 'No named contact',
      detail: 'The opportunity is attached to no person in the store.',
      tone: 'warning',
    });
  }

  signals.push({
    id: 'lead-source',
    label: opportunity.leadSource.length > 0 ? `Source · ${opportunity.leadSource}` : 'Source unrecorded',
    detail:
      opportunity.leadSource.length > 0
        ? 'Recorded when the lead was created.'
        : 'Nothing recorded about how this lead arrived.',
    tone: opportunity.leadSource.length > 0 ? 'neutral' : 'warning',
  });

  if (opportunity.signal.length > 0) {
    signals.push({
      id: 'observed',
      label: 'Observed signal',
      detail: opportunity.signal,
      tone: 'info',
    });
  }

  signals.push({
    id: 'meetings',
    label: nextMeeting ? `Next meeting · ${nextMeeting.title}` : 'No meeting scheduled',
    detail: nextMeeting
      ? new Date(nextMeeting.startsAt).toLocaleString('en-US', {
          weekday: 'short',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      : `${String(meetings.length)} recorded ${meetings.length === 1 ? 'meeting' : 'meetings'}, none upcoming.`,
    tone: nextMeeting ? 'info' : 'warning',
  });

  return {
    opportunity,
    companyName: company?.name,
    contactName: contact?.name,
    daysInStage: days,
    stalled,
    expectedValueCents: expectedValueCents(opportunity),
    tasks,
    meetings,
    nextMeeting,
    signals,
  };
}
