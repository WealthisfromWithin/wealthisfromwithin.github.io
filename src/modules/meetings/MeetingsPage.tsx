import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSovereign } from '@/app/context';
import { companyHref, opportunityHref, personHref } from '@/app/href';
import { saveMeetingNotes } from '@/data/mutations';
import { relativeTime } from '@/lib/clock';
import { cn } from '@/lib/cn';
import { DemoBadge, SectionLabel, StatePill } from '@/ui/primitives';
import {
  MEETING_WINDOWS,
  meetingCounts,
  meetingKindLabel,
  meetingWindowLabel,
  parseMeetingWindow,
  selectMeetings,
  type MeetingRow,
} from './meetings';

const rowButton = 'label-caps border px-2 py-0.5 transition-colors disabled:opacity-40';

/**
 * Mounted with the stored notes as its key, so a write from anywhere else — a
 * reseed, a demo opt-out — replaces the draft instead of racing it. The store is
 * the source of truth; this is a draft over it.
 */
function NotesEditor({
  row,
  busy,
  onSave,
}: {
  row: MeetingRow;
  busy: boolean;
  onSave: (row: MeetingRow, notes: string) => void;
}) {
  const [draft, setDraft] = useState(row.meeting.notes);
  const dirty = draft !== row.meeting.notes;

  return (
    <div className="mt-2">
      <label className="label-caps text-faint" htmlFor={`notes-${row.meeting.id}`}>
        Notes
      </label>
      <textarea
        id={`notes-${row.meeting.id}`}
        value={draft}
        rows={draft.length > 120 ? 4 : 2}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        placeholder={
          row.past
            ? 'What happened, and what it changed.'
            : 'Notes can be written after the meeting.'
        }
        className="mt-1 w-full resize-y border border-line bg-surface/60 px-2 py-1.5 text-xs leading-5 text-on-surface outline-none placeholder:text-faint focus:border-gold/50"
      />
      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          disabled={busy || !dirty}
          onClick={() => {
            onSave(row, draft);
          }}
          className={cn(rowButton, 'border-gold/50 text-gold hover:border-gold hover:text-ivory')}
        >
          Save notes
        </button>
        {dirty ? <span className="text-[0.65rem] text-faint">Unsaved</span> : null}
      </div>
    </div>
  );
}

function MeetingCard({
  row,
  now,
  busy,
  onSave,
}: {
  row: MeetingRow;
  now: Date;
  busy: boolean;
  onSave: (row: MeetingRow, notes: string) => void;
}) {
  const { meeting } = row;

  return (
    <li className="border-b border-line/60 py-3 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="text-sm text-ivory">{meeting.title}</h2>
        <StatePill tone={row.past ? 'muted' : 'info'}>
          {meetingKindLabel[meeting.kind]}
        </StatePill>
        {meeting.source === 'demo' ? <DemoBadge /> : null}
        {row.past && meeting.notes.trim().length === 0 ? (
          <StatePill tone="warning">No notes</StatePill>
        ) : null}
        <span className="ml-auto font-mono text-[0.65rem] text-faint">
          {new Date(meeting.startsAt).toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          })}{' '}
          · {relativeTime(meeting.startsAt, now)}
        </span>
      </div>

      <p className="mt-1 flex flex-wrap items-baseline gap-x-2 font-mono text-[0.65rem] text-faint">
        {meeting.location ? <span>{meeting.location}</span> : <span>no location</span>}
        {row.company ? (
          <>
            <span aria-hidden>·</span>
            <Link to={companyHref(row.company.id)} className="hover:text-ivory">
              {row.company.name}
            </Link>
          </>
        ) : null}
        {row.opportunity ? (
          <>
            <span aria-hidden>·</span>
            <Link to={opportunityHref(row.opportunity.id)} className="hover:text-ivory">
              {row.opportunity.name}
            </Link>
          </>
        ) : null}
        {row.attendees.length === 0 ? (
          <>
            <span aria-hidden>·</span>
            <span>internal</span>
          </>
        ) : (
          row.attendees.map((person) => (
            <span key={person.id} className="flex items-baseline gap-x-2">
              <span aria-hidden>·</span>
              <Link to={personHref(person.id)} className="hover:text-ivory">
                {person.name}
              </Link>
            </span>
          ))
        )}
      </p>

      <NotesEditor key={meeting.notes} row={row} busy={busy} onSave={onSave} />
    </li>
  );
}

export function MeetingsPage() {
  const { dataset, ready } = useSovereign();
  const [searchParams, setSearchParams] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const now = useMemo(() => new Date(), []);

  const when = parseMeetingWindow(searchParams.get('when'));
  const counts = useMemo(() => meetingCounts(dataset, now), [dataset, now]);
  const rows = useMemo(() => selectMeetings(dataset, when, now), [dataset, when, now]);

  function save(row: MeetingRow, notes: string) {
    setBusy(true);
    setMessage(null);
    void saveMeetingNotes(row.meeting.id, notes)
      .then((changed) => {
        setMessage(
          changed
            ? `Notes recorded for "${row.meeting.title}". Written to the local store.`
            : 'Nothing changed.',
        );
      })
      .catch((cause: unknown) => {
        setMessage(cause instanceof Error ? cause.message : 'Saving notes failed.');
      })
      .finally(() => {
        setBusy(false);
      });
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <header className="mb-5">
        <SectionLabel>Time</SectionLabel>
        <h1 className="mt-1 font-display text-2xl text-ivory">Meetings</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Meeting records and the notes the operator wrote about them. Notes are written to
          IndexedDB, so what was said outlives the session. Nothing is transcribed here.
        </p>

        <dl className="mt-4 flex flex-wrap items-baseline gap-x-8 gap-y-2 border-y border-line py-3">
          <div>
            <dt className="label-caps text-faint">Upcoming</dt>
            <dd className="font-mono text-lg text-ivory tabular-nums">{counts.upcoming}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Past</dt>
            <dd className="font-mono text-lg text-muted tabular-nums">{counts.past}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">With notes</dt>
            <dd className="font-mono text-lg text-sentinel tabular-nums">{counts.withNotes}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Awaiting notes</dt>
            <dd className="font-mono text-lg text-gold tabular-nums">{counts.awaitingNotes}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Week view</dt>
            <dd className="font-mono text-sm">
              <Link to="/calendar" className="text-muted hover:text-gold">
                Calendar
              </Link>
            </dd>
          </div>
        </dl>
      </header>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {MEETING_WINDOWS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setSearchParams(value === 'upcoming' ? {} : { when: value });
            }}
            className={cn(
              'label-caps border px-2.5 py-1 transition-colors',
              when === value
                ? 'border-gold/60 bg-gold-faint text-ivory'
                : 'border-line text-faint hover:border-gold/40 hover:text-muted',
            )}
          >
            {meetingWindowLabel[value]}
          </button>
        ))}
        {message ? <p className="ml-auto text-xs text-muted">{message}</p> : null}
      </div>

      {!ready ? (
        <p className="text-sm text-faint italic">Opening the local store…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-faint italic">
          {counts.total === 0
            ? 'The local store holds no meetings.'
            : when === 'upcoming'
              ? 'No meetings are scheduled ahead.'
              : 'No meetings in this window.'}
        </p>
      ) : (
        <ul>
          {rows.map((row) => (
            <MeetingCard key={row.meeting.id} row={row} now={now} busy={busy} onSave={save} />
          ))}
        </ul>
      )}
    </div>
  );
}
