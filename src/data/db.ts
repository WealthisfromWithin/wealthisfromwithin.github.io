import Dexie, { type EntityTable } from 'dexie';
import type {
  ActivityEvent,
  Approval,
  Company,
  ContentItem,
  Integration,
  LeverageMetric,
  Meeting,
  Mission,
  Notification,
  Opportunity,
  Person,
  Project,
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
  }
}

export const db = new SovereignDb();

export const META_KEYS = {
  seedVersion: 'seed.version',
  seededAt: 'seed.at',
  /** Operator preference: demo rows stay removed until an explicit refresh or reset. */
  demoOptOut: 'seed.optOut',
} as const;
