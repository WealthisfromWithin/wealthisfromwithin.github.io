import type {
  ActivityEvent,
  AgentMessage,
  AgentSession,
  Approval,
  AutomationRule,
  AutomationRun,
  Campaign,
  Company,
  ContentAsset,
  ContentIdea,
  ContentItem,
  ContentMetric,
  ContentTemplate,
  Cta,
  Decision,
  Hook,
  Integration,
  KnowledgeNode,
  LeverageMetric,
  Meeting,
  MemoryEntry,
  Mission,
  Notification,
  Opportunity,
  Person,
  Project,
  Prompt,
  ResearchItem,
  SovereignDocument,
  Task,
} from '@/domain';

/** The complete local read-model. Every module reads from this shape. */
export interface SovereignDataset {
  people: Person[];
  companies: Company[];
  tasks: Task[];
  projects: Project[];
  meetings: Meeting[];
  missions: Mission[];
  approvals: Approval[];
  opportunities: Opportunity[];
  contentItems: ContentItem[];
  contentIdeas: ContentIdea[];
  campaigns: Campaign[];
  contentAssets: ContentAsset[];
  contentTemplates: ContentTemplate[];
  hooks: Hook[];
  ctas: Cta[];
  contentMetrics: ContentMetric[];
  knowledgeNodes: KnowledgeNode[];
  memoryEntries: MemoryEntry[];
  documents: SovereignDocument[];
  decisions: Decision[];
  prompts: Prompt[];
  researchItems: ResearchItem[];
  agentSessions: AgentSession[];
  agentMessages: AgentMessage[];
  automations: AutomationRule[];
  automationRuns: AutomationRun[];
  notifications: Notification[];
  events: ActivityEvent[];
  metrics: LeverageMetric[];
  integrations: Integration[];
}

export const DATASET_KEYS = [
  'people',
  'companies',
  'tasks',
  'projects',
  'meetings',
  'missions',
  'approvals',
  'opportunities',
  'contentItems',
  'contentIdeas',
  'campaigns',
  'contentAssets',
  'contentTemplates',
  'hooks',
  'ctas',
  'contentMetrics',
  'knowledgeNodes',
  'memoryEntries',
  'documents',
  'decisions',
  'prompts',
  'researchItems',
  'agentSessions',
  'agentMessages',
  'automations',
  'automationRuns',
  'notifications',
  'events',
  'metrics',
  'integrations',
] as const satisfies readonly (keyof SovereignDataset)[];

export const emptyDataset: SovereignDataset = {
  people: [],
  companies: [],
  tasks: [],
  projects: [],
  meetings: [],
  missions: [],
  approvals: [],
  opportunities: [],
  contentItems: [],
  contentIdeas: [],
  campaigns: [],
  contentAssets: [],
  contentTemplates: [],
  hooks: [],
  ctas: [],
  contentMetrics: [],
  knowledgeNodes: [],
  memoryEntries: [],
  documents: [],
  decisions: [],
  prompts: [],
  researchItems: [],
  agentSessions: [],
  agentMessages: [],
  automations: [],
  automationRuns: [],
  notifications: [],
  events: [],
  metrics: [],
  integrations: [],
};

export function datasetIsEmpty(dataset: SovereignDataset): boolean {
  return DATASET_KEYS.every((key) => dataset[key].length === 0);
}

export function countRows(dataset: SovereignDataset): number {
  let count = 0;
  for (const key of DATASET_KEYS) {
    count += dataset[key].length;
  }
  return count;
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
