import { z } from 'zod';
import { idSchema, isoTimestamp, prioritySchema, recordBase, severitySchema } from './common';

/**
 * Wave 5 domain: what the operator knows, what the system must remember, what
 * was decided, what is still being asked, and every local agent turn.
 *
 * Nothing here is produced by a model. A field that would need generation to be
 * true — a summary, an answer, a completion — is either written by the operator
 * or left empty, and `AgentMessage.generated` records which of the two happened.
 */

/* ── Knowledge ──────────────────────────────────────────────────────────── */

export const knowledgeKindSchema = z.enum([
  'note',
  'insight',
  'reference',
  'playbook',
  'question',
]);
export type KnowledgeKind = z.infer<typeof knowledgeKindSchema>;

export const knowledgeNodeSchema = recordBase.extend({
  title: z.string().min(1),
  kind: knowledgeKindSchema.default('note'),
  summary: z.string().default(''),
  body: z.string().default(''),
  tags: z.array(z.string()).default([]),
  /** Where it came from, in the operator's words. Not row provenance. */
  origin: z.string().default(''),
  /** Local joins. A node points at the records it is about; none point back. */
  personIds: z.array(idSchema).default([]),
  companyId: idSchema.optional(),
  opportunityId: idSchema.optional(),
  contentItemId: idSchema.optional(),
  meetingId: idSchema.optional(),
  documentIds: z.array(idSchema).default([]),
  relatedNodeIds: z.array(idSchema).default([]),
  pinned: z.boolean().default(false),
  reviewedAt: isoTimestamp.optional(),
  archivedAt: isoTimestamp.optional(),
});
export type KnowledgeNode = z.infer<typeof knowledgeNodeSchema>;

/* ── Memory ─────────────────────────────────────────────────────────────── */

export const memoryKindSchema = z.enum(['fact', 'preference', 'constraint', 'context', 'lesson']);
export type MemoryKind = z.infer<typeof memoryKindSchema>;

/** Who or what the memory governs. A preference about the operator is not a fact about a client. */
export const memoryScopeSchema = z.enum(['operator', 'business', 'relationship', 'system']);
export type MemoryScope = z.infer<typeof memoryScopeSchema>;

/**
 * How the memory was obtained. Deliberately a provenance word rather than a
 * number: a percentage would be a confidence score nobody measured.
 */
export const memoryConfidenceSchema = z.enum(['stated', 'observed', 'inferred']);
export type MemoryConfidence = z.infer<typeof memoryConfidenceSchema>;

export const memoryEntrySchema = recordBase.extend({
  statement: z.string().min(1),
  kind: memoryKindSchema,
  scope: memoryScopeSchema.default('operator'),
  detail: z.string().default(''),
  origin: z.string().default(''),
  confidence: memoryConfidenceSchema.default('stated'),
  tags: z.array(z.string()).default([]),
  personId: idSchema.optional(),
  companyId: idSchema.optional(),
  decisionId: idSchema.optional(),
  knowledgeNodeId: idSchema.optional(),
  /** Pinned memories lead every list: they are the ones that must not be missed. */
  pinned: z.boolean().default(false),
  /** A durable memory decays. Past this date the surface asks for a re-confirmation. */
  reviewAt: isoTimestamp.optional(),
  lastRecalledAt: isoTimestamp.optional(),
  recallCount: z.number().int().nonnegative().default(0),
  /** Retired rather than deleted: a memory that stopped being true is history. */
  retiredAt: isoTimestamp.optional(),
});
export type MemoryEntry = z.infer<typeof memoryEntrySchema>;

/* ── Documents ──────────────────────────────────────────────────────────── */

export const documentKindSchema = z.enum([
  'brief',
  'proposal',
  'memo',
  'sop',
  'transcript',
  'reference',
]);
export type DocumentKind = z.infer<typeof documentKindSchema>;

export const documentStatusSchema = z.enum(['draft', 'final', 'archived']);
export type DocumentStatus = z.infer<typeof documentStatusSchema>;

/**
 * The body is plain text or markdown source held locally. It is rendered as text
 * nodes — never as HTML — so a document cannot inject markup into the surface
 * (ARCHITECTURE_AUDIT §5.9).
 */
export const documentSchema = recordBase.extend({
  title: z.string().min(1),
  kind: documentKindSchema.default('memo'),
  status: documentStatusSchema.default('draft'),
  summary: z.string().default(''),
  body: z.string().default(''),
  format: z.enum(['markdown', 'text']).default('markdown'),
  author: z.string().default('Operator'),
  tags: z.array(z.string()).default([]),
  companyId: idSchema.optional(),
  personId: idSchema.optional(),
  opportunityId: idSchema.optional(),
  projectId: idSchema.optional(),
  meetingId: idSchema.optional(),
  /** Where the original lives when it lives elsewhere. Metadata only; nothing is uploaded. */
  location: z.string().default(''),
  reviewedAt: isoTimestamp.optional(),
});
export type SovereignDocument = z.infer<typeof documentSchema>;

/* ── Decisions ──────────────────────────────────────────────────────────── */

/**
 * A decision is open, made, replaced by a later one, or abandoned. There is no
 * "in progress": a decision nobody has made is `proposed`.
 */
export const decisionStatusSchema = z.enum(['proposed', 'decided', 'superseded', 'withdrawn']);
export type DecisionStatus = z.infer<typeof decisionStatusSchema>;

/**
 * The legal moves. A decided call can be superseded by a later one or reopened
 * to `proposed` — an operator who changes their mind must be able to say so —
 * but a withdrawn or superseded decision is closed history and stays closed.
 */
export const DECISION_TRANSITIONS: Record<DecisionStatus, readonly DecisionStatus[]> = {
  proposed: ['decided', 'withdrawn'],
  decided: ['superseded', 'proposed'],
  superseded: [],
  withdrawn: [],
};

export function canTransitionDecision(from: DecisionStatus, to: DecisionStatus): boolean {
  return DECISION_TRANSITIONS[from].includes(to);
}

export const decisionSchema = recordBase.extend({
  title: z.string().min(1),
  status: decisionStatusSchema.default('proposed'),
  /** The question, before anyone answered it. */
  context: z.string().default(''),
  /** The answer. Empty until the decision is made. */
  choice: z.string().default(''),
  rationale: z.string().default(''),
  alternatives: z.array(z.string()).default([]),
  consequences: z.string().default(''),
  impact: severitySchema.default('info'),
  /** A reversible call needs less deliberation than a one-way door. */
  reversible: z.boolean().default(true),
  dueAt: isoTimestamp.optional(),
  decidedAt: isoTimestamp.optional(),
  decidedBy: z.string().optional(),
  reviewAt: isoTimestamp.optional(),
  supersededById: idSchema.optional(),
  tags: z.array(z.string()).default([]),
  personIds: z.array(idSchema).default([]),
  companyId: idSchema.optional(),
  opportunityId: idSchema.optional(),
  projectId: idSchema.optional(),
  contentItemId: idSchema.optional(),
  knowledgeNodeId: idSchema.optional(),
});
export type Decision = z.infer<typeof decisionSchema>;

/* ── Prompts ────────────────────────────────────────────────────────────── */

export const promptIntentSchema = z.enum([
  'draft',
  'analyse',
  'summarise',
  'plan',
  'critique',
  'extract',
]);
export type PromptIntent = z.infer<typeof promptIntentSchema>;

/**
 * A reusable instruction. It is browsable and editable with no provider
 * configured; running one is the Agent Kernel's business, not the library's.
 */
export const promptSchema = recordBase.extend({
  title: z.string().min(1),
  intent: promptIntentSchema.default('draft'),
  body: z.string().default(''),
  notes: z.string().default(''),
  tags: z.array(z.string()).default([]),
  /** Declared `{{placeholders}}` the operator is expected to fill before running. */
  variables: z.array(z.string()).default([]),
  providerPreference: z.array(z.string()).default([]),
  /** WITHIN default: anything customer-facing passes a human gate. */
  requiresApproval: z.boolean().default(true),
  useCount: z.number().int().nonnegative().default(0),
  lastUsedAt: isoTimestamp.optional(),
});
export type Prompt = z.infer<typeof promptSchema>;

/* ── Research ───────────────────────────────────────────────────────────── */

export const researchStatusSchema = z.enum(['queued', 'active', 'answered', 'parked']);
export type ResearchStatus = z.infer<typeof researchStatusSchema>;

/**
 * One finding, written by hand. `source` is free text — a title, a citation, a
 * URL the operator typed — and is rendered as text, never as a link: this
 * surface has no crawler and must not look as though it followed anything.
 */
export const researchFindingSchema = z.object({
  at: isoTimestamp,
  note: z.string().min(1),
  source: z.string().default(''),
});
export type ResearchFinding = z.infer<typeof researchFindingSchema>;

export const researchItemSchema = recordBase.extend({
  question: z.string().min(1),
  topic: z.string().default(''),
  status: researchStatusSchema.default('queued'),
  priority: prioritySchema.default('normal'),
  dueAt: isoTimestamp.optional(),
  /** Every finding here was recorded locally. No connector fetched anything. */
  findings: z.array(researchFindingSchema).default([]),
  answer: z.string().default(''),
  answeredAt: isoTimestamp.optional(),
  tags: z.array(z.string()).default([]),
  knowledgeNodeId: idSchema.optional(),
  opportunityId: idSchema.optional(),
  contentIdeaId: idSchema.optional(),
  companyId: idSchema.optional(),
});
export type ResearchItem = z.infer<typeof researchItemSchema>;

/* ── Agent sessions ─────────────────────────────────────────────────────── */

export const agentSessionSchema = recordBase.extend({
  title: z.string().min(1),
  /** Passed to the kernel with every turn, so a refusal can name what it refused. */
  intent: z.string().default('workspace'),
  promptId: idSchema.optional(),
  providerPreference: z.array(z.string()).default([]),
  requiresApproval: z.boolean().default(true),
  lastActivityAt: isoTimestamp,
  /** Turns the kernel could not run. The Brief counts these; it never hides them. */
  unansweredCount: z.number().int().nonnegative().default(0),
  closedAt: isoTimestamp.optional(),
});
export type AgentSession = z.infer<typeof agentSessionSchema>;

export const agentMessageRoleSchema = z.enum(['system', 'user', 'assistant']);
export type AgentMessageRole = z.infer<typeof agentMessageRoleSchema>;

/**
 * What happened to one turn. `refused` is a first-class outcome: the kernel
 * declining to run is the normal state of this surface, and it is recorded as
 * plainly as a completion would be.
 */
export const agentOutcomeSchema = z.enum(['sent', 'generated', 'refused']);
export type AgentOutcome = z.infer<typeof agentOutcomeSchema>;

export const agentMessageSchema = recordBase.extend({
  sessionId: idSchema,
  role: agentMessageRoleSchema,
  content: z.string().default(''),
  at: isoTimestamp,
  /**
   * True only when a provider produced the text. A refusal, an operator note,
   * and a seeded example are all `false`, so nothing in the store can be
   * mistaken for model output that never happened.
   */
  generated: z.boolean().default(false),
  provider: z.string().optional(),
  outcome: agentOutcomeSchema.default('sent'),
  /** The kernel's refusal code, when the turn was refused. */
  reason: z.string().optional(),
});
export type AgentMessage = z.infer<typeof agentMessageSchema>;
