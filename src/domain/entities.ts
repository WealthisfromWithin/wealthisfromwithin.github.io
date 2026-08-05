import { z } from 'zod';
import {
  idSchema,
  isoTimestamp,
  prioritySchema,
  recordBase,
  severitySchema,
} from './common';

/* ── People & companies ─────────────────────────────────────────────────── */

export const personSchema = recordBase.extend({
  name: z.string().min(1),
  role: z.string().default(''),
  companyId: idSchema.optional(),
  email: z.email().optional(),
  relationshipStrength: z.number().min(0).max(100).default(50),
  lastTouchAt: isoTimestamp.optional(),
  tags: z.array(z.string()).default([]),
  notes: z.string().default(''),
});
export type Person = z.infer<typeof personSchema>;

/** Where a company sits in the relationship, not how warm it feels. */
export const companyStatusSchema = z.enum(['prospect', 'active', 'dormant', 'churned']);
export type CompanyStatus = z.infer<typeof companyStatusSchema>;

export const companySchema = recordBase.extend({
  name: z.string().min(1),
  segment: z.string().default(''),
  domain: z.string().optional(),
  status: companyStatusSchema.default('prospect'),
});
export type Company = z.infer<typeof companySchema>;

/* ── Execution ──────────────────────────────────────────────────────────── */

export const taskStatusSchema = z.enum(['todo', 'in_progress', 'blocked', 'done']);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const taskSchema = recordBase.extend({
  title: z.string().min(1),
  status: taskStatusSchema,
  priority: prioritySchema,
  dueAt: isoTimestamp.optional(),
  completedAt: isoTimestamp.optional(),
  blockedReason: z.string().optional(),
  blockedSince: isoTimestamp.optional(),
  missionId: idSchema.optional(),
  /** Local joins. A task points at the work it serves; nothing is required to. */
  projectId: idSchema.optional(),
  personId: idSchema.optional(),
  opportunityId: idSchema.optional(),
  estimateMinutes: z.number().int().positive().optional(),
  context: z.string().default(''),
});
export type Task = z.infer<typeof taskSchema>;

export const projectStatusSchema = z.enum(['planning', 'active', 'blocked', 'paused', 'complete']);
export type ProjectStatus = z.infer<typeof projectStatusSchema>;

export const projectSchema = recordBase.extend({
  title: z.string().min(1),
  status: projectStatusSchema,
  objective: z.string().default(''),
  dueAt: isoTimestamp.optional(),
  companyId: idSchema.optional(),
  missionId: idSchema.optional(),
  blockedReason: z.string().optional(),
});
export type Project = z.infer<typeof projectSchema>;

/* ── Time ───────────────────────────────────────────────────────────────── */

export const meetingKindSchema = z.enum([
  'discovery',
  'proposal',
  'review',
  'follow_up',
  'internal',
]);
export type MeetingKind = z.infer<typeof meetingKindSchema>;

export const meetingSchema = recordBase.extend({
  title: z.string().min(1),
  startsAt: isoTimestamp,
  endsAt: isoTimestamp.optional(),
  kind: meetingKindSchema,
  personIds: z.array(idSchema).default([]),
  companyId: idSchema.optional(),
  opportunityId: idSchema.optional(),
  location: z.string().default(''),
  /** Operator-authored. Empty until someone writes what happened. */
  notes: z.string().default(''),
});
export type Meeting = z.infer<typeof meetingSchema>;

export const missionStatusSchema = z.enum(['active', 'blocked', 'complete', 'paused']);
export type MissionStatus = z.infer<typeof missionStatusSchema>;

export const missionSchema = recordBase.extend({
  code: z.string().min(1),
  title: z.string().min(1),
  objective: z.string().default(''),
  status: missionStatusSchema,
  progress: z.number().min(0).max(100),
  blockedReason: z.string().optional(),
});
export type Mission = z.infer<typeof missionSchema>;

/** A gate is open, cleared, or refused. There is no "in review" limbo state. */
export const approvalStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export type ApprovalStatus = z.infer<typeof approvalStatusSchema>;

export const approvalSchema = recordBase.extend({
  title: z.string().min(1),
  requestedBy: z.string().min(1),
  kind: z.enum(['content', 'outreach', 'automation', 'spend', 'access']),
  risk: severitySchema,
  status: approvalStatusSchema.default('pending'),
  summary: z.string().default(''),
  dueAt: isoTimestamp.optional(),
  decidedAt: isoTimestamp.optional(),
  decidedBy: z.string().optional(),
});
export type Approval = z.infer<typeof approvalSchema>;

/* ── Revenue ────────────────────────────────────────────────────────────── */

export const pipelineStageSchema = z.enum([
  'identified',
  'contacted',
  'engaged',
  'qualified',
  'proposal',
  'negotiation',
  'won',
  'lost',
]);
export type PipelineStage = z.infer<typeof pipelineStageSchema>;

export const opportunitySchema = recordBase.extend({
  name: z.string().min(1),
  companyId: idSchema.optional(),
  /** The human on the other side of the deal, when one is known. */
  personId: idSchema.optional(),
  stage: pipelineStageSchema,
  valueCents: z.number().int().nonnegative(),
  probability: z.number().min(0).max(100),
  nextStep: z.string().default(''),
  nextStepAt: isoTimestamp.optional(),
  signal: z.string().default(''),
  /** How the lead arrived. Distinct from `source`, which is row provenance. */
  leadSource: z.string().default(''),
  stageChangedAt: isoTimestamp.optional(),
});
export type Opportunity = z.infer<typeof opportunitySchema>;

/* ── Content ────────────────────────────────────────────────────────────── */

export const contentStatusSchema = z.enum([
  'idea',
  'drafting',
  'review',
  'scheduled',
  'published',
  'blocked',
]);
export type ContentStatus = z.infer<typeof contentStatusSchema>;

export const contentItemSchema = recordBase.extend({
  title: z.string().min(1),
  status: contentStatusSchema,
  channel: z.string().default(''),
  scheduledFor: isoTimestamp.optional(),
  blockedReason: z.string().optional(),
});
export type ContentItem = z.infer<typeof contentItemSchema>;

/* ── Signals ────────────────────────────────────────────────────────────── */

export const notificationSchema = recordBase.extend({
  title: z.string().min(1),
  body: z.string().default(''),
  severity: severitySchema,
  read: z.boolean(),
  readAt: isoTimestamp.optional(),
  origin: z.string().default(''),
  href: z.string().optional(),
});
export type Notification = z.infer<typeof notificationSchema>;

export const activityEventSchema = recordBase.extend({
  at: isoTimestamp,
  title: z.string().min(1),
  detail: z.string().default(''),
  channel: z.enum([
    'pipeline',
    'content',
    'automation',
    'system',
    'inbox',
    'execution',
    'relationship',
  ]),
});
export type ActivityEvent = z.infer<typeof activityEventSchema>;

export const leverageMetricSchema = recordBase.extend({
  label: z.string().min(1),
  value: z.number(),
  unit: z.enum(['hours', 'usd', 'count', 'percent']),
  deltaPercent: z.number(),
  window: z.string().default('7d'),
  origin: z.string().default(''),
});
export type LeverageMetric = z.infer<typeof leverageMetricSchema>;

/* ── Integrations ───────────────────────────────────────────────────────── */

/**
 * Exactly three legal states (ARCHITECTURE_AUDIT §5.7). There is no
 * "maybe connected" and no green without a verified probe.
 */
export const integrationStateSchema = z.enum(['connected', 'disabled', 'awaiting_credentials']);
export type IntegrationState = z.infer<typeof integrationStateSchema>;

export const integrationCategorySchema = z.enum([
  'ai',
  'automation',
  'communication',
  'crm',
  'data',
  'productivity',
  'publishing',
  'mcp',
]);
export type IntegrationCategory = z.infer<typeof integrationCategorySchema>;

export const integrationSchema = recordBase.extend({
  name: z.string().min(1),
  category: integrationCategorySchema,
  state: integrationStateSchema,
  capabilities: z.array(z.string()).default([]),
  rationale: z.string().default(''),
  lastProbedAt: isoTimestamp.optional(),
  substrate: z.boolean().default(false),
});
export type Integration = z.infer<typeof integrationSchema>;
