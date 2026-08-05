import type { SovereignDataset } from '@/data/dataset';
import type { AgentSession, Prompt, PromptIntent } from '@/domain';

/* ── Vocabulary ─────────────────────────────────────────────────────────── */

export const promptIntentLabel: Record<PromptIntent, string> = {
  draft: 'Draft',
  analyse: 'Analyse',
  summarise: 'Summarise',
  plan: 'Plan',
  critique: 'Critique',
  extract: 'Extract',
};

/* ── Query ──────────────────────────────────────────────────────────────── */

export const PROMPT_FILTERS = [
  'all',
  'draft',
  'analyse',
  'summarise',
  'plan',
  'critique',
  'extract',
] as const;
export type PromptFilter = (typeof PROMPT_FILTERS)[number];

export const promptFilterLabel: Record<PromptFilter, string> = {
  all: 'Any intent',
  ...promptIntentLabel,
};

export function parsePromptFilter(value: string | null): PromptFilter {
  return PROMPT_FILTERS.find((filter) => filter === value) ?? 'all';
}

export interface PromptCounts extends Record<PromptIntent, number> {
  total: number;
  used: number;
  gated: number;
}

export function promptCounts(dataset: SovereignDataset): PromptCounts {
  const counts: PromptCounts = {
    total: dataset.prompts.length,
    used: 0,
    gated: 0,
    draft: 0,
    analyse: 0,
    summarise: 0,
    plan: 0,
    critique: 0,
    extract: 0,
  };

  for (const prompt of dataset.prompts) {
    counts[prompt.intent] += 1;
    if (prompt.useCount > 0) counts.used += 1;
    if (prompt.requiresApproval) counts.gated += 1;
  }

  return counts;
}

/**
 * Most used first. Use count is a count of times the operator started a session
 * from the prompt — not a measure of how well it worked, which nothing here
 * records.
 */
export function selectPrompts(dataset: SovereignDataset, filter: PromptFilter = 'all'): Prompt[] {
  return dataset.prompts
    .filter((prompt) => filter === 'all' || prompt.intent === filter)
    .sort((a, b) => b.useCount - a.useCount || a.title.localeCompare(b.title));
}

export function findPrompt(dataset: SovereignDataset, id: string | undefined): Prompt | undefined {
  if (id === undefined) return undefined;
  return dataset.prompts.find((prompt) => prompt.id === id);
}

/** Sessions started from a prompt, newest first. */
export function promptSessions(dataset: SovereignDataset, prompt: Prompt): AgentSession[] {
  return dataset.agentSessions
    .filter((session) => session.promptId === prompt.id)
    .sort((a, b) => Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt));
}

/**
 * Splits a prompt body around its `{{placeholders}}` so the surface can render
 * the variables distinctly without interpreting anything else in the text.
 */
export interface PromptSegment {
  id: string;
  text: string;
  variable: boolean;
}

export function promptSegments(body: string): PromptSegment[] {
  const segments: PromptSegment[] = [];
  const pattern = /\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g;
  let index = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(body)) !== null) {
    if (match.index > index) {
      segments.push({
        id: `s${String(segments.length)}`,
        text: body.slice(index, match.index),
        variable: false,
      });
    }
    segments.push({ id: `s${String(segments.length)}`, text: match[1] ?? '', variable: true });
    index = match.index + match[0].length;
  }

  if (index < body.length) {
    segments.push({ id: `s${String(segments.length)}`, text: body.slice(index), variable: false });
  }

  return segments;
}
