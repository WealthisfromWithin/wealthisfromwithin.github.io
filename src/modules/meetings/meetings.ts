import type { SovereignDataset } from '@/data/dataset';
import type { Company, Meeting, MeetingKind, Opportunity, Person } from '@/domain';

export const MEETING_WINDOWS = ['upcoming', 'past', 'all'] as const;
export type MeetingWindow = (typeof MEETING_WINDOWS)[number];

export const meetingWindowLabel: Record<MeetingWindow, string> = {
  upcoming: 'Upcoming',
  past: 'Past',
  all: 'All',
};

export const meetingKindLabel: Record<MeetingKind, string> = {
  discovery: 'Discovery',
  proposal: 'Proposal',
  review: 'Review',
  follow_up: 'Follow-up',
  internal: 'Internal',
};

export function parseMeetingWindow(value: string | null): MeetingWindow {
  return MEETING_WINDOWS.find((window) => window === value) ?? 'upcoming';
}

export function hasStarted(meeting: Meeting, now: Date): boolean {
  const starts = Date.parse(meeting.startsAt);
  return !Number.isNaN(starts) && starts < now.getTime();
}

export interface MeetingRow {
  meeting: Meeting;
  attendees: Person[];
  company: Company | undefined;
  opportunity: Opportunity | undefined;
  past: boolean;
}

function toRow(dataset: SovereignDataset, meeting: Meeting, now: Date): MeetingRow {
  return {
    meeting,
    attendees: dataset.people.filter((person) => meeting.personIds.includes(person.id)),
    company: dataset.companies.find((row) => row.id === meeting.companyId),
    opportunity: dataset.opportunities.find((row) => row.id === meeting.opportunityId),
    past: hasStarted(meeting, now),
  };
}

/**
 * Upcoming runs forward in time (the next thing first); past runs backward (the
 * most recent first). A single chronological list would bury both.
 */
export function selectMeetings(
  dataset: SovereignDataset,
  window: MeetingWindow = 'upcoming',
  now: Date = new Date(),
): MeetingRow[] {
  const rows = dataset.meetings
    .map((meeting) => toRow(dataset, meeting, now))
    .filter((row) => {
      if (window === 'all') return true;
      return window === 'past' ? row.past : !row.past;
    });

  return rows.sort((a, b) => {
    const ascending = Date.parse(a.meeting.startsAt) - Date.parse(b.meeting.startsAt);
    if (window === 'past') return -ascending;
    if (window === 'all') return a.past === b.past ? -ascending : a.past ? 1 : -1;
    return ascending;
  });
}

export function findMeetingRow(
  dataset: SovereignDataset,
  meetingId: string,
  now: Date,
): MeetingRow | null {
  const meeting = dataset.meetings.find((row) => row.id === meetingId);
  return meeting ? toRow(dataset, meeting, now) : null;
}

export interface MeetingCounts {
  total: number;
  upcoming: number;
  past: number;
  withNotes: number;
  awaitingNotes: number;
}

export function meetingCounts(dataset: SovereignDataset, now: Date): MeetingCounts {
  const counts: MeetingCounts = { total: 0, upcoming: 0, past: 0, withNotes: 0, awaitingNotes: 0 };

  for (const meeting of dataset.meetings) {
    counts.total += 1;
    const past = hasStarted(meeting, now);
    if (past) counts.past += 1;
    else counts.upcoming += 1;
    if (meeting.notes.trim().length > 0) counts.withNotes += 1;
    // Only a meeting that has happened can be missing its account of what happened.
    else if (past) counts.awaitingNotes += 1;
  }

  return counts;
}
