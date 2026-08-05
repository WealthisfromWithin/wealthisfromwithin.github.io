import { describe, expect, it } from 'vitest';
import { emptyDataset } from '@/data/dataset';
import { buildDemoDataset } from '@/data/seed';
import {
  findPrompt,
  parsePromptFilter,
  promptCounts,
  promptSegments,
  promptSessions,
  selectPrompts,
} from './prompts';

const now = new Date('2026-08-05T07:30:00.000Z');
const dataset = buildDemoDataset(now);

describe('prompt filter', () => {
  it('defaults to every intent', () => {
    expect(parsePromptFilter(null)).toBe('all');
    expect(parsePromptFilter('vibe')).toBe('all');
    expect(parsePromptFilter('critique')).toBe('critique');
  });
});

describe('selectPrompts', () => {
  it('ranks by how often a prompt was used, not by how well it worked', () => {
    const rows = selectPrompts(dataset);

    expect(rows[0]?.id).toBe('pr-meeting-debrief');
    for (let index = 1; index < rows.length; index += 1) {
      expect((rows[index - 1]?.useCount ?? 0) >= (rows[index]?.useCount ?? 0)).toBe(true);
    }
  });

  it('filters by intent', () => {
    const rows = selectPrompts(dataset, 'draft');

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((prompt) => prompt.intent === 'draft')).toBe(true);
  });

  it('holds nothing for an empty store', () => {
    expect(selectPrompts(emptyDataset)).toHaveLength(0);
    expect(promptCounts(emptyDataset).total).toBe(0);
  });
});

describe('promptCounts', () => {
  it('counts what has been used and what sits behind a gate', () => {
    const counts = promptCounts(dataset);

    expect(counts.total).toBe(dataset.prompts.length);
    expect(counts.used).toBe(dataset.prompts.filter((prompt) => prompt.useCount > 0).length);
    expect(counts.gated).toBe(dataset.prompts.filter((prompt) => prompt.requiresApproval).length);
  });
});

describe('promptSegments', () => {
  it('splits the body around its placeholders without rewriting the text', () => {
    const segments = promptSegments('Draft for {{audience}} about {{topic}}.');

    expect(segments.map((segment) => [segment.variable, segment.text])).toEqual([
      [false, 'Draft for '],
      [true, 'audience'],
      [false, ' about '],
      [true, 'topic'],
      [false, '.'],
    ]);
  });

  it('leaves a body with no placeholders as one plain segment', () => {
    const segments = promptSegments('No variables here.');

    expect(segments).toHaveLength(1);
    expect(segments[0]?.variable).toBe(false);
  });

  it('gives every segment a unique key', () => {
    const segments = promptSegments('{{a}} and {{b}} and {{a}}');
    expect(new Set(segments.map((segment) => segment.id)).size).toBe(segments.length);
  });
});

describe('promptSessions', () => {
  it('lists the sessions started from a prompt, newest first', () => {
    const prompt = findPrompt(dataset, 'pr-renewal-memo');
    expect(prompt).toBeDefined();
    if (!prompt) return;

    expect(promptSessions(dataset, prompt).map((session) => session.id)).toEqual([
      'ags-renewal-memo',
    ]);
  });

  it('finds nothing for an id the store does not hold', () => {
    expect(findPrompt(dataset, 'pr-nope')).toBeUndefined();
    expect(findPrompt(dataset, undefined)).toBeUndefined();
  });
});
