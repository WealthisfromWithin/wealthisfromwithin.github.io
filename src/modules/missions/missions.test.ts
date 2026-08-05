import { describe, expect, it } from 'vitest';
import type { SovereignDataset } from '@/data/dataset';
import { buildDemoDataset } from '@/data/seed';
import {
  blockedMissions,
  findMission,
  MISSION_FILTERS,
  missionCounts,
  missionFilterLabel,
  missionRollup,
  missionStatusLabel,
  missionStatusTone,
  parseMissionFilter,
  selectMissions,
} from './missions';

const NOW = new Date('2026-08-05T09:00:00.000Z');
const dataset: SovereignDataset = buildDemoDataset(NOW);

const ACTIVE = 'msn-042';
const BLOCKED = 'msn-043';
const PAUSED = 'msn-044';

describe('mission filters', () => {
  it('defaults to the open objectives', () => {
    expect(parseMissionFilter(null)).toBe('open');
    expect(parseMissionFilter('nonsense')).toBe('open');
    expect(parseMissionFilter('complete')).toBe('complete');
  });

  it('labels every filter and every status', () => {
    for (const filter of MISSION_FILTERS) {
      expect(missionFilterLabel[filter].length).toBeGreaterThan(0);
    }
    for (const status of ['active', 'blocked', 'paused', 'complete'] as const) {
      expect(missionStatusLabel[status].length).toBeGreaterThan(0);
      expect(missionStatusTone(status).length).toBeGreaterThan(0);
    }
    expect(missionStatusTone('blocked')).toBe('critical');
  });

  it('keeps a complete objective off the open view', () => {
    const complete: SovereignDataset = {
      ...dataset,
      missions: dataset.missions.map((mission) =>
        mission.id === PAUSED ? { ...mission, status: 'complete' as const } : mission,
      ),
    };
    expect(selectMissions(complete, 'open', NOW).map((row) => row.mission.id)).not.toContain(PAUSED);
    expect(selectMissions(complete, 'all', NOW)).toHaveLength(complete.missions.length);
  });

  it('leads with the objectives nothing can move', () => {
    const rows = selectMissions(dataset, 'all', NOW);
    expect(rows[0]?.mission.status).toBe('blocked');
  });
});

describe('mission rollups', () => {
  it('counts progress from linked tasks and keeps the declared figure apart', () => {
    const mission = findMission(dataset, ACTIVE)!;
    const rollup = missionRollup(dataset, mission, NOW);

    expect(rollup.declaredProgress).toBe(mission.progress);
    expect(rollup.countedProgress).toBe(
      Math.round((rollup.doneTasks / rollup.tasks.length) * 100),
    );
    // The two are different claims, and the rollup never reconciles them.
    expect(rollup.countedProgress).not.toBe(rollup.declaredProgress);
  });

  it('counts a task linked through its project as well as one linked directly', () => {
    const rollup = missionRollup(dataset, findMission(dataset, ACTIVE)!, NOW);
    const projectIds = new Set(rollup.projects.map((project) => project.id));

    expect(rollup.projects.length).toBeGreaterThan(0);
    expect(
      rollup.tasks.some(
        (task) => task.missionId !== ACTIVE && task.projectId !== undefined && projectIds.has(task.projectId),
      ),
    ).toBe(true);
    // No task is counted twice, whichever way it is linked.
    expect(new Set(rollup.tasks.map((task) => task.id)).size).toBe(rollup.tasks.length);
  });

  it('says nothing can be counted when nothing is linked', () => {
    const orphan: SovereignDataset = {
      ...dataset,
      tasks: [],
      projects: [],
      opportunities: [],
      campaigns: [],
    };
    const rollup = missionRollup(orphan, findMission(orphan, ACTIVE)!, NOW);
    expect(rollup.countedProgress).toBeNull();
    expect(rollup.declaredProgress).toBeGreaterThan(0);
  });

  it('sums the value of the deals pointing at the objective', () => {
    const rollup = missionRollup(dataset, findMission(dataset, ACTIVE)!, NOW);
    const linked = dataset.opportunities.filter((row) => row.missionId === ACTIVE);

    expect(rollup.opportunities).toHaveLength(linked.length);
    expect(rollup.openValueCents).toBe(
      linked
        .filter((row) => row.stage !== 'won' && row.stage !== 'lost')
        .reduce((total, row) => total + row.valueCents, 0),
    );
  });

  it('reaches content through the campaigns the objective owns', () => {
    const rollup = missionRollup(dataset, findMission(dataset, BLOCKED)!, NOW);
    const campaignIds = new Set(rollup.campaigns.map((campaign) => campaign.id));

    expect(rollup.campaigns.length).toBeGreaterThan(0);
    expect(
      rollup.contentItems.every(
        (item) => item.campaignId !== undefined && campaignIds.has(item.campaignId),
      ),
    ).toBe(true);
    expect(rollup.publishedContent).toBeLessThanOrEqual(rollup.contentItems.length);
  });

  it('collects the blockers from the objective and from the work under it', () => {
    const rollup = missionRollup(dataset, findMission(dataset, BLOCKED)!, NOW);
    expect(rollup.blockers[0]).toBe(findMission(dataset, BLOCKED)?.blockedReason);
    expect(rollup.blockers.length).toBeGreaterThan(1);
    expect(rollup.blockedTasks).toBeGreaterThan(0);
  });

  it('names a blocked objective with no reason rather than printing nothing', () => {
    const unnamed: SovereignDataset = {
      ...dataset,
      missions: dataset.missions.map((mission) =>
        mission.id === BLOCKED ? { ...mission, blockedReason: undefined } : mission,
      ),
    };
    const rollup = missionRollup(unnamed, findMission(unnamed, BLOCKED)!, NOW);
    expect(rollup.blockers).toContain('No reason recorded.');
  });

  it('takes the soonest date from the objective or the work it carries', () => {
    const rollup = missionRollup(dataset, findMission(dataset, ACTIVE)!, NOW);
    expect(rollup.nextDateAt).toBeDefined();
    const dates = [
      rollup.mission.dueAt,
      ...rollup.tasks.filter((task) => task.status !== 'done').map((task) => task.dueAt),
      ...rollup.projects.map((project) => project.dueAt),
    ].filter((value): value is string => value !== undefined);
    expect(Math.min(...dates.map((value) => Date.parse(value)))).toBeLessThanOrEqual(
      Date.parse(rollup.nextDateAt ?? ''),
    );
  });
});

describe('mission counts', () => {
  it('adds up to the objective list', () => {
    const counts = missionCounts(dataset, NOW);
    expect(counts.total).toBe(dataset.missions.length);
    expect(counts.active + counts.blocked + counts.paused + counts.complete).toBe(counts.total);
    expect(counts.open).toBe(counts.total - counts.complete);
  });

  it('counts an objective nothing serves, because that is the failure mode here', () => {
    const orphaned: SovereignDataset = {
      ...dataset,
      tasks: [],
      projects: [],
      opportunities: [],
      campaigns: [],
    };
    expect(missionCounts(orphaned, NOW).unserved).toBe(orphaned.missions.length);
    expect(missionCounts(dataset, NOW).unserved).toBeLessThan(dataset.missions.length);
  });

  it('reports blocked objectives for the Brief', () => {
    expect(blockedMissions(dataset).map((mission) => mission.id)).toEqual([BLOCKED]);
  });

  it('reads an empty store as empty rather than as zero progress', () => {
    const empty: SovereignDataset = { ...dataset, missions: [] };
    expect(missionCounts(empty, NOW).total).toBe(0);
    expect(selectMissions(empty, 'all', NOW)).toEqual([]);
    expect(findMission(empty, undefined)).toBeUndefined();
  });
});
