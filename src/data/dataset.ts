import type {
  ActivityEvent,
  Approval,
  Company,
  ContentItem,
  Integration,
  LeverageMetric,
  Mission,
  Notification,
  Opportunity,
  Person,
  Task,
} from '@/domain';

/** The complete local read-model. Every module reads from this shape. */
export interface SovereignDataset {
  people: Person[];
  companies: Company[];
  tasks: Task[];
  missions: Mission[];
  approvals: Approval[];
  opportunities: Opportunity[];
  contentItems: ContentItem[];
  notifications: Notification[];
  events: ActivityEvent[];
  metrics: LeverageMetric[];
  integrations: Integration[];
}

export const DATASET_KEYS = [
  'people',
  'companies',
  'tasks',
  'missions',
  'approvals',
  'opportunities',
  'contentItems',
  'notifications',
  'events',
  'metrics',
  'integrations',
] as const satisfies readonly (keyof SovereignDataset)[];

export const emptyDataset: SovereignDataset = {
  people: [],
  companies: [],
  tasks: [],
  missions: [],
  approvals: [],
  opportunities: [],
  contentItems: [],
  notifications: [],
  events: [],
  metrics: [],
  integrations: [],
};

export function datasetIsEmpty(dataset: SovereignDataset): boolean {
  return DATASET_KEYS.every((key) => dataset[key].length === 0);
}

export function countDemoRows(dataset: SovereignDataset): number {
  let count = 0;
  for (const key of DATASET_KEYS) {
    for (const row of dataset[key]) {
      if (row.source === 'demo') count += 1;
    }
  }
  return count;
}
