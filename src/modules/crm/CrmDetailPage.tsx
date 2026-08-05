import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSovereign } from '@/app/context';
import { companyHref, opportunityHref, personHref } from '@/app/href';
import type { Meeting, Opportunity, Task } from '@/domain';
import { relativeTime } from '@/lib/clock';
import { formatCurrencyCents } from '@/lib/format';
import { DemoBadge, EmptyLine, Panel, SectionLabel, StatePill } from '@/ui/primitives';
import { meetingKindLabel } from '@/modules/meetings/meetings';
import { expectedValueCents, pipelineStageLabel } from '@/modules/pipeline/pipeline';
import { taskStatusLabel } from '@/modules/tasks/tasks';
import {
  companyIntelligence,
  relationshipIntelligence,
  temperatureLabel,
  temperatureTone,
} from './crm';

function MissingRecord({ kind, id }: { kind: string; id: string | undefined }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <SectionLabel>Relationships</SectionLabel>
      <h1 className="mt-1 font-display text-2xl text-ivory">Not in the local store</h1>
      <p className="mt-2 text-sm text-muted">
        No {kind} with id <span className="font-mono text-faint">{id ?? '—'}</span> exists here. The
        record may have been removed with the demo data.
      </p>
      <Link
        to="/crm"
        className="label-caps mt-4 inline-block border border-line px-2.5 py-1 text-muted transition-colors hover:border-gold/40 hover:text-ivory"
      >
        Back to CRM
      </Link>
    </div>
  );
}

function OpportunityLines({ opportunities }: { opportunities: readonly Opportunity[] }) {
  if (opportunities.length === 0) return <EmptyLine>No opportunities attached.</EmptyLine>;

  return (
    <ul>
      {opportunities.map((opportunity) => (
        <li
          key={opportunity.id}
          className="flex items-baseline gap-3 border-b border-line/60 py-1.5 last:border-b-0"
        >
          <Link
            to={opportunityHref(opportunity.id)}
            className="min-w-0 flex-1 truncate text-sm text-ivory hover:text-gold"
          >
            {opportunity.name}
          </Link>
          <span className="label-caps shrink-0 text-faint">
            {pipelineStageLabel[opportunity.stage]}
          </span>
          <span className="shrink-0 font-mono text-[0.65rem] text-faint tabular-nums">
            {formatCurrencyCents(opportunity.valueCents)} ·{' '}
            {formatCurrencyCents(expectedValueCents(opportunity))} exp
          </span>
        </li>
      ))}
    </ul>
  );
}

function TaskLines({ tasks, now }: { tasks: readonly Task[]; now: Date }) {
  if (tasks.length === 0) return <EmptyLine>No tasks attached.</EmptyLine>;

  return (
    <ul>
      {tasks.map((task) => (
        <li
          key={task.id}
          className="flex items-baseline gap-3 border-b border-line/60 py-1.5 last:border-b-0"
        >
          <span
            className={`min-w-0 flex-1 truncate text-sm ${task.status === 'done' ? 'text-faint line-through' : 'text-ivory'}`}
          >
            {task.title}
          </span>
          <span className="label-caps shrink-0 text-faint">{taskStatusLabel[task.status]}</span>
          <span className="shrink-0 font-mono text-[0.65rem] text-faint">
            {task.dueAt ? relativeTime(task.dueAt, now) : 'no date'}
          </span>
        </li>
      ))}
    </ul>
  );
}

function MeetingLines({ meetings, now }: { meetings: readonly Meeting[]; now: Date }) {
  if (meetings.length === 0) return <EmptyLine>No meetings recorded.</EmptyLine>;

  return (
    <ul>
      {meetings.map((meeting) => (
        <li key={meeting.id} className="border-b border-line/60 py-1.5 last:border-b-0">
          <div className="flex items-baseline gap-3">
            <span className="min-w-0 flex-1 truncate text-sm text-ivory">{meeting.title}</span>
            <span className="label-caps shrink-0 text-faint">{meetingKindLabel[meeting.kind]}</span>
            <span className="shrink-0 font-mono text-[0.65rem] text-faint">
              {relativeTime(meeting.startsAt, now)}
            </span>
          </div>
          {meeting.notes.length > 0 ? (
            <p className="mt-0.5 text-xs leading-5 text-muted">{meeting.notes}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function PersonDetailPage() {
  const { id } = useParams();
  const { dataset, ready } = useSovereign();
  const now = useMemo(() => new Date(), []);
  const intelligence = useMemo(
    () => (id === undefined ? null : relationshipIntelligence(dataset, id, now)),
    [dataset, id, now],
  );

  if (!ready) {
    return <p className="px-6 py-6 text-sm text-faint italic">Opening the local store…</p>;
  }
  if (!intelligence) return <MissingRecord kind="person" id={id} />;

  const { person, company, tasks, opportunities, meetings } = intelligence;

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <header className="mb-5">
        <SectionLabel>
          <Link to="/crm" className="hover:text-ivory">
            CRM
          </Link>{' '}
          · Person
        </SectionLabel>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl text-ivory">{person.name}</h1>
          <StatePill tone={temperatureTone[intelligence.temperature]}>
            {temperatureLabel[intelligence.temperature]}
          </StatePill>
          {person.source === 'demo' ? <DemoBadge /> : null}
        </div>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-sm text-muted">
          {person.role ? <span>{person.role}</span> : null}
          {company ? (
            <Link to={companyHref(company.id)} className="text-gold hover:text-ivory">
              {company.name}
            </Link>
          ) : (
            <span className="text-faint">No company on the record</span>
          )}
          {person.email ? <span className="font-mono text-xs">{person.email}</span> : null}
        </p>

        <p className="mt-3 border-y border-line py-3 font-mono text-xs text-muted">
          {intelligence.statement}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Opportunities">
          <OpportunityLines opportunities={opportunities} />
        </Panel>
        <Panel title="Tasks">
          <TaskLines tasks={tasks} now={now} />
        </Panel>
        <Panel title="Meetings">
          <MeetingLines meetings={meetings} now={now} />
        </Panel>
        <Panel title="Notes on the record">
          {person.notes.length > 0 ? (
            <p className="text-sm leading-6 text-muted">{person.notes}</p>
          ) : (
            <EmptyLine>Nothing recorded.</EmptyLine>
          )}
          <p className="mt-2 font-mono text-[0.65rem] text-faint">
            Strength {person.relationshipStrength} ·{' '}
            {person.tags.length > 0 ? person.tags.join(' · ') : 'no tags'}
          </p>
        </Panel>
      </div>
    </div>
  );
}

export function CompanyDetailPage() {
  const { id } = useParams();
  const { dataset, ready } = useSovereign();
  const now = useMemo(() => new Date(), []);
  const intelligence = useMemo(
    () => (id === undefined ? null : companyIntelligence(dataset, id, now)),
    [dataset, id, now],
  );

  if (!ready) {
    return <p className="px-6 py-6 text-sm text-faint italic">Opening the local store…</p>;
  }
  if (!intelligence) return <MissingRecord kind="company" id={id} />;

  const { company, people, opportunities, tasks, meetings } = intelligence;

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <header className="mb-5">
        <SectionLabel>
          <Link to="/crm?view=companies" className="hover:text-ivory">
            CRM
          </Link>{' '}
          · Company
        </SectionLabel>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl text-ivory">{company.name}</h1>
          <StatePill tone={company.status === 'active' ? 'sentinel' : 'muted'}>
            {company.status}
          </StatePill>
          {company.source === 'demo' ? <DemoBadge /> : null}
        </div>
        <p className="mt-1 text-sm text-muted">
          {[company.segment, company.domain].filter(Boolean).join(' · ')}
        </p>

        <dl className="mt-3 flex flex-wrap items-baseline gap-x-8 gap-y-2 border-y border-line py-3">
          <div>
            <dt className="label-caps text-faint">People</dt>
            <dd className="font-mono text-lg text-ivory tabular-nums">{people.length}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Open value</dt>
            <dd className="font-mono text-lg text-ivory tabular-nums">
              {formatCurrencyCents(intelligence.openValueCents)}
            </dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Open tasks</dt>
            <dd className="font-mono text-lg text-ivory tabular-nums">
              {tasks.filter((task) => task.status !== 'done').length}
            </dd>
          </div>
        </dl>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="People">
          {people.length === 0 ? (
            <EmptyLine>No contacts recorded at this company.</EmptyLine>
          ) : (
            <ul>
              {people.map((row) => (
                <li
                  key={row.person.id}
                  className="flex items-baseline gap-3 border-b border-line/60 py-1.5 last:border-b-0"
                >
                  <Link
                    to={personHref(row.person.id)}
                    className="min-w-0 flex-1 truncate text-sm text-ivory hover:text-gold"
                  >
                    {row.person.name}
                  </Link>
                  <span className="label-caps shrink-0 text-faint">
                    {temperatureLabel[row.temperature]}
                  </span>
                  <span className="shrink-0 font-mono text-[0.65rem] text-faint">
                    {row.person.lastTouchAt ? relativeTime(row.person.lastTouchAt, now) : 'never'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Opportunities">
          <OpportunityLines opportunities={opportunities} />
        </Panel>
        <Panel title="Tasks">
          <TaskLines tasks={tasks} now={now} />
        </Panel>
        <Panel title="Meetings">
          <MeetingLines meetings={meetings} now={now} />
        </Panel>
      </div>
    </div>
  );
}
