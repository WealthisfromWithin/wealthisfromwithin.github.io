import { describe, expect, it } from 'vitest';
import { emptyDataset } from '@/data/dataset';
import { buildDemoDataset } from '@/data/seed';
import { BRIEF_QUESTIONS, buildMorningBrief } from './brief';

const now = new Date('2026-08-05T07:30:00.000Z');

describe('buildMorningBrief', () => {
  it('always answers the six questions in order', () => {
    const brief = buildMorningBrief(emptyDataset, now);
    expect(brief.sections.map((section) => section.id)).toEqual([...BRIEF_QUESTIONS]);
  });

  it('renders empty states rather than inventing content', () => {
    const brief = buildMorningBrief(emptyDataset, now);
    for (const section of brief.sections) {
      expect(section.items).toHaveLength(0);
      expect(section.emptyMessage.length).toBeGreaterThan(0);
    }
    expect(brief.demoItemCount).toBe(0);
  });

  it('populates every question from the demo seed', () => {
    const brief = buildMorningBrief(buildDemoDataset(now), now);
    for (const section of brief.sections) {
      expect(section.items.length).toBeGreaterThan(0);
    }
  });

  it('badges seeded rows as demo', () => {
    const brief = buildMorningBrief(buildDemoDataset(now), now);
    const attention = brief.sections.find((section) => section.id === 'attention');
    expect(attention?.items.some((item) => item.demo)).toBe(true);
    expect(brief.demoItemCount).toBeGreaterThan(0);
  });

  it('surfaces the credential gap without claiming a connection', () => {
    const brief = buildMorningBrief(buildDemoDataset(now), now);
    const attention = brief.sections.find((section) => section.id === 'attention');
    const credentialItem = attention?.items.find((item) => item.id === 'integrations:awaiting');
    expect(credentialItem?.demo).toBe(false);
    expect(credentialItem?.title).toMatch(/await credentials$/);
  });

  it('lists only blocked work in the blocked section, each with a reason', () => {
    const brief = buildMorningBrief(buildDemoDataset(now), now);
    const blocked = brief.sections.find((section) => section.id === 'blocked');
    expect(blocked?.items.length).toBeGreaterThan(0);
    for (const item of blocked?.items ?? []) {
      expect(item.detail.length).toBeGreaterThan(0);
    }
  });

  it('limits the overnight section to the last 24 hours', () => {
    const dataset = buildDemoDataset(now);
    const overnight = buildMorningBrief(dataset, now).sections.find(
      (section) => section.id === 'overnight',
    );
    const ids = new Set(overnight?.items.map((item) => item.id));
    expect(ids.has('event:e-stale')).toBe(false);
    expect(ids.has('event:e-truoak-open')).toBe(true);
  });

  it('ranks opportunities by expected value', () => {
    const dataset = buildDemoDataset(now);
    const opportunities = buildMorningBrief(dataset, now).sections.find(
      (section) => section.id === 'opportunities',
    );
    expect(opportunities?.items[0]?.id).toBe('opportunity:opp-truoak');
  });

  it('excludes blocked and completed work from today', () => {
    const dataset = buildDemoDataset(now);
    const today = buildMorningBrief(dataset, now).sections.find(
      (section) => section.id === 'today',
    );
    const ids = new Set(today?.items.map((item) => item.id));
    expect(ids.has('task:t-publish-loop')).toBe(false);
    expect(ids.has('task:t-shipped-shell')).toBe(false);
  });
});
