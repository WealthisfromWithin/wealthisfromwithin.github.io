import type { SovereignDataset } from '@/data/dataset';
import type { Meeting, Task } from '@/domain';
import {
  addDays,
  dateKey,
  endOfWeek,
  formatDayLabel,
  isSameDay,
  startOfWeek,
} from '@/lib/clock';
import { meetingKindLabel } from '@/modules/meetings/meetings';

export const CALENDAR_WEEKS = ['current', 'next', 'previous'] as const;
export type CalendarWeek = (typeof CALENDAR_WEEKS)[number];

export const calendarWeekLabel: Record<CalendarWeek, string> = {
  current: 'This week',
  next: 'Next week',
  previous: 'Last week',
};

const WEEK_OFFSET: Record<CalendarWeek, number> = { previous: -7, current: 0, next: 7 };

export function parseCalendarWeek(value: string | null): CalendarWeek {
  return CALENDAR_WEEKS.find((week) => week === value) ?? 'current';
}

export interface WeekRange {
  start: Date;
  end: Date;
  label: string;
}

export function weekRange(now: Date, week: CalendarWeek = 'current'): WeekRange {
  const anchor = addDays(now, WEEK_OFFSET[week]);
  const start = startOfWeek(anchor);
  const end = endOfWeek(anchor);
  return {
    start,
    end,
    label: `${formatDayLabel(start)} – ${formatDayLabel(end)}`,
  };
}

export type AgendaKind = 'meeting' | 'task';

export interface AgendaEntry {
  id: string;
  kind: AgendaKind;
  recordId: string;
  at: string;
  title: string;
  detail: string;
  meta: string;
  demo: boolean;
  done: boolean;
}

export interface AgendaDay {
  key: string;
  date: Date;
  label: string;
  isToday: boolean;
  entries: AgendaEntry[];
}

export interface WeekAgenda extends WeekRange {
  week: CalendarWeek;
  days: AgendaDay[];
  meetingCount: number;
  taskCount: number;
}

function meetingEntry(meeting: Meeting, attendees: string[]): AgendaEntry {
  return {
    id: `meeting:${meeting.id}`,
    kind: 'meeting',
    recordId: meeting.id,
    at: meeting.startsAt,
    title: meeting.title,
    detail: attendees.join(', '),
    meta: [meetingKindLabel[meeting.kind], meeting.location]
      .filter((part) => part.length > 0)
      .join(' · '),
    demo: meeting.source === 'demo',
    done: false,
  };
}

function taskEntry(task: Task): AgendaEntry {
  return {
    id: `task:${task.id}`,
    kind: 'task',
    recordId: task.id,
    at: task.dueAt ?? task.createdAt,
    title: task.title,
    detail: task.context,
    meta: [task.priority, task.status === 'blocked' ? 'blocked' : null]
      .filter((part): part is string => Boolean(part))
      .join(' · '),
    demo: task.source === 'demo',
    done: task.status === 'done',
  };
}

/**
 * One week, one agenda: meetings and work that falls due, merged in clock order.
 * A task with no due date never appears — the calendar states time, and undated
 * work has none.
 */
export function weekAgenda(
  dataset: SovereignDataset,
  now: Date,
  week: CalendarWeek = 'current',
): WeekAgenda {
  const range = weekRange(now, week);
  const startMs = range.start.getTime();
  const endMs = range.end.getTime();
  const personNames = new Map(dataset.people.map((person) => [person.id, person.name]));

  const entries: AgendaEntry[] = [];
  let meetingCount = 0;
  let taskCount = 0;

  for (const meeting of dataset.meetings) {
    const starts = Date.parse(meeting.startsAt);
    if (Number.isNaN(starts) || starts < startMs || starts > endMs) continue;
    entries.push(
      meetingEntry(
        meeting,
        meeting.personIds
          .map((id) => personNames.get(id))
          .filter((name): name is string => name !== undefined),
      ),
    );
    meetingCount += 1;
  }

  for (const task of dataset.tasks) {
    if (task.dueAt === undefined) continue;
    const due = Date.parse(task.dueAt);
    if (Number.isNaN(due) || due < startMs || due > endMs) continue;
    entries.push(taskEntry(task));
    taskCount += 1;
  }

  const days: AgendaDay[] = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(range.start, index);
    const key = dateKey(date);
    return {
      key,
      date,
      label: formatDayLabel(date),
      isToday: isSameDay(date, now),
      entries: entries
        .filter((entry) => dateKey(new Date(entry.at)) === key)
        .sort((a, b) => Date.parse(a.at) - Date.parse(b.at)),
    };
  });

  return { ...range, week, days, meetingCount, taskCount };
}

/** Today's agenda in clock order. The Morning Brief's "today" reads from this. */
export function dayAgenda(dataset: SovereignDataset, now: Date): AgendaEntry[] {
  const key = dateKey(now);
  return weekAgenda(dataset, now, 'current')
    .days.find((day) => day.key === key)
    ?.entries ?? [];
}
