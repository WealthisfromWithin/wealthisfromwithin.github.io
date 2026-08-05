import { describe, expect, it } from 'vitest';
import { emptyDataset, type SovereignDataset } from '@/data/dataset';
import { buildDemoDataset } from '@/data/seed';
import { CONTENT_TRANSITIONS, canTransitionContent, contentStatusSchema } from '@/domain';
import { DAY_MS } from '@/lib/clock';
import {
  CONTENT_PIPELINE,
  campaignRollups,
  contentAwaitingApproval,
  contentCalendar,
  contentCounts,
  contentDueToday,
  contentItemLinks,
  contentLoop,
  findContentItem,
  ideaScore,
  isPastDue,
  libraryUsage,
  parseContentQuery,
  parseIdeaFilter,
  parseLibraryType,
  selectContentItems,
  selectIdeas,
} from './content';

const now = new Date('2026-08-05T07:30:00.000Z');
const dataset = buildDemoDataset(now);

function withItem(id: string, patch: Partial<SovereignDataset['contentItems'][number]>): SovereignDataset {
  return {
    ...dataset,
    contentItems: dataset.contentItems.map((item) =>
      item.id === id ? { ...item, ...patch } : item,
    ),
  };
}

describe('content status machine', () => {
  it('covers every status and never leaves one stranded', () => {
    expect(Object.keys(CONTENT_TRANSITIONS).sort()).toEqual(
      [...contentStatusSchema.options].sort(),
    );
    for (const status of contentStatusSchema.options) {
      expect({ status, moves: CONTENT_TRANSITIONS[status].length > 0 }).toEqual({
        status,
        moves: true,
      });
    }
  });

  it('runs the production order forwards', () => {
    expect(CONTENT_PIPELINE).toEqual([
      'idea',
      'drafting',
      'in_review',
      'approved',
      'scheduled',
      'published',
    ]);
    expect(canTransitionContent('idea', 'drafting')).toBe(true);
    expect(canTransitionContent('drafting', 'in_review')).toBe(true);
    expect(canTransitionContent('in_review', 'approved')).toBe(true);
    expect(canTransitionContent('approved', 'scheduled')).toBe(true);
    expect(canTransitionContent('scheduled', 'published')).toBe(true);
  });

  it('refuses to skip the gate on the way to published', () => {
    expect(canTransitionContent('idea', 'published')).toBe(false);
    expect(canTransitionContent('drafting', 'published')).toBe(false);
    expect(canTransitionContent('drafting', 'approved')).toBe(false);
    expect(canTransitionContent('in_review', 'scheduled')).toBe(false);
  });

  it('lets work fall back but never lets a publish be undone', () => {
    expect(canTransitionContent('in_review', 'drafting')).toBe(true);
    expect(canTransitionContent('scheduled', 'approved')).toBe(true);
    expect(canTransitionContent('published', 'drafting')).toBe(false);
    expect(canTransitionContent('published', 'archived')).toBe(true);
  });
});

describe('production queue', () => {
  it('defaults to work in production and drops what has shipped or retired', () => {
    const ids = selectContentItems(dataset).map((item) => item.id);
    expect(ids).toContain('c-constraint');
    expect(ids).not.toContain('c-compounding-essay');
    expect(ids).not.toContain('c-doctrine-carousel');
  });

  it('puts what cannot move, then what needs a decision, at the top', () => {
    const statuses = selectContentItems(dataset).map((item) => item.status);
    expect(statuses[0]).toBe('blocked');
    expect(statuses.indexOf('in_review')).toBeLessThan(statuses.indexOf('drafting'));
    expect(statuses.indexOf('approved')).toBeLessThan(statuses.indexOf('idea'));
  });

  it('filters on status and format independently', () => {
    expect(
      selectContentItems(dataset, { status: 'published', format: 'all' }).every(
        (item) => item.status === 'published',
      ),
    ).toBe(true);
    expect(
      selectContentItems(dataset, { status: 'all', format: 'video' }).map((item) => item.id),
    ).toEqual(['c-audit-walkthrough']);
  });

  it('reads its query from the URL and falls back to production', () => {
    expect(parseContentQuery(new URLSearchParams('status=scheduled&format=post'))).toEqual({
      status: 'scheduled',
      format: 'post',
    });
    expect(parseContentQuery(new URLSearchParams('status=exploded'))).toEqual({
      status: 'active',
      format: 'all',
    });
  });

  it('counts every status plus the dates that have passed', () => {
    const counts = contentCounts(dataset, now);
    expect(counts.total).toBe(dataset.contentItems.length);
    expect(counts.in_review).toBe(1);
    expect(counts.published).toBe(4);
    expect(counts.dueToday).toBe(2);
    expect(counts.active + counts.published + counts.archived).toBe(counts.total);
  });

  it('treats a passed date as overdue only while the item is unpublished', () => {
    const overdue = withItem('c-renewal-proof', {
      scheduledFor: new Date(now.getTime() - 3 * DAY_MS).toISOString(),
    });
    expect(isPastDue(overdue.contentItems.find((item) => item.id === 'c-renewal-proof')!, now)).toBe(
      true,
    );
    expect(
      isPastDue(dataset.contentItems.find((item) => item.id === 'c-compounding-essay')!, now),
    ).toBe(false);
  });

  it('lists what carries today as its publish date, in clock order', () => {
    const due = contentDueToday(dataset, now).map((item) => item.id);
    expect(due).toEqual(['c-constraint', 'c-advisory-loop']);
  });

  it('lists what is holding a gate open', () => {
    expect(contentAwaitingApproval(dataset).map((item) => item.id)).toEqual(['c-constraint']);
  });
});

describe('joins', () => {
  it('resolves everything a package was built from', () => {
    const item = findContentItem(dataset, 'c-constraint');
    expect(item).toBeDefined();
    const links = contentItemLinks(dataset, item!);

    expect(links.campaign?.id).toBe('cmp-compounding');
    expect(links.hook?.id).toBe('hk-constraint');
    expect(links.cta?.id).toBe('cta-book-call');
    expect(links.template?.id).toBe('tpl-constraint-essay');
    expect(links.assets.map((asset) => asset.id)).toEqual(['ast-constraint-diagram']);
    expect(links.approval?.id).toBe('apr-linkedin');
  });

  it('links a repurposed cut to the package it came from, in both directions', () => {
    const short = findContentItem(dataset, 'c-constraint-short');
    const parent = findContentItem(dataset, 'c-compounding-essay');

    expect(contentItemLinks(dataset, short!).parent?.id).toBe('c-compounding-essay');
    expect(contentItemLinks(dataset, parent!).children.map((child) => child.id)).toEqual([
      'c-constraint-short',
    ]);
  });

  it('returns nothing rather than guessing for an id the store does not hold', () => {
    expect(findContentItem(dataset, 'c-nobody')).toBeUndefined();
    expect(findContentItem(dataset, undefined)).toBeUndefined();
  });
});

describe('publishing calendar', () => {
  it('places dated items on their day and leaves empty days empty', () => {
    const calendar = contentCalendar(dataset, now);
    const today = calendar.days.find((day) => day.isToday);

    expect(calendar.days).toHaveLength(7);
    expect(today?.items.map((item) => item.id)).toEqual(['c-constraint', 'c-advisory-loop']);
    expect(calendar.days.every((day) => day.items.every((item) => item.scheduledFor))).toBe(true);
  });

  it('never invents a day for an undated item', () => {
    const calendar = contentCalendar(dataset, now);
    const dated = calendar.days.flatMap((day) => day.items).map((item) => item.id);

    expect(dated).not.toContain('c-idea-leverage');
    expect(calendar.undated.map((item) => item.id)).toContain('c-idea-leverage');
    expect(calendar.undated.every((item) => item.scheduledFor === undefined)).toBe(true);
  });

  it('moves with the requested week', () => {
    const next = contentCalendar(dataset, now, 'next');
    expect(next.start.getTime()).toBeGreaterThan(contentCalendar(dataset, now).start.getTime());
    expect(next.days.flatMap((day) => day.items)).toHaveLength(0);
  });

  it('separates what is still scheduled from what already shipped', () => {
    const calendar = contentCalendar(dataset, now);
    expect(calendar.scheduledCount).toBeGreaterThan(0);
    expect(calendar.publishedCount).toBe(0);
  });
});

describe('idea vault', () => {
  it('scores reach × confidence ÷ effort on the recorded numbers', () => {
    const idea = dataset.contentIdeas.find((row) => row.id === 'idea-leverage-inventory');
    expect(ideaScore(idea!)).toBe(6.7);
  });

  it('ranks captured ideas by that score', () => {
    const scores = selectIdeas(dataset).map((idea) => ideaScore(idea));
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(selectIdeas(dataset).every((idea) => idea.status === 'captured')).toBe(true);
  });

  it('reads its filter from the URL and defaults to captured', () => {
    expect(parseIdeaFilter('parked')).toBe('parked');
    expect(parseIdeaFilter('nonsense')).toBe('captured');
    expect(parseIdeaFilter(null)).toBe('captured');
  });
});

describe('campaigns', () => {
  it('counts production from the items pointing at each campaign', () => {
    const rollup = campaignRollups(dataset).find(
      (entry) => entry.campaign.id === 'cmp-compounding',
    );

    expect(rollup?.campaign.status).toBe('active');
    expect(rollup?.items.length).toBe(
      dataset.contentItems.filter((item) => item.campaignId === 'cmp-compounding').length,
    );
    expect(rollup?.published).toBe(1);
    expect(rollup?.ideas).toBe(2);
    expect(rollup?.nextPublishAt).toBeDefined();
  });

  it('puts active campaigns first', () => {
    expect(campaignRollups(dataset)[0]?.campaign.status).toBe('active');
  });
});

describe('libraries', () => {
  it('counts usage from the items that reference a row, variants included', () => {
    expect(libraryUsage(dataset, 'hooks', 'hk-constraint')).toBe(3);
    expect(libraryUsage(dataset, 'ctas', 'cta-book-call')).toBe(4);
    expect(libraryUsage(dataset, 'assets', 'ast-constraint-diagram')).toBe(2);
    expect(libraryUsage(dataset, 'templates', 'tpl-constraint-essay')).toBe(4);
    expect(libraryUsage(dataset, 'hooks', 'hk-nobody')).toBe(0);
  });

  it('defaults the library filter to hooks', () => {
    expect(parseLibraryType('assets')).toBe('assets');
    expect(parseLibraryType('nonsense')).toBe('hooks');
  });
});

describe('daily content loop', () => {
  it('counts each step from the store and links where it is cleared', () => {
    const loop = contentLoop(dataset, now);

    expect(loop.map((step) => step.id)).toEqual(['capture', 'draft', 'gate', 'ship']);
    expect(loop.find((step) => step.id === 'gate')?.count).toBe(1);
    expect(loop.find((step) => step.id === 'ship')?.count).toBe(2);
    expect(loop.every((step) => step.href.startsWith('/content'))).toBe(true);
  });

  it('reports zeros rather than nothing on an empty store', () => {
    expect(contentLoop(emptyDataset, now).every((step) => step.count === 0)).toBe(true);
  });
});
