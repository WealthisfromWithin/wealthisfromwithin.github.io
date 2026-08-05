import { describe, expect, it } from 'vitest';
import { emptyDataset } from '@/data/dataset';
import { buildDemoDataset } from '@/data/seed';
import { addDays, dateKey, startOfWeek } from '@/lib/clock';
import { dayAgenda, parseCalendarWeek, weekAgenda, weekRange } from './calendar';

const now = new Date('2026-08-05T09:30:00.000Z');
const dataset = buildDemoDataset(now);

describe('parseCalendarWeek', () => {
  it('opens on the current week', () => {
    expect(parseCalendarWeek(null)).toBe('current');
    expect(parseCalendarWeek('fortnight')).toBe('current');
    expect(parseCalendarWeek('next')).toBe('next');
  });
});

describe('weekRange', () => {
  it('starts the week on Monday', () => {
    expect(weekRange(now, 'current').start.getDay()).toBe(1);
  });

  it('spans seven days and states them in the label', () => {
    const range = weekRange(now, 'current');
    expect(dateKey(range.end)).toBe(dateKey(addDays(range.start, 6)));
    expect(range.label).toContain('–');
  });

  it('shifts a whole week forward and back', () => {
    const current = weekRange(now, 'current').start;
    expect(dateKey(weekRange(now, 'next').start)).toBe(dateKey(addDays(current, 7)));
    expect(dateKey(weekRange(now, 'previous').start)).toBe(dateKey(addDays(current, -7)));
  });
});

describe('weekAgenda', () => {
  const agenda = weekAgenda(dataset, now, 'current');

  it('always returns seven days, empty ones included', () => {
    expect(agenda.days).toHaveLength(7);
    expect(agenda.days[0]?.date.getDay()).toBe(1);
  });

  it('merges meetings and dated work into one clock-ordered day', () => {
    const today = agenda.days.find((day) => day.isToday);
    expect(today).toBeDefined();
    const times = today?.entries.map((entry) => Date.parse(entry.at)) ?? [];
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(agenda.meetingCount).toBeGreaterThan(0);
    expect(agenda.taskCount).toBeGreaterThan(0);
  });

  it('marks exactly one day as today', () => {
    expect(agenda.days.filter((day) => day.isToday)).toHaveLength(1);
  });

  it('never shows undated work: the calendar states time', () => {
    const ids = agenda.days.flatMap((day) => day.entries.map((entry) => entry.recordId));
    expect(ids).not.toContain('t-decision-log');
  });

  it('keeps entries inside the week it was asked for', () => {
    const range = weekRange(now, 'current');
    for (const day of agenda.days) {
      for (const entry of day.entries) {
        const at = Date.parse(entry.at);
        expect(at).toBeGreaterThanOrEqual(range.start.getTime());
        expect(at).toBeLessThanOrEqual(range.end.getTime());
      }
    }
  });

  it('badges demo rows and marks completed work done', () => {
    const entries = agenda.days.flatMap((day) => day.entries);
    expect(entries.every((entry) => entry.demo)).toBe(true);
    expect(entries.some((entry) => entry.kind === 'meeting')).toBe(true);
  });

  it('is empty but well-formed on an empty store', () => {
    const empty = weekAgenda(emptyDataset, now, 'current');
    expect(empty.days).toHaveLength(7);
    expect(empty.meetingCount).toBe(0);
    expect(empty.taskCount).toBe(0);
  });

  it('shows a different week when asked, without leaking this week into it', () => {
    const next = weekAgenda(dataset, now, 'next');
    expect(dateKey(next.start)).toBe(dateKey(addDays(startOfWeek(now), 7)));
    expect(next.days.every((day) => !day.isToday)).toBe(true);
  });
});

describe('dayAgenda', () => {
  it('returns exactly the entries the week agenda holds for today', () => {
    const today = weekAgenda(dataset, now, 'current').days.find((day) => day.isToday);
    expect(dayAgenda(dataset, now)).toEqual(today?.entries);
  });
});
