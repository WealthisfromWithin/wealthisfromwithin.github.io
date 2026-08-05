import type { SovereignDataset } from '@/data/dataset';
import type { Company, Project, ProjectStatus, Task } from '@/domain';
import { projectStatusSchema } from '@/domain';

export const PROJECT_FILTERS = ['active', 'all', ...projectStatusSchema.options] as const;
export type ProjectFilter = (typeof PROJECT_FILTERS)[number];

export const projectStatusLabel: Record<ProjectStatus, string> = {
  planning: 'Planning',
  active: 'Active',
  blocked: 'Blocked',
  paused: 'Paused',
  complete: 'Complete',
};

export const projectFilterLabel: Record<ProjectFilter, string> = {
  ...projectStatusLabel,
  // `active` as a filter means active *or* blocked: work that is meant to move.
  active: 'Active',
  all: 'All',
};

export const projectStatusTone: Record<ProjectStatus, 'critical' | 'warning' | 'info' | 'muted'> = {
  planning: 'muted',
  active: 'info',
  blocked: 'critical',
  paused: 'warning',
  complete: 'muted',
};

export function parseProjectFilter(value: string | null): ProjectFilter {
  return PROJECT_FILTERS.find((filter) => filter === value) ?? 'active';
}

/** Progress is counted from tasks, never stored: a percentage cannot go stale. */
export interface ProjectProgress {
  total: number;
  done: number;
  blocked: number;
  open: number;
  percent: number;
}

export function projectProgress(dataset: SovereignDataset, projectId: string): ProjectProgress {
  const tasks = dataset.tasks.filter((task) => task.projectId === projectId);
  const done = tasks.filter((task) => task.status === 'done').length;
  return {
    total: tasks.length,
    done,
    blocked: tasks.filter((task) => task.status === 'blocked').length,
    open: tasks.length - done,
    percent: tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100),
  };
}

export function projectTasks(dataset: SovereignDataset, projectId: string): Task[] {
  return dataset.tasks
    .filter((task) => task.projectId === projectId)
    .sort((a, b) => {
      if ((a.status === 'done') !== (b.status === 'done')) return a.status === 'done' ? 1 : -1;
      return a.title.localeCompare(b.title);
    });
}

export interface ProjectRow {
  project: Project;
  company: Company | undefined;
  progress: ProjectProgress;
  tasks: Task[];
}

const STATUS_ORDER: readonly ProjectStatus[] = [
  'blocked',
  'active',
  'planning',
  'paused',
  'complete',
];

/** Blocked first, then active: the list should open on what cannot move. */
export function selectProjects(
  dataset: SovereignDataset,
  filter: ProjectFilter = 'active',
): ProjectRow[] {
  return dataset.projects
    .filter((project) => {
      if (filter === 'all') return true;
      if (filter === 'active') return project.status === 'active' || project.status === 'blocked';
      return project.status === filter;
    })
    .map((project) => ({
      project,
      company: dataset.companies.find((row) => row.id === project.companyId),
      progress: projectProgress(dataset, project.id),
      tasks: projectTasks(dataset, project.id),
    }))
    .sort(
      (a, b) =>
        STATUS_ORDER.indexOf(a.project.status) - STATUS_ORDER.indexOf(b.project.status) ||
        a.project.title.localeCompare(b.project.title),
    );
}

export interface ProjectCounts {
  total: number;
  active: number;
  blocked: number;
  openTasks: number;
}

export function projectCounts(dataset: SovereignDataset): ProjectCounts {
  const projectIds = new Set(dataset.projects.map((project) => project.id));
  return {
    total: dataset.projects.length,
    active: dataset.projects.filter((project) => project.status === 'active').length,
    blocked: dataset.projects.filter((project) => project.status === 'blocked').length,
    openTasks: dataset.tasks.filter(
      (task) =>
        task.status !== 'done' && task.projectId !== undefined && projectIds.has(task.projectId),
    ).length,
  };
}
