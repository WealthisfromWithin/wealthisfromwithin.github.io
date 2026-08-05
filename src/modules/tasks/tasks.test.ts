import { describe, expect, it } from 'vitest';
import { emptyDataset } from '@/data/dataset';
import { buildDemoDataset } from '@/data/seed';
import {
  TASK_NEXT_STATUS,
  isDueToday,
  isOverdue,
  parseTaskQuery,
  selectTasks,
  taskCounts,
  taskLinks,
} from './tasks';

const now = new Date('2026-08-05T07:30:00.000Z');
const dataset = buildDemoDataset(now);

describe('parseTaskQuery', () => {
  it('opens on open work at any priority', () => {
    expect(parseTaskQuery(new URLSearchParams())).toEqual({ status: 'open', priority: 'all' });
  });

  it('ignores filters it does not serve', () => {
    expect(parseTaskQuery(new URLSearchParams('status=archived&priority=urgent'))).toEqual({
      status: 'open',
      priority: 'all',
    });
  });

  it('reads a legal filter pair', () => {
    expect(parseTaskQuery(new URLSearchParams('status=blocked&priority=high'))).toEqual({
      status: 'blocked',
      priority: 'high',
    });
  });
});

describe('task dates', () => {
  it('calls a past due date overdue only while the task is open', () => {
    const overdue = dataset.tasks.find((task) => task.id === 't-overdue-audit')!;
    expect(isOverdue(overdue, now)).toBe(true);
    expect(isOverdue({ ...overdue, status: 'done' }, now)).toBe(false);
  });

  it('never calls an undated task overdue', () => {
    const undated = dataset.tasks.find((task) => task.id === 't-decision-log')!;
    expect(isOverdue(undated, now)).toBe(false);
    expect(isDueToday(undated, now)).toBe(false);
  });

  it('recognises work due before midnight today', () => {
    expect(isDueToday(dataset.tasks.find((task) => task.id === 't-brief-truoak')!, now)).toBe(true);
  });
});

describe('taskCounts', () => {
  it('counts each status plus the attention cuts', () => {
    const counts = taskCounts(dataset, now);
    expect(counts.total).toBe(dataset.tasks.length);
    expect(counts.open + counts.done).toBe(counts.total);
    expect(counts.blocked).toBe(2);
    expect(counts.overdue).toBe(1);
    expect(counts.dueToday).toBeGreaterThan(0);
  });

  it('is all zeroes on an empty store', () => {
    const counts = taskCounts(emptyDataset, now);
    expect(counts).toEqual({
      total: 0,
      open: 0,
      overdue: 0,
      dueToday: 0,
      todo: 0,
      in_progress: 0,
      blocked: 0,
      done: 0,
    });
  });
});

describe('selectTasks', () => {
  it('hides completed work under the open filter', () => {
    const rows = selectTasks(dataset, { status: 'open', priority: 'all' }, now);
    expect(rows.every((task) => task.status !== 'done')).toBe(true);
    expect(rows.map((task) => task.id)).not.toContain('t-shipped-shell');
  });

  it('puts overdue work first, whatever its priority', () => {
    const rows = selectTasks(dataset, { status: 'open', priority: 'all' }, now);
    expect(rows[0]?.id).toBe('t-overdue-audit');
  });

  it('sinks completed work to the bottom under the all filter', () => {
    const rows = selectTasks(dataset, { status: 'all', priority: 'all' }, now);
    const statuses = rows.map((task) => task.status === 'done');
    expect(statuses.indexOf(true)).toBe(statuses.lastIndexOf(false) + 1);
  });

  it('filters on one status and one priority together', () => {
    const rows = selectTasks(dataset, { status: 'blocked', priority: 'high' }, now);
    expect(rows.map((task) => task.id)).toEqual(['t-publish-loop']);
  });

  it('offers a next status for every status, and never blocks without a reason', () => {
    expect(TASK_NEXT_STATUS.todo).toBe('in_progress');
    expect(TASK_NEXT_STATUS.in_progress).toBe('done');
    expect(TASK_NEXT_STATUS.done).toBe('todo');
    expect(Object.values(TASK_NEXT_STATUS)).not.toContain('blocked');
  });
});

describe('taskLinks', () => {
  it('resolves the project, person, opportunity, and company behind a task', () => {
    const task = dataset.tasks.find((row) => row.id === 't-brief-truoak')!;
    const links = taskLinks(dataset, task);
    expect(links.project?.id).toBe('prj-truoak-renewal');
    expect(links.person?.id).toBe('p-aldridge');
    expect(links.opportunity?.id).toBe('opp-truoak');
    expect(links.company?.id).toBe('co-truoak');
  });

  it('leaves every link undefined when a task points at nothing', () => {
    const task = dataset.tasks.find((row) => row.id === 't-decision-log')!;
    const links = taskLinks(dataset, { ...task, projectId: undefined });
    expect(links).toEqual({
      project: undefined,
      person: undefined,
      opportunity: undefined,
      company: undefined,
    });
  });
});
