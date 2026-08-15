import type { SovereignDataset } from '@/data/dataset';
import type {
  Campaign,
  ContentItem,
  Mission,
  MissionStatus,
  Opportunity,
  Project,
  Task,
} from '@/domain';
import { isPastDue } from '@/domain';

/**
 * Mission Control reads objectives against the work that actually serves them.
 *
 * The stored `progress` is a number the operator declared. Everything else here
 * is counted from linked records: tasks done over tasks linked, value on
 * opportunities pointing at the mission, packages in the campaigns it owns. Both
 * are rendered, and the surface says which is which — that distinction is the
 * whole point of the module.
 */

export const missionStatusLabel: Record<MissionStatus, string> = {
  active: 'Active',
  blocked: 'Blocked',
  paused: 'Paused',
  complete: 'Complete',
};

export type MissionTone = 'critical' | 'warning' | 'info' | 'neutral' | 'muted' | 'sentinel';

export function missionStatusTone(status: MissionStatus): MissionTone {
  switch (status) {
    case 'active':
      return 'info';
    case 'blocked':
      return 'critical';
    case 'paused':
      return 'muted';
    case 'complete':
      return 'sentinel';
  }
}

export const MISSION_FILTERS = ['open', 'active', 'blocked', 'paused', 'complete', 'all'] as const;
export type MissionFilter = (typeof MISSION_FILTERS)[number];

export const missionFilterLabel: Record<MissionFilter, string> = {
  open: 'Open',
  all: 'All',
  ...missionStatusLabel,
};

export function parseMissionFilter(value: string | null): MissionFilter {
  return MISSION_FILTERS.find((filter) => filter === value) ?? 'open';
}

export interface MissionRollup {
  mission: Mission;
  projects: Project[];
  tasks: Task[];
  openTasks: number;
  doneTasks: number;
  overdueTasks: number;
  blockedTasks: number;
  opportunities: Opportunity[];
  openValueCents: number;
  wonValueCents: number;
  campaigns: Campaign[];
  contentItems: ContentItem[];
  publishedContent: number;
  /** Tasks done over tasks linked, or null when nothing is linked to count. */
  countedProgress: number | null;
  /** What the operator typed. Kept separate from the count on purpose. */
  declaredProgress: number;
  /** The soonest date any linked record carries, so an objective has a horizon. */
  nextDateAt: string | undefined;
  /** Reasons written on linked work that cannot move. */
  blockers: string[];
}

function soonest(values: readonly (string | undefined)[]): string | undefined {
  return values
    .filter((value): value is string => value !== undefined && !Number.isNaN(Date.parse(value)))
    .sort((a, b) => Date.parse(a) - Date.parse(b))[0];
}

export function missionRollup(
  dataset: SovereignDataset,
  mission: Mission,
  now: Date,
): MissionRollup {
  const projects = dataset.projects.filter((project) => project.missionId === mission.id);
  const projectIds = new Set(projects.map((project) => project.id));

  // A task serves an objective directly or through the project it belongs to.
  const tasks = dataset.tasks.filter(
    (task) =>
      task.missionId === mission.id ||
      (task.projectId !== undefined && projectIds.has(task.projectId)),
  );

  const opportunities = dataset.opportunities.filter(
    (opportunity) => opportunity.missionId === mission.id,
  );
  const campaigns = dataset.campaigns.filter((campaign) => campaign.missionId === mission.id);
  const campaignIds = new Set(campaigns.map((campaign) => campaign.id));
  const contentItems = dataset.contentItems.filter(
    (item) => item.campaignId !== undefined && campaignIds.has(item.campaignId),
  );

  const doneTasks = tasks.filter((task) => task.status === 'done').length;
  const open = opportunities.filter(
    (opportunity) => opportunity.stage !== 'won' && opportunity.stage !== 'lost',
  );

  return {
    mission,
    projects,
    tasks,
    openTasks: tasks.length - doneTasks,
    doneTasks,
    overdueTasks: tasks.filter((task) => task.status !== 'done' && isPastDue(task.dueAt, now))
      .length,
    blockedTasks: tasks.filter((task) => task.status === 'blocked').length,
    opportunities,
    openValueCents: open.reduce((total, opportunity) => total + opportunity.valueCents, 0),
    wonValueCents: opportunities
      .filter((opportunity) => opportunity.stage === 'won')
      .reduce((total, opportunity) => total + opportunity.valueCents, 0),
    campaigns,
    contentItems,
    publishedContent: contentItems.filter((item) => item.status === 'published').length,
    countedProgress: tasks.length === 0 ? null : Math.round((doneTasks / tasks.length) * 100),
    declaredProgress: mission.progress,
    nextDateAt: soonest([
      mission.dueAt,
      ...tasks.filter((task) => task.status !== 'done').map((task) => task.dueAt),
      ...projects.map((project) => project.dueAt),
      ...open.map((opportunity) => opportunity.nextStepAt),
    ]),
    blockers: [
      mission.status === 'blocked' ? (mission.blockedReason ?? 'No reason recorded.') : undefined,
      ...tasks
        .filter((task) => task.status === 'blocked')
        .map((task) => task.blockedReason ?? `${task.title}: no reason recorded.`),
      ...projects
        .filter((project) => project.status === 'blocked')
        .map((project) => project.blockedReason ?? `${project.title}: no reason recorded.`),
    ].filter((reason): reason is string => reason !== undefined),
  };
}

function matches(mission: Mission, filter: MissionFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'open') return mission.status !== 'complete';
  return mission.status === filter;
}

const statusRank: Record<MissionStatus, number> = {
  blocked: 0,
  active: 1,
  paused: 2,
  complete: 3,
};

/** Blocked objectives lead: an objective nothing can move is the loudest row here. */
export function selectMissions(
  dataset: SovereignDataset,
  filter: MissionFilter = 'open',
  now: Date = new Date(),
): MissionRollup[] {
  return dataset.missions
    .filter((mission) => matches(mission, filter))
    .map((mission) => missionRollup(dataset, mission, now))
    .sort(
      (a, b) =>
        statusRank[a.mission.status] - statusRank[b.mission.status] ||
        b.openTasks - a.openTasks ||
        a.mission.code.localeCompare(b.mission.code),
    );
}

export interface MissionCounts extends Record<MissionStatus, number> {
  total: number;
  open: number;
  /** Objectives with no linked work at all: an objective nothing serves. */
  unserved: number;
  openValueCents: number;
  wonValueCents: number;
  overdueTasks: number;
}

export function missionCounts(dataset: SovereignDataset, now: Date): MissionCounts {
  const rollups = selectMissions(dataset, 'all', now);
  const counts: MissionCounts = {
    total: rollups.length,
    open: 0,
    unserved: 0,
    active: 0,
    blocked: 0,
    paused: 0,
    complete: 0,
    openValueCents: 0,
    wonValueCents: 0,
    overdueTasks: 0,
  };

  for (const rollup of rollups) {
    counts[rollup.mission.status] += 1;
    if (rollup.mission.status !== 'complete') counts.open += 1;
    if (
      rollup.tasks.length === 0 &&
      rollup.projects.length === 0 &&
      rollup.opportunities.length === 0 &&
      rollup.campaigns.length === 0
    ) {
      counts.unserved += 1;
    }
    counts.openValueCents += rollup.openValueCents;
    counts.wonValueCents += rollup.wonValueCents;
    counts.overdueTasks += rollup.overdueTasks;
  }

  return counts;
}

export function findMission(
  dataset: SovereignDataset,
  id: string | undefined,
): Mission | undefined {
  if (id === undefined) return undefined;
  return dataset.missions.find((mission) => mission.id === id);
}

/** Objectives that are blocked, for the Brief. */
export function blockedMissions(dataset: SovereignDataset): Mission[] {
  return dataset.missions.filter((mission) => mission.status === 'blocked');
}
