import { describe, expect, it } from 'vitest';
import { emptyDataset } from '@/data/dataset';
import { buildDemoDataset } from '@/data/seed';
import {
  findMeetingRow,
  hasStarted,
  meetingCounts,
  parseMeetingWindow,
  selectMeetings,
} from './meetings';

const now = new Date('2026-08-05T09:30:00.000Z');
const dataset = buildDemoDataset(now);

describe('parseMeetingWindow', () => {
  it('opens on what has not happened yet', () => {
    expect(parseMeetingWindow(null)).toBe('upcoming');
    expect(parseMeetingWindow('someday')).toBe('upcoming');
    expect(parseMeetingWindow('past')).toBe('past');
  });
});

describe('selectMeetings', () => {
  it('runs upcoming forward in time, next thing first', () => {
    const rows = selectMeetings(dataset, 'upcoming', now);
    const times = rows.map((row) => Date.parse(row.meeting.startsAt));
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(rows.every((row) => !row.past)).toBe(true);
  });

  it('runs past backward in time, most recent first', () => {
    const rows = selectMeetings(dataset, 'past', now);
    const times = rows.map((row) => Date.parse(row.meeting.startsAt));
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    expect(rows.every((row) => row.past)).toBe(true);
  });

  it('puts upcoming before past under the all filter', () => {
    const rows = selectMeetings(dataset, 'all', now);
    const pastFlags = rows.map((row) => row.past);
    expect(pastFlags.indexOf(true)).toBe(pastFlags.lastIndexOf(false) + 1);
    expect(rows).toHaveLength(dataset.meetings.length);
  });

  it('resolves attendees, company, and opportunity from the local store', () => {
    const row = selectMeetings(dataset, 'all', now).find(
      (entry) => entry.meeting.id === 'mtg-truoak-renewal',
    );
    expect(row?.attendees.map((person) => person.id)).toEqual(['p-aldridge']);
    expect(row?.company?.id).toBe('co-truoak');
    expect(row?.opportunity?.id).toBe('opp-truoak');
  });

  it('leaves an internal meeting with no attendees rather than inventing one', () => {
    const row = selectMeetings(dataset, 'all', now).find(
      (entry) => entry.meeting.id === 'mtg-internal-review',
    );
    expect(row?.attendees).toEqual([]);
    expect(row?.company).toBeUndefined();
  });

  it('returns nothing for an empty store', () => {
    expect(selectMeetings(emptyDataset, 'all', now)).toEqual([]);
  });
});

describe('hasStarted', () => {
  it('splits on the meeting start, not on its end', () => {
    const meeting = dataset.meetings.find((row) => row.id === 'mtg-kestrel-checkin')!;
    expect(hasStarted(meeting, now)).toBe(true);
    expect(hasStarted({ ...meeting, startsAt: new Date(now.getTime() + 1000).toISOString() }, now)).toBe(
      false,
    );
  });
});

describe('meetingCounts', () => {
  it('counts notes only where notes could exist', () => {
    const counts = meetingCounts(dataset, now);
    expect(counts.total).toBe(dataset.meetings.length);
    expect(counts.upcoming + counts.past).toBe(counts.total);
    expect(counts.withNotes).toBeGreaterThan(0);
    // An upcoming meeting is not "awaiting notes": nothing has happened yet.
    expect(counts.awaitingNotes).toBeLessThanOrEqual(counts.past);
  });
});

describe('findMeetingRow', () => {
  it('finds a meeting by id and returns null for an unknown one', () => {
    expect(findMeetingRow(dataset, 'mtg-truoak-renewal', now)?.meeting.title).toContain('TruOak');
    expect(findMeetingRow(dataset, 'mtg-nobody', now)).toBeNull();
  });
});
