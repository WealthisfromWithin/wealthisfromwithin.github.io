import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSovereign } from '@/app/context';
import { formatClockTime } from '@/lib/clock';
import { cn } from '@/lib/cn';
import { DemoBadge, SectionLabel } from '@/ui/primitives';
import {
  CALENDAR_WEEKS,
  calendarWeekLabel,
  parseCalendarWeek,
  weekAgenda,
  type AgendaDay,
  type AgendaEntry,
} from './calendar';

const kindAccent: Record<AgendaEntry['kind'], string> = {
  meeting: 'bg-gold',
  task: 'bg-surface-highest',
};

function EntryRow({ entry }: { entry: AgendaEntry }) {
  return (
    <li className="flex items-start gap-3 border-b border-line/50 py-1.5 last:border-b-0">
      <span className="w-11 shrink-0 pt-0.5 font-mono text-[0.65rem] text-faint tabular-nums">
        {formatClockTime(new Date(entry.at))}
      </span>
      <span className={cn('mt-1.5 h-6 w-px shrink-0', kindAccent[entry.kind])} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-baseline gap-2">
          <Link
            to={entry.kind === 'meeting' ? '/meetings' : '/tasks'}
            className={cn(
              'min-w-0 text-sm hover:text-gold',
              entry.done ? 'text-faint line-through' : 'text-ivory',
            )}
          >
            {entry.title}
          </Link>
          {entry.demo ? <DemoBadge /> : null}
        </div>
        {entry.detail ? (
          <p className="mt-0.5 text-xs leading-5 text-muted">{entry.detail}</p>
        ) : null}
      </div>
      <span className="shrink-0 pt-0.5 font-mono text-[0.65rem] text-faint">{entry.meta}</span>
    </li>
  );
}

function DayBlock({ day }: { day: AgendaDay }) {
  return (
    <section aria-labelledby={`day-${day.key}`} className="min-w-0">
      <header
        className={cn(
          'mb-1 flex items-baseline gap-2 border-b pb-1',
          day.isToday ? 'border-gold/60' : 'border-line',
        )}
      >
        <h2
          id={`day-${day.key}`}
          className={cn('font-display text-sm', day.isToday ? 'text-gold' : 'text-ivory')}
        >
          {day.label}
        </h2>
        {day.isToday ? <span className="label-caps text-gold">Today</span> : null}
        <span className="ml-auto font-mono text-[0.65rem] text-faint tabular-nums">
          {day.entries.length}
        </span>
      </header>
      {day.entries.length === 0 ? (
        <p className="py-1.5 text-xs text-faint italic">Nothing scheduled or due.</p>
      ) : (
        <ul>
          {day.entries.map((entry) => (
            <EntryRow key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function CalendarPage() {
  const { dataset, ready } = useSovereign();
  const [searchParams, setSearchParams] = useSearchParams();
  const now = useMemo(() => new Date(), []);

  const week = parseCalendarWeek(searchParams.get('week'));
  const agenda = useMemo(() => weekAgenda(dataset, now, week), [dataset, now, week]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <header className="mb-5">
        <SectionLabel>Time</SectionLabel>
        <h1 className="mt-1 font-display text-2xl text-ivory">Calendar</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          One week of meetings and work that falls due, merged in clock order. Undated work never
          appears here — the calendar states time, and a task without a date has none.
        </p>

        <dl className="mt-4 flex flex-wrap items-baseline gap-x-8 gap-y-2 border-y border-line py-3">
          <div>
            <dt className="label-caps text-faint">Week</dt>
            <dd className="font-mono text-sm text-ivory">{agenda.label}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Meetings</dt>
            <dd className="font-mono text-lg text-ivory tabular-nums">
              <Link to="/meetings" className="hover:text-gold">
                {agenda.meetingCount}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Work due</dt>
            <dd className="font-mono text-lg text-ivory tabular-nums">
              <Link to="/tasks" className="hover:text-gold">
                {agenda.taskCount}
              </Link>
            </dd>
          </div>
        </dl>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {CALENDAR_WEEKS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setSearchParams(value === 'current' ? {} : { week: value });
            }}
            className={cn(
              'label-caps border px-2.5 py-1 transition-colors',
              week === value
                ? 'border-gold/60 bg-gold-faint text-ivory'
                : 'border-line text-faint hover:border-gold/40 hover:text-muted',
            )}
          >
            {calendarWeekLabel[value]}
          </button>
        ))}
      </div>

      {!ready ? (
        <p className="text-sm text-faint italic">Opening the local store…</p>
      ) : (
        <div className="grid grid-cols-1 gap-x-10 gap-y-6 lg:grid-cols-2">
          {agenda.days.map((day) => (
            <DayBlock key={day.key} day={day} />
          ))}
        </div>
      )}
    </div>
  );
}
