import { describe, expect, it } from 'vitest';
import { emptyDataset } from '@/data/dataset';
import { buildDemoDataset } from '@/data/seed';
import {
  parseProjectFilter,
  projectCounts,
  projectProgress,
  projectTasks,
  selectProjects,
} from './projects';

const now = new Date('2026-08-05T07:30:00.000Z');
const dataset = buildDemoDataset(now);

describe('parseProjectFilter', () => {
  it('opens on active work', () => {
    expect(parseProjectFilter(null)).toBe('active');
    expect(parseProjectFilter('shipped')).toBe('active');
    expect(parseProjectFilter('paused')).toBe('paused');
  });
});

describe('projectProgress', () => {
  it('counts progress from the tasks attached to the project', () => {
    const progress = projectProgress(dataset, 'prj-advisory-funnel');
    const tasks = dataset.tasks.filter((task) => task.projectId === 'prj-advisory-funnel');
    expect(progress.total).toBe(tasks.length);
    expect(progress.done).toBe(tasks.filter((task) => task.status === 'done').length);
    expect(progress.open).toBe(progress.total - progress.done);
    expect(progress.percent).toBe(Math.round((progress.done / progress.total) * 100));
  });

  it('reports zero rather than dividing by nothing when no task is attached', () => {
    expect(projectProgress(dataset, 'prj-does-not-exist')).toEqual({
      total: 0,
      done: 0,
      blocked: 0,
      open: 0,
      percent: 0,
    });
  });

  it('counts blocked tasks separately from open ones', () => {
    expect(projectProgress(dataset, 'prj-publishing-substrate').blocked).toBe(1);
  });
});

describe('selectProjects', () => {
  it('opens on blocked work, then active', () => {
    const rows = selectProjects(dataset, 'active');
    expect(rows[0]?.project.status).toBe('blocked');
    expect(rows.every((row) => row.project.status === 'blocked' || row.project.status === 'active')).toBe(
      true,
    );
  });

  it('filters to one status and shows every project under all', () => {
    expect(selectProjects(dataset, 'paused').map((row) => row.project.id)).toEqual([
      'prj-kestrel-audit',
    ]);
    expect(selectProjects(dataset, 'all')).toHaveLength(dataset.projects.length);
  });

  it('attaches the company and the tasks each project owns', () => {
    const renewal = selectProjects(dataset, 'all').find(
      (row) => row.project.id === 'prj-truoak-renewal',
    );
    expect(renewal?.company?.id).toBe('co-truoak');
    expect(renewal?.tasks.map((task) => task.id)).toContain('t-brief-truoak');
  });

  it('returns nothing for an empty store', () => {
    expect(selectProjects(emptyDataset, 'all')).toEqual([]);
  });
});

describe('projectTasks', () => {
  it('lists open tasks before completed ones', () => {
    const statuses = projectTasks(dataset, 'prj-advisory-funnel').map(
      (task) => task.status === 'done',
    );
    expect(statuses.indexOf(true)).toBe(statuses.lastIndexOf(false) + 1);
  });
});

describe('projectCounts', () => {
  it('counts projects, states, and the open tasks attached to them', () => {
    const counts = projectCounts(dataset);
    expect(counts.total).toBe(dataset.projects.length);
    expect(counts.blocked).toBe(1);
    expect(counts.active).toBe(2);
    expect(counts.openTasks).toBeGreaterThan(0);
  });
});
