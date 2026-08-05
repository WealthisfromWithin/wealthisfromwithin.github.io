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
  /**
   * Declared by the operator, not counted. Mission Control prints it beside the
   * progress it can count from linked tasks, and says which is which — a number
   * someone typed and a number the store measured are different claims.
   */
  progress: z.number().min(0).max(100),
  blockedReason: z.string().optional(),
  /** The date the objective is meant to be met by, when one was set. */
  dueAt: isoTimestamp.optional(),
  /** What "met" means, in the operator's words. Never a computed target. */
  successMeasure: z.string().default(''),
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
  /**
   * Set when an automation run opened this gate. Deciding it resolves that run:
   * approving carries out the effect the rule deferred, rejecting records the
   * refusal. Wave 6's analogue of the content approval sync.
   */
  automationRunId: idSchema.optional(),
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
  /** The objective this deal serves, so Mission Control can count real value. */
  missionId: idSchema.optional(),
});
export type Opportunity = z.infer<typeof opportunitySchema>;

/* ── Content ────────────────────────────────────────────────────────────── */

/**
 * The production loop, in the order work moves through it, plus the two states
 * that leave it: `archived` (retired deliberately) and `blocked` (cannot move,
 * with the reason on the record). Wave 1's `review` became `in_review` to match
 * the ContentDone gate vocabulary; Dexie version 4 migrates the old rows.
 */
export const contentStatusSchema = z.enum([
  'idea',
  'drafting',
  'in_review',
  'approved',
  'scheduled',
  'published',
  'archived',
  'blocked',
]);
export type ContentStatus = z.infer<typeof contentStatusSchema>;

/**
 * The legal moves through the loop. Doctrine, not presentation: the write path
 * refuses anything not listed here, and the UI only offers what it lists.
 * Nothing reaches `published` except from a state where the copy was approved,
 * and reaching it is always an operator recording a publish — no connector on
 * this surface can confirm that a post went out. Approved copy can go back to
 * `in_review` because a human gate that is reopened must be able to take the
 * copy back with it; without that move the gate and the item would disagree.
 */
export const CONTENT_TRANSITIONS: Record<ContentStatus, readonly ContentStatus[]> = {
  idea: ['drafting', 'archived'],
  drafting: ['in_review', 'idea', 'blocked', 'archived'],
  in_review: ['approved', 'drafting', 'blocked', 'archived'],
  approved: ['scheduled', 'published', 'in_review', 'drafting', 'archived'],
  scheduled: ['published', 'approved', 'blocked', 'archived'],
  published: ['archived'],
  blocked: ['drafting', 'archived'],
  archived: ['drafting'],
};

export function canTransitionContent(from: ContentStatus, to: ContentStatus): boolean {
  return CONTENT_TRANSITIONS[from].includes(to);
}

export const contentFormatSchema = z.enum([
  'post',
  'article',
  'newsletter',
  'video',
  'short',
  'carousel',
  'email',
]);
export type ContentFormat = z.infer<typeof contentFormatSchema>;

/** Destinations the domain knows. None of them is reachable from this bundle. */
export const contentPlatformSchema = z.enum([
  'linkedin',
  'facebook',
  'youtube',
  'newsletter',
  'blog',
  'x',
]);
export type ContentPlatform = z.infer<typeof contentPlatformSchema>;

/**
 * Per-platform copy for one package. Embedded on the item rather than stored
 * separately: a variant has no life of its own and is always read with its parent.
 */
export const platformVariantSchema = z.object({
  platform: contentPlatformSchema,
  body: z.string().default(''),
  hookId: idSchema.optional(),
  ctaId: idSchema.optional(),
  /** Operator-recorded publish. No social API has ever confirmed anything here. */
  publishedAt: isoTimestamp.optional(),
});
export type PlatformVariant = z.infer<typeof platformVariantSchema>;

export const contentItemSchema = recordBase.extend({
  title: z.string().min(1),
  status: contentStatusSchema,
  format: contentFormatSchema.default('post'),
  /** Free-text channel kept from Wave 1; `platform` is the typed destination. */
  channel: z.string().default(''),
  platform: contentPlatformSchema.optional(),
  /** The publish date. One date field, whether the item is scheduled or shipped. */
  scheduledFor: isoTimestamp.optional(),
  publishedAt: isoTimestamp.optional(),
  blockedReason: z.string().optional(),
  body: z.string().default(''),
  ideaId: idSchema.optional(),
  campaignId: idSchema.optional(),
  /** Repurposing: a cut-down points at the package it came from. */
  parentId: idSchema.optional(),
  templateId: idSchema.optional(),
  hookId: idSchema.optional(),
  ctaId: idSchema.optional(),
  assetIds: z.array(idSchema).default([]),
  variants: z.array(platformVariantSchema).default([]),
  /** Video tracking lives on the item: a script and a runtime, not a second entity. */
  videoScript: z.string().default(''),
  durationSeconds: z.number().int().positive().optional(),
  /** The Approval Queue gate opened when this item was submitted for review. */
  approvalId: idSchema.optional(),
  complianceCheckedAt: isoTimestamp.optional(),
  complianceSummary: z.string().default(''),
  tags: z.array(z.string()).default([]),
});
export type ContentItem = z.infer<typeof contentItemSchema>;

export const contentIdeaStatusSchema = z.enum(['captured', 'promoted', 'parked', 'discarded']);
export type ContentIdeaStatus = z.infer<typeof contentIdeaStatusSchema>;

/**
 * Scores are the operator's own 1–5 judgement, not a model output. The vault
 * ranks on them arithmetically and says so.
 */
const ideaScoreField = z.number().int().min(1).max(5);

export const contentIdeaSchema = recordBase.extend({
  title: z.string().min(1),
  summary: z.string().default(''),
  status: contentIdeaStatusSchema.default('captured'),
  reach: ideaScoreField.default(3),
  effort: ideaScoreField.default(3),
  confidence: ideaScoreField.default(3),
  origin: z.string().default(''),
  tags: z.array(z.string()).default([]),
  campaignId: idSchema.optional(),
  /** Set when the idea became a draft, so the vault stops offering it twice. */
  promotedItemId: idSchema.optional(),
});
export type ContentIdea = z.infer<typeof contentIdeaSchema>;

export const campaignStatusSchema = z.enum(['planning', 'active', 'complete', 'archived']);
export type CampaignStatus = z.infer<typeof campaignStatusSchema>;

export const campaignSchema = recordBase.extend({
  name: z.string().min(1),
  objective: z.string().default(''),
  status: campaignStatusSchema,
  startAt: isoTimestamp.optional(),
  endAt: isoTimestamp.optional(),
  /** What the campaign is for, in the operator's words. Not a target number. */
  goal: z.string().default(''),
  /** The objective the arc serves. Content rolls up to a mission through this. */
  missionId: idSchema.optional(),
});
export type Campaign = z.infer<typeof campaignSchema>;

export const contentAssetKindSchema = z.enum(['image', 'video', 'document', 'link', 'audio']);
export type ContentAssetKind = z.infer<typeof contentAssetKindSchema>;

export const contentAssetSchema = recordBase.extend({
  title: z.string().min(1),
  kind: contentAssetKindSchema,
  /** Where the file lives. Metadata only — nothing is uploaded or hosted here. */
  location: z.string().default(''),
  notes: z.string().default(''),
  tags: z.array(z.string()).default([]),
});
export type ContentAsset = z.infer<typeof contentAssetSchema>;

export const contentTemplateSchema = recordBase.extend({
  title: z.string().min(1),
  format: contentFormatSchema,
  structure: z.string().default(''),
  whenToUse: z.string().default(''),
});
export type ContentTemplate = z.infer<typeof contentTemplateSchema>;

export const hookStyleSchema = z.enum(['question', 'contrarian', 'story', 'statistic', 'promise']);
export type HookStyle = z.infer<typeof hookStyleSchema>;

export const hookSchema = recordBase.extend({
  text: z.string().min(1),
  style: hookStyleSchema,
  notes: z.string().default(''),
  platform: contentPlatformSchema.optional(),
});
export type Hook = z.infer<typeof hookSchema>;

export const ctaIntentSchema = z.enum([
  'book_call',
  'subscribe',
  'reply',
  'download',
  'share',
  'follow',
]);
export type CtaIntent = z.infer<typeof ctaIntentSchema>;

export const ctaSchema = recordBase.extend({
  text: z.string().min(1),
  intent: ctaIntentSchema,
  destination: z.string().default(''),
  notes: z.string().default(''),
});
export type Cta = z.infer<typeof ctaSchema>;

/**
 * One reading of one item's performance on one platform. Recorded by hand or
 * seeded; there is no analytics connector, so `method` says how it got here.
 */
export const contentMetricSchema = recordBase.extend({
  contentItemId: idSchema,
  platform: contentPlatformSchema,
  capturedAt: isoTimestamp,
  impressions: z.number().int().nonnegative(),
  engagements: z.number().int().nonnegative(),
  clicks: z.number().int().nonnegative().default(0),
  conversions: z.number().int().nonnegative().default(0),
  method: z.enum(['manual', 'seed']).default('manual'),
});
export type ContentMetric = z.infer<typeof contentMetricSchema>;

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
    /** Wave 5: knowledge, memory, documents, decisions, research, agent turns. */
    'cognition',
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
