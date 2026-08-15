import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSovereign } from '@/app/context';
import { contentHref } from '@/app/href';
import { formatClockTime } from '@/lib/clock';
import { cn } from '@/lib/cn';
import { DemoBadge, EmptyLine, SectionLabel, StatePill } from '@/ui/primitives';
import {
  CALENDAR_WEEKS,
  calendarWeekLabel,
  parseCalendarWeek,
} from '@/modules/calendar/calendar';
import { ContentTabs } from './ContentTabs';
import {
  contentCalendar,
  contentFormatLabel,
  contentStatusLabel,
  contentStatusTone,
} from './content';

const filterButton = 'label-caps border px-2.5 py-1 transition-colors';

export function ContentCalendarPage() {
  const { dataset, ready } = useSovereign();
  const [searchParams, setSearchParams] = useSearchParams();
  const now = useMemo(() => new Date(), []);

  const week = parseCalendarWeek(searchParams.get('week'));
  const calendar = useMemo(() => contentCalendar(dataset, now, week), [dataset, now, week]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <header className="mb-5">
        <SectionLabel>
          <Link to="/content" className="hover:text-ivory">
            Content
          </Link>{' '}
          · Calendar
        </SectionLabel>
        <h1 className="mt-1 font-display text-2xl text-ivory">Publishing Calendar</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          {calendar.label}. A date on this calendar is a date the operator intends to publish on —
          nothing is queued with a provider, and no post goes out on its own.
        </p>

        <dl className="mt-4 flex flex-wrap items-baseline gap-x-8 gap-y-2 border-y border-line py-3">
          <div>
            <dt className="label-caps text-faint">Scheduled this week</dt>
            <dd className="font-mono text-lg text-ivory tabular-nums">{calendar.scheduledCount}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Published this week</dt>
            <dd className="font-mono text-lg text-muted tabular-nums">{calendar.publishedCount}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Undated in production</dt>
            <dd className="font-mono text-lg text-gold tabular-nums">{calendar.undated.length}</dd>
          </div>
        </dl>
      </header>

      <ContentTabs />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {CALENDAR_WEEKS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              const params = new URLSearchParams();
              if (value !== 'current') params.set('week', value);
              setSearchParams(params);
            }}
            className={cn(
              filterButton,
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
        <ol className="border-t border-line">
          {calendar.days.map((day) => (
            <li key={day.key} className="border-b border-line/60 py-2">
              <div className="flex items-baseline gap-3">
                <p
                  className={cn(
                    'label-caps w-32 shrink-0',
                    day.isToday ? 'text-gold' : 'text-faint',
                  )}
                >
                  {day.label}
                  {day.isToday ? ' · today' : ''}
                </p>
                <div className="min-w-0 flex-1">
                  {day.items.length === 0 ? (
                    <p className="py-0.5 text-xs text-faint italic">Nothing dated.</p>
                  ) : (
                    <ul>
                      {day.items.map((item) => (
                        <li key={item.id} className="flex flex-wrap items-baseline gap-2 py-0.5">
                          <span className="font-mono text-[0.65rem] text-faint tabular-nums">
                            {formatClockTime(new Date(item.scheduledFor ?? ''))}
                          </span>
                          <Link
                            to={contentHref(item.id)}
                            className="min-w-0 text-sm text-ivory hover:text-gold"
                          >
                            {item.title}
                          </Link>
                          <StatePill tone={contentStatusTone(item.status)}>
                            {contentStatusLabel[item.status]}
                          </StatePill>
                          <span className="font-mono text-[0.65rem] text-faint">
                            {contentFormatLabel[item.format]}
                            {item.channel.length > 0 ? ` · ${item.channel}` : ''}
                          </span>
                          {item.source === 'demo' ? <DemoBadge /> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      <section className="mt-6">
        <SectionLabel>In production with no publish date</SectionLabel>
        {calendar.undated.length === 0 ? (
          <EmptyLine>Everything in production carries a date.</EmptyLine>
        ) : (
          <ul className="mt-1">
            {calendar.undated.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-baseline gap-2 border-b border-line/60 py-1.5 last:border-b-0"
              >
                <Link to={contentHref(item.id)} className="text-sm text-ivory hover:text-gold">
                  {item.title}
                </Link>
                <StatePill tone={contentStatusTone(item.status)}>
                  {contentStatusLabel[item.status]}
                </StatePill>
                <span className="font-mono text-[0.65rem] text-faint">
                  {contentFormatLabel[item.format]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
