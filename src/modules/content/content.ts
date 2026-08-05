import type { SovereignDataset } from '@/data/dataset';
import type {
  Approval,
  Campaign,
  ContentAsset,
  ContentFormat,
  ContentIdea,
  ContentIdeaStatus,
  ContentItem,
  ContentPlatform,
  ContentStatus,
  ContentTemplate,
  Cta,
  Hook,
} from '@/domain';
import { addDays, dateKey, endOfDay, formatDayLabel, isSameDay, startOfDay } from '@/lib/clock';
import { weekRange, type CalendarWeek } from '@/modules/calendar/calendar';

/* ── Vocabulary ─────────────────────────────────────────────────────────── */

export const contentStatusLabel: Record<ContentStatus, string> = {
  idea: 'Idea',
  drafting: 'Drafting',
  in_review: 'In review',
  approved: 'Approved',
  scheduled: 'Scheduled',
  published: 'Published',
  archived: 'Archived',
  blocked: 'Blocked',
};

/** Production order. The board and the distribution strip both read this. */
export const CONTENT_PIPELINE: readonly ContentStatus[] = [
  'idea',
  'drafting',
  'in_review',
  'approved',
  'scheduled',
  'published',
] as const;

export const contentFormatLabel: Record<ContentFormat, string> = {
  post: 'Post',
  article: 'Article',
  newsletter: 'Newsletter',
  video: 'Video',
  short: 'Short',
  carousel: 'Carousel',
  email: 'Email',
};

export const contentPlatformLabel: Record<ContentPlatform, string> = {
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  youtube: 'YouTube',
  newsletter: 'Newsletter',
  blog: 'Blog',
  x: 'X',
};

/** The integration whose credentials a platform would need. */
export const platformIntegrationId: Record<ContentPlatform, string | undefined> = {
  linkedin: 'linkedin',
  facebook: 'facebook',
  youtube: undefined,
  newsletter: undefined,
  blog: undefined,
  x: undefined,
};

export function contentStatusTone(
  status: ContentStatus,
): 'critical' | 'warning' | 'info' | 'neutral' | 'muted' {
  switch (status) {
    case 'blocked':
      return 'critical';
    case 'in_review':
      return 'warning';
    case 'scheduled':
    case 'approved':
      return 'info';
    case 'published':
      return 'neutral';
    default:
      return 'muted';
  }
}

/* ── Queue query ────────────────────────────────────────────────────────── */

export const CONTENT_STATUS_FILTERS = [
  'active',
  'idea',
  'drafting',
  'in_review',
  'approved',
  'scheduled',
  'published',
  'blocked',
  'archived',
  'all',
] as const;
export type ContentStatusFilter = (typeof CONTENT_STATUS_FILTERS)[number];

export const CONTENT_FORMAT_FILTERS = [
  'all',
  'post',
  'article',
  'newsletter',
  'video',
  'short',
  'carousel',
  'email',
] as const;
export type ContentFormatFilter = (typeof CONTENT_FORMAT_FILTERS)[number];

export const contentStatusFilterLabel: Record<ContentStatusFilter, string> = {
  active: 'In production',
  all: 'All',
  ...contentStatusLabel,
};

export const contentFormatFilterLabel: Record<ContentFormatFilter, string> = {
  all: 'Any format',
  ...contentFormatLabel,
};

export interface ContentQuery {
  status: ContentStatusFilter;
  format: ContentFormatFilter;
}

export const defaultContentQuery: ContentQuery = { status: 'active', format: 'all' };

export function parseContentQuery(params: URLSearchParams): ContentQuery {
  const status = params.get('status');
  const format = params.get('format');
  return {
    status: CONTENT_STATUS_FILTERS.find((value) => value === status) ?? defaultContentQuery.status,
    format: CONTENT_FORMAT_FILTERS.find((value) => value === format) ?? defaultContentQuery.format,
  };
}

/** In production: everything that has not been shipped or retired. */
export function isInProduction(item: ContentItem): boolean {
  return item.status !== 'published' && item.status !== 'archived';
}

function matches(item: ContentItem, query: ContentQuery): boolean {
  if (query.status === 'active' && !isInProduction(item)) return false;
  if (query.status !== 'active' && query.status !== 'all' && item.status !== query.status) {
    return false;
  }
  if (query.format !== 'all' && item.format !== query.format) return false;
  return true;
}

export interface ContentCounts extends Record<ContentStatus, number> {
  total: number;
  active: number;
  dueToday: number;
  overdue: number;
}

export function contentCounts(dataset: SovereignDataset, now: Date): ContentCounts {
  const counts: ContentCounts = {
    total: dataset.contentItems.length,
    active: 0,
    dueToday: 0,
    overdue: 0,
    idea: 0,
    drafting: 0,
    in_review: 0,
    approved: 0,
    scheduled: 0,
    published: 0,
    archived: 0,
    blocked: 0,
  };

  for (const item of dataset.contentItems) {
    counts[item.status] += 1;
    if (isInProduction(item)) counts.active += 1;
    if (isDueToday(item, now)) counts.dueToday += 1;
    if (isPastDue(item, now)) counts.overdue += 1;
  }

  return counts;
}

/** Carries today's date and has not shipped. */
export function isDueToday(item: ContentItem, now: Date): boolean {
  if (item.status === 'published' || item.status === 'archived') return false;
  if (item.scheduledFor === undefined) return false;
  const due = Date.parse(item.scheduledFor);
  return due >= startOfDay(now).getTime() && due <= endOfDay(now).getTime();
}

/** Its publish date has passed and nobody recorded a publish. */
export function isPastDue(item: ContentItem, now: Date): boolean {
  if (item.status === 'published' || item.status === 'archived') return false;
  if (item.scheduledFor === undefined) return false;
  const due = Date.parse(item.scheduledFor);
  return !Number.isNaN(due) && due < startOfDay(now).getTime();
}

/**
 * Work that needs a decision first — blocked, then awaiting a gate — then the
 * rest by publish date, undated last. The queue is a production surface, so the
 * item nobody can move outranks the item that is simply next.
 */
const queueRank: Record<ContentStatus, number> = {
  blocked: 0,
  in_review: 1,
  approved: 2,
  scheduled: 3,
  drafting: 4,
  idea: 5,
  published: 6,
  archived: 7,
};

function dateRank(item: ContentItem): number {
  if (item.scheduledFor === undefined) return Number.MAX_SAFE_INTEGER;
  const at = Date.parse(item.scheduledFor);
  return Number.isNaN(at) ? Number.MAX_SAFE_INTEGER : at;
}

export function selectContentItems(
  dataset: SovereignDataset,
  query: ContentQuery = defaultContentQuery,
): ContentItem[] {
  return dataset.contentItems
    .filter((item) => matches(item, query))
    .sort((a, b) => {
      if (a.status === 'published' && b.status === 'published') {
        return dateRank(b) - dateRank(a) || a.title.localeCompare(b.title);
      }
      const byStatus = queueRank[a.status] - queueRank[b.status];
      if (byStatus !== 0) return byStatus;
      return dateRank(a) - dateRank(b) || a.title.localeCompare(b.title);
    });
}

export function contentDueToday(dataset: SovereignDataset, now: Date): ContentItem[] {
  return dataset.contentItems
    .filter((item) => isDueToday(item, now))
    .sort((a, b) => dateRank(a) - dateRank(b));
}

export function contentAwaitingApproval(dataset: SovereignDataset): ContentItem[] {
  return dataset.contentItems
    .filter((item) => item.status === 'in_review')
    .sort((a, b) => dateRank(a) - dateRank(b) || a.title.localeCompare(b.title));
}

/* ── Joins ──────────────────────────────────────────────────────────────── */

export interface ContentItemLinks {
  campaign: Campaign | undefined;
  idea: ContentIdea | undefined;
  template: ContentTemplate | undefined;
  hook: Hook | undefined;
  cta: Cta | undefined;
  assets: ContentAsset[];
  parent: ContentItem | undefined;
  /** Repurposed cuts pointing back at this package. */
  children: ContentItem[];
  approval: Approval | undefined;
}

export function contentItemLinks(dataset: SovereignDataset, item: ContentItem): ContentItemLinks {
  return {
    campaign: dataset.campaigns.find((row) => row.id === item.campaignId),
    idea: dataset.contentIdeas.find((row) => row.id === item.ideaId),
    template: dataset.contentTemplates.find((row) => row.id === item.templateId),
    hook: dataset.hooks.find((row) => row.id === item.hookId),
    cta: dataset.ctas.find((row) => row.id === item.ctaId),
    assets: dataset.contentAssets.filter((row) => item.assetIds.includes(row.id)),
    parent: dataset.contentItems.find((row) => row.id === item.parentId),
    children: dataset.contentItems.filter((row) => row.parentId === item.id),
    approval: dataset.approvals.find((row) => row.id === item.approvalId),
  };
}

export function findContentItem(
  dataset: SovereignDataset,
  id: string | undefined,
): ContentItem | undefined {
  if (id === undefined) return undefined;
  return dataset.contentItems.find((item) => item.id === id);
}

/* ── Publishing calendar ────────────────────────────────────────────────── */

export interface ContentDay {
  key: string;
  date: Date;
  label: string;
  isToday: boolean;
  items: ContentItem[];
}

export interface ContentCalendar {
  week: CalendarWeek;
  label: string;
  start: Date;
  end: Date;
  days: ContentDay[];
  scheduledCount: number;
  publishedCount: number;
  /** Items with no publish date, which therefore appear on no day. */
  undated: ContentItem[];
}

/**
 * A week of publish dates. An item with no date is not silently placed on a
 * day: it is listed separately, because "unscheduled" is the fact worth seeing.
 */
export function contentCalendar(
  dataset: SovereignDataset,
  now: Date,
  week: CalendarWeek = 'current',
): ContentCalendar {
  const range = weekRange(now, week);
  const startMs = range.start.getTime();
  const endMs = range.end.getTime();

  const inWeek = dataset.contentItems.filter((item) => {
    if (item.scheduledFor === undefined) return false;
    const at = Date.parse(item.scheduledFor);
    return !Number.isNaN(at) && at >= startMs && at <= endMs;
  });

  const days: ContentDay[] = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(range.start, index);
    const key = dateKey(date);
    return {
      key,
      date,
      label: formatDayLabel(date),
      isToday: isSameDay(date, now),
      items: inWeek
        .filter((item) => dateKey(new Date(item.scheduledFor ?? '')) === key)
        .sort((a, b) => dateRank(a) - dateRank(b)),
    };
  });

  return {
    week,
    label: range.label,
    start: range.start,
    end: range.end,
    days,
    scheduledCount: inWeek.filter((item) => item.status !== 'published').length,
    publishedCount: inWeek.filter((item) => item.status === 'published').length,
    undated: dataset.contentItems.filter(
      (item) => item.scheduledFor === undefined && isInProduction(item),
    ),
  };
}

/* ── Idea vault ─────────────────────────────────────────────────────────── */

export const IDEA_FILTERS = ['captured', 'promoted', 'parked', 'discarded', 'all'] as const;
export type IdeaFilter = (typeof IDEA_FILTERS)[number];

export const ideaStatusLabel: Record<ContentIdeaStatus, string> = {
  captured: 'Captured',
  promoted: 'Promoted',
  parked: 'Parked',
  discarded: 'Discarded',
};

export const ideaFilterLabel: Record<IdeaFilter, string> = {
  all: 'All',
  ...ideaStatusLabel,
};

export function parseIdeaFilter(value: string | null): IdeaFilter {
  return IDEA_FILTERS.find((filter) => filter === value) ?? 'captured';
}

/**
 * Reach × confidence ÷ effort, on the operator's own 1–5 inputs. It is
 * arithmetic over three numbers a human typed, not a prediction, and the vault
 * prints the inputs next to the result so the sum can be checked by eye.
 */
export function ideaScore(idea: ContentIdea): number {
  return Math.round(((idea.reach * idea.confidence) / idea.effort) * 10) / 10;
}

export function selectIdeas(
  dataset: SovereignDataset,
  filter: IdeaFilter = 'captured',
): ContentIdea[] {
  return dataset.contentIdeas
    .filter((idea) => filter === 'all' || idea.status === filter)
    .sort((a, b) => ideaScore(b) - ideaScore(a) || a.title.localeCompare(b.title));
}

/* ── Campaigns ──────────────────────────────────────────────────────────── */

export interface CampaignRollup {
  campaign: Campaign;
  items: ContentItem[];
  published: number;
  inProduction: number;
  ideas: number;
  nextPublishAt: string | undefined;
}

export function campaignRollups(dataset: SovereignDataset): CampaignRollup[] {
  const statusOrder: Record<Campaign['status'], number> = {
    active: 0,
    planning: 1,
    complete: 2,
    archived: 3,
  };

  return dataset.campaigns
    .map((campaign) => {
      const items = dataset.contentItems.filter((item) => item.campaignId === campaign.id);
      const upcoming = items
        .filter((item) => isInProduction(item) && item.scheduledFor !== undefined)
        .sort((a, b) => dateRank(a) - dateRank(b));
      return {
        campaign,
        items,
        published: items.filter((item) => item.status === 'published').length,
        inProduction: items.filter((item) => isInProduction(item)).length,
        ideas: dataset.contentIdeas.filter((idea) => idea.campaignId === campaign.id).length,
        nextPublishAt: upcoming[0]?.scheduledFor,
      };
    })
    .sort(
      (a, b) =>
        statusOrder[a.campaign.status] - statusOrder[b.campaign.status] ||
        a.campaign.name.localeCompare(b.campaign.name),
    );
}

/* ── Libraries ──────────────────────────────────────────────────────────── */

export const LIBRARY_TYPES = ['hooks', 'ctas', 'assets', 'templates'] as const;
export type LibraryType = (typeof LIBRARY_TYPES)[number];

export const libraryTypeLabel: Record<LibraryType, string> = {
  hooks: 'Hooks',
  ctas: 'CTAs',
  assets: 'Assets',
  templates: 'Templates',
};

export function parseLibraryType(value: string | null): LibraryType {
  return LIBRARY_TYPES.find((type) => type === value) ?? 'hooks';
}

/**
 * How many items reference a library row, counting embedded variants too. Usage
 * is counted from the store rather than stored on the row, so it cannot drift.
 */
export function libraryUsage(dataset: SovereignDataset, kind: LibraryType, id: string): number {
  switch (kind) {
    case 'hooks':
      return dataset.contentItems.filter(
        (item) => item.hookId === id || item.variants.some((variant) => variant.hookId === id),
      ).length;
    case 'ctas':
      return dataset.contentItems.filter(
        (item) => item.ctaId === id || item.variants.some((variant) => variant.ctaId === id),
      ).length;
    case 'assets':
      return dataset.contentItems.filter((item) => item.assetIds.includes(id)).length;
    case 'templates':
      return dataset.contentItems.filter((item) => item.templateId === id).length;
  }
}

/* ── Daily content loop ─────────────────────────────────────────────────── */

export interface ContentLoopStep {
  id: string;
  label: string;
  count: number;
  detail: string;
  href: string;
}

/**
 * The loop in the order it runs: capture, draft, gate, ship. Each step counts
 * rows in the local store and links at the surface that clears it.
 */
export function contentLoop(dataset: SovereignDataset, now: Date): ContentLoopStep[] {
  const counts = contentCounts(dataset, now);
  const unscored = dataset.contentIdeas.filter((idea) => idea.status === 'captured').length;

  return [
    {
      id: 'capture',
      label: 'Ideas captured',
      count: unscored,
      detail: 'Waiting to be scored or promoted into a draft.',
      href: '/content/ideas',
    },
    {
      id: 'draft',
      label: 'In drafting',
      count: counts.drafting,
      detail: 'Copy being written. Nothing here has been reviewed.',
      href: '/content?status=drafting',
    },
    {
      id: 'gate',
      label: 'Awaiting approval',
      count: counts.in_review,
      detail: 'A human gate is open in the Approval Queue for each of these.',
      href: '/content?status=in_review',
    },
    {
      id: 'ship',
      label: 'Due today',
      count: counts.dueToday,
      detail: 'Carries today as its publish date. Publishing is recorded by hand.',
      href: '/content/calendar',
    },
  ];
}
