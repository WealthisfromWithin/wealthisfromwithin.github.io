import Dexie, { type EntityTable } from 'dexie';
import type {
  ActivityEvent,
  AgentMessage,
  AgentSession,
  Approval,
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

export interface MetaRow {
  key: string;
  value: string;
}

export class SovereignDb extends Dexie {
  people!: EntityTable<Person, 'id'>;
  companies!: EntityTable<Company, 'id'>;
  tasks!: EntityTable<Task, 'id'>;
  projects!: EntityTable<Project, 'id'>;
  meetings!: EntityTable<Meeting, 'id'>;
  missions!: EntityTable<Mission, 'id'>;
  approvals!: EntityTable<Approval, 'id'>;
  opportunities!: EntityTable<Opportunity, 'id'>;
  contentItems!: EntityTable<ContentItem, 'id'>;
  contentIdeas!: EntityTable<ContentIdea, 'id'>;
  campaigns!: EntityTable<Campaign, 'id'>;
  contentAssets!: EntityTable<ContentAsset, 'id'>;
  contentTemplates!: EntityTable<ContentTemplate, 'id'>;
  hooks!: EntityTable<Hook, 'id'>;
  ctas!: EntityTable<Cta, 'id'>;
  contentMetrics!: EntityTable<ContentMetric, 'id'>;
  knowledgeNodes!: EntityTable<KnowledgeNode, 'id'>;
  memoryEntries!: EntityTable<MemoryEntry, 'id'>;
  documents!: EntityTable<SovereignDocument, 'id'>;
  decisions!: EntityTable<Decision, 'id'>;
  prompts!: EntityTable<Prompt, 'id'>;
  researchItems!: EntityTable<ResearchItem, 'id'>;
  agentSessions!: EntityTable<AgentSession, 'id'>;
  agentMessages!: EntityTable<AgentMessage, 'id'>;
  notifications!: EntityTable<Notification, 'id'>;
  events!: EntityTable<ActivityEvent, 'id'>;
  metrics!: EntityTable<LeverageMetric, 'id'>;
  integrations!: EntityTable<Integration, 'id'>;
  meta!: EntityTable<MetaRow, 'key'>;

  constructor(name = 'sovereign-command') {
    super(name);
    this.version(1).stores({
      people: 'id, name, companyId, source',
      companies: 'id, name, source',
      tasks: 'id, status, priority, dueAt, missionId, source',
      missions: 'id, code, status, source',
      approvals: 'id, risk, dueAt, source',
      opportunities: 'id, stage, nextStepAt, source',
      contentItems: 'id, status, scheduledFor, source',
      notifications: 'id, read, severity, createdAt, source',
      events: 'id, at, channel, source',
      metrics: 'id, label, source',
      integrations: 'id, state, category, source',
      meta: 'key',
    });

    // Wave 2 gave approvals a decision status. Rows written by version 1 predate
    // the column, so they are backfilled as still-open gates.
    this.version(2)
      .stores({ approvals: 'id, status, risk, dueAt, source' })
      .upgrade(async (tx) => {
        await tx
          .table<Partial<Approval>, string>('approvals')
          .toCollection()
          .modify((row) => {
            row.status ??= 'pending';
          });
      });

    // Wave 3 adds execution and time tables and the local joins that let a task,
    // an opportunity, and a meeting point at each other. Version-2 companies
    // predate the lifecycle column and are backfilled as prospects.
    this.version(3)
      .stores({
        companies: 'id, name, status, source',
        tasks: 'id, status, priority, dueAt, missionId, projectId, opportunityId, personId, source',
        projects: 'id, status, dueAt, companyId, source',
        meetings: 'id, startsAt, companyId, opportunityId, source',
        opportunities: 'id, stage, nextStepAt, companyId, personId, source',
      })
      .upgrade(async (tx) => {
        await tx
          .table<Partial<Company>, string>('companies')
          .toCollection()
          .modify((row) => {
            row.status ??= 'prospect';
          });
      });

    // Wave 4 absorbs the ContentDone domain: the vault, the libraries, the
    // campaigns that group work, and the metric readings performance is counted
    // from. Version-3 content rows predate the wider status machine and the
    // format column, so `review` becomes `in_review` and the rest default.
    this.version(4)
      .stores({
        contentItems: 'id, status, format, scheduledFor, campaignId, parentId, ideaId, source',
        contentIdeas: 'id, status, campaignId, source',
        campaigns: 'id, status, startAt, source',
        contentAssets: 'id, kind, source',
        contentTemplates: 'id, format, source',
        hooks: 'id, style, source',
        ctas: 'id, intent, source',
        contentMetrics: 'id, contentItemId, platform, capturedAt, source',
      })
      .upgrade(async (tx) => {
        await tx
          .table<Partial<ContentItem>, string>('contentItems')
          .toCollection()
          .modify((row) => {
            if ((row.status as string | undefined) === 'review') row.status = 'in_review';
            row.format ??= 'post';
            row.body ??= '';
            row.videoScript ??= '';
            row.complianceSummary ??= '';
            row.assetIds ??= [];
            row.variants ??= [];
            row.tags ??= [];
          });
      });

    // Wave 5 adds cognition: what is known, what must be remembered, what was
    // decided, what is still being asked, and the local agent transcript. Every
    // table is new, so there is nothing to migrate — a version-4 store gains
    // eight empty stores and keeps every row it had.
    this.version(5).stores({
      knowledgeNodes: 'id, kind, pinned, companyId, opportunityId, contentItemId, source',
      memoryEntries: 'id, kind, scope, pinned, reviewAt, personId, companyId, source',
      documents: 'id, kind, status, companyId, opportunityId, projectId, meetingId, source',
      decisions: 'id, status, dueAt, decidedAt, opportunityId, projectId, source',
      prompts: 'id, intent, lastUsedAt, source',
      researchItems: 'id, status, priority, dueAt, opportunityId, source',
      agentSessions: 'id, lastActivityAt, promptId, source',
      agentMessages: 'id, sessionId, at, outcome, source',
    });
  }
}

export const db = new SovereignDb();

export const META_KEYS = {
  seedVersion: 'seed.version',
  seededAt: 'seed.at',
  /** Operator preference: demo rows stay removed until an explicit refresh or reset. */
  demoOptOut: 'seed.optOut',
} as const;
