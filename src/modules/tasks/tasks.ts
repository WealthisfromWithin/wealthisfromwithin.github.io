import type { SovereignDataset } from '@/data/dataset';
import type { Company, Opportunity, Person, Priority, Project, Task, TaskStatus } from '@/domain';
import { priorityRank } from '@/domain';
import { endOfDay, startOfDay } from '@/lib/clock';

export const TASK_STATUS_FILTERS = [
  'open',
  'todo',
  'in_progress',
  'blocked',
  'done',
  'all',
] as const;
export type TaskStatusFilter = (typeof TASK_STATUS_FILTERS)[number];

export const TASK_PRIORITY_FILTERS = ['all', 'critical', 'high', 'normal', 'low'] as const;
export type TaskPriorityFilter = (typeof TASK_PRIORITY_FILTERS)[number];

export const taskStatusFilterLabel: Record<TaskStatusFilter, string> = {
  open: 'Open',
  todo: 'To do',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
  all: 'All',
};

export const taskStatusLabel: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
};

export const taskPriorityFilterLabel: Record<TaskPriorityFilter, string> = {
  all: 'Any priority',
  critical: 'Critical',
  high: 'High',
  normal: 'Normal',
  low: 'Low',
};

/** The transitions a row offers. `blocked` needs a reason, so it is not offered here. */
export const TASK_NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  todo: 'in_progress',
  in_progress: 'done',
  blocked: 'in_progress',
  done: 'todo',
};

export interface TaskQuery {
  status: TaskStatusFilter;
  priority: TaskPriorityFilter;
}

export const defaultTaskQuery: TaskQuery = { status: 'open', priority: 'all' };

export function parseTaskQuery(params: URLSearchParams): TaskQuery {
  const status = params.get('status');
  const priority = params.get('priority');
  return {
    status: TASK_STATUS_FILTERS.find((value) => value === status) ?? defaultTaskQuery.status,
    priority:
      TASK_PRIORITY_FILTERS.find((value) => value === priority) ?? defaultTaskQuery.priority,
  };
}

export function isOverdue(task: Task, now: Date): boolean {
  if (task.status === 'done' || task.dueAt === undefined) return false;
  const due = Date.parse(task.dueAt);
  return !Number.isNaN(due) && due < now.getTime();
}

export function isDueToday(task: Task, now: Date): boolean {
  if (task.dueAt === undefined) return false;
  const due = Date.parse(task.dueAt);
  return due >= startOfDay(now).getTime() && due <= endOfDay(now).getTime();
}

export interface TaskCounts extends Record<TaskStatus, number> {
  total: number;
  open: number;
  overdue: number;
  dueToday: number;
}

export function taskCounts(dataset: SovereignDataset, now: Date): TaskCounts {
  const counts: TaskCounts = {
    total: dataset.tasks.length,
    open: 0,
    overdue: 0,
    dueToday: 0,
    todo: 0,
    in_progress: 0,
    blocked: 0,
    done: 0,
  };

  for (const task of dataset.tasks) {
    counts[task.status] += 1;
    if (task.status !== 'done') counts.open += 1;
    if (isOverdue(task, now)) counts.overdue += 1;
    if (task.status !== 'done' && isDueToday(task, now)) counts.dueToday += 1;
  }

  return counts;
}

function matches(task: Task, query: TaskQuery): boolean {
  if (query.status === 'open' && task.status === 'done') return false;
  if (query.status !== 'open' && query.status !== 'all' && task.status !== query.status) return false;
  if (query.priority !== 'all' && task.priority !== query.priority) return false;
  return true;
}

function dueRank(task: Task): number {
  if (task.dueAt === undefined) return Number.MAX_SAFE_INTEGER;
  const due = Date.parse(task.dueAt);
  return Number.isNaN(due) ? Number.MAX_SAFE_INTEGER : due;
}

/**
 * Open work first, then overdue, then priority, then due date. Completed rows
 * sink to the bottom in reverse completion order: recent work is easiest to undo.
 */
export function selectTasks(
  dataset: SovereignDataset,
  query: TaskQuery = defaultTaskQuery,
  now: Date = new Date(),
): Task[] {
  return dataset.tasks
    .filter((task) => matches(task, query))
    .sort((a, b) => {
      if ((a.status === 'done') !== (b.status === 'done')) return a.status === 'done' ? 1 : -1;
      if (a.status === 'done' && b.status === 'done') {
        return (b.completedAt ? Date.parse(b.completedAt) : 0) -
          (a.completedAt ? Date.parse(a.completedAt) : 0);
      }
      const overdue = Number(isOverdue(b, now)) - Number(isOverdue(a, now));
      if (overdue !== 0) return overdue;
      const byPriority = priorityRank[a.priority] - priorityRank[b.priority];
      if (byPriority !== 0) return byPriority;
      return dueRank(a) - dueRank(b) || a.title.localeCompare(b.title);
    });
}

export interface TaskLinks {
  project: Project | undefined;
  person: Person | undefined;
  opportunity: Opportunity | undefined;
  company: Company | undefined;
}

/** The records a task points at, resolved from the local store. */
export function taskLinks(dataset: SovereignDataset, task: Task): TaskLinks {
  const person = dataset.people.find((row) => row.id === task.personId);
  const opportunity = dataset.opportunities.find((row) => row.id === task.opportunityId);
  const companyId = opportunity?.companyId ?? person?.companyId;

  return {
    project: dataset.projects.find((row) => row.id === task.projectId),
    person,
    opportunity,
    company: dataset.companies.find((row) => row.id === companyId),
  };
}

export function priorityTone(priority: Priority): 'critical' | 'warning' | 'neutral' | 'muted' {
  if (priority === 'critical') return 'critical';
  if (priority === 'high') return 'warning';
  if (priority === 'normal') return 'neutral';
  return 'muted';
}
