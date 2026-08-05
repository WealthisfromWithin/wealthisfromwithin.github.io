import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSovereign } from '@/app/context';
import { companyHref, personHref } from '@/app/href';
import { setOpportunityStage } from '@/data/mutations';
import type { PipelineStage } from '@/domain';
import { relativeTime } from '@/lib/clock';
import { cn } from '@/lib/cn';
import { formatCurrencyCents } from '@/lib/format';
import { DemoBadge, EmptyLine, Panel, SectionLabel, StatePill } from '@/ui/primitives';
import { meetingKindLabel } from '@/modules/meetings/meetings';
import { taskStatusLabel } from '@/modules/tasks/tasks';
import {
  PIPELINE_STAGES,
  leadIntelligence,
  pipelineStageLabel,
  type LeadSignal,
} from './pipeline';

const signalTone: Record<LeadSignal['tone'], string> = {
  critical: 'border-alert/50 text-alert',
  warning: 'border-gold/45 text-gold',
  info: 'border-sentinel/45 text-sentinel',
  neutral: 'border-line text-muted',
};

function SignalRow({ signal }: { signal: LeadSignal }) {
  return (
    <li className={cn('border-l-2 py-1.5 pl-3', signalTone[signal.tone])}>
      <p className="text-sm text-ivory">{signal.label}</p>
      <p className="mt-0.5 text-xs leading-5 text-muted">{signal.detail}</p>
    </li>
  );
}

export function OpportunityDetailPage() {
  const { id } = useParams();
  const { dataset, ready } = useSovereign();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const now = useMemo(() => new Date(), []);

  const intelligence = useMemo(
    () => (id === undefined ? null : leadIntelligence(dataset, id, now)),
    [dataset, id, now],
  );

  if (!ready) {
    return <p className="px-6 py-6 text-sm text-faint italic">Opening the local store…</p>;
  }

  if (!intelligence) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-6">
        <SectionLabel>Revenue</SectionLabel>
        <h1 className="mt-1 font-display text-2xl text-ivory">Not in the local store</h1>
        <p className="mt-2 text-sm text-muted">
          No opportunity with id <span className="font-mono text-faint">{id ?? '—'}</span> exists
          here. It may have been removed with the demo data.
        </p>
        <Link
          to="/pipeline"
          className="label-caps mt-4 inline-block border border-line px-2.5 py-1 text-muted transition-colors hover:border-gold/40 hover:text-ivory"
        >
          Back to Pipeline
        </Link>
      </div>
    );
  }

  const { opportunity, tasks, meetings } = intelligence;

  function move(stage: PipelineStage) {
    setBusy(true);
    setMessage(null);
    void setOpportunityStage(opportunity.id, stage)
      .then((changed) => {
        setMessage(
          changed
            ? `Moved to ${pipelineStageLabel[stage]}. Written to the local store.`
            : 'Already in that stage.',
        );
      })
      .catch((cause: unknown) => {
        setMessage(cause instanceof Error ? cause.message : 'Stage change failed.');
      })
      .finally(() => {
        setBusy(false);
      });
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <header className="mb-5">
        <SectionLabel>
          <Link to="/pipeline" className="hover:text-ivory">
            Pipeline
          </Link>{' '}
          · Opportunity
        </SectionLabel>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl text-ivory">{opportunity.name}</h1>
          <StatePill tone={intelligence.stalled ? 'warning' : 'neutral'}>
            {pipelineStageLabel[opportunity.stage]}
          </StatePill>
          {opportunity.source === 'demo' ? <DemoBadge /> : null}
        </div>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-sm text-muted">
          {opportunity.companyId !== undefined && intelligence.companyName !== undefined ? (
            <Link to={companyHref(opportunity.companyId)} className="text-gold hover:text-ivory">
              {intelligence.companyName}
            </Link>
          ) : (
            <span className="text-faint">No company on the record</span>
          )}
          {opportunity.personId !== undefined && intelligence.contactName !== undefined ? (
            <Link to={personHref(opportunity.personId)} className="text-gold hover:text-ivory">
              {intelligence.contactName}
            </Link>
          ) : null}
        </p>

        <dl className="mt-3 flex flex-wrap items-baseline gap-x-8 gap-y-2 border-y border-line py-3">
          <div>
            <dt className="label-caps text-faint">Value</dt>
            <dd className="font-mono text-lg text-ivory tabular-nums">
              {formatCurrencyCents(opportunity.valueCents)}
            </dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Probability</dt>
            <dd className="font-mono text-lg text-ivory tabular-nums">
              {opportunity.probability}%
            </dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Expected</dt>
            <dd className="font-mono text-lg text-gold tabular-nums">
              {formatCurrencyCents(intelligence.expectedValueCents)}
            </dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Days in stage</dt>
            <dd className="font-mono text-lg text-ivory tabular-nums">
              {intelligence.daysInStage ?? '—'}
            </dd>
          </div>
        </dl>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <span className="label-caps mr-1 text-faint">Move to</span>
        {PIPELINE_STAGES.map((stage) => (
          <button
            key={stage}
            type="button"
            disabled={busy || stage === opportunity.stage}
            onClick={() => {
              move(stage);
            }}
            className={cn(
              'label-caps border px-2 py-0.5 transition-colors disabled:opacity-40',
              stage === opportunity.stage
                ? 'border-gold/60 bg-gold-faint text-ivory'
                : 'border-line text-muted hover:border-gold/40 hover:text-ivory',
            )}
          >
            {pipelineStageLabel[stage]}
          </button>
        ))}
        {message ? <p className="ml-auto text-xs text-muted">{message}</p> : null}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Lead intelligence" className="lg:row-span-2">
          <ul className="space-y-1.5">
            {intelligence.signals.map((signal) => (
              <SignalRow key={signal.id} signal={signal} />
            ))}
          </ul>
          <p className="mt-3 text-[0.65rem] leading-4 text-faint">
            Every line is read from this record or from a local join. No enrichment provider is
            connected, so nothing here was fetched.
          </p>
        </Panel>

        <Panel title="Tasks">
          {tasks.length === 0 ? (
            <EmptyLine>No tasks attached to this opportunity.</EmptyLine>
          ) : (
            <ul>
              {tasks.map((task) => (
                <li
                  key={task.id}
                  className="flex items-baseline gap-3 border-b border-line/60 py-1.5 last:border-b-0"
                >
                  <span
                    className={cn(
                      'min-w-0 flex-1 truncate text-sm',
                      task.status === 'done' ? 'text-faint line-through' : 'text-ivory',
                    )}
                  >
                    {task.title}
                  </span>
                  <span className="label-caps shrink-0 text-faint">
                    {taskStatusLabel[task.status]}
                  </span>
                  <span className="shrink-0 font-mono text-[0.65rem] text-faint">
                    {task.dueAt ? relativeTime(task.dueAt, now) : 'no date'}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link
            to="/tasks"
            className="label-caps mt-3 inline-block border border-line px-2 py-0.5 text-muted transition-colors hover:border-gold/40 hover:text-ivory"
          >
            Open tasks
          </Link>
        </Panel>

        <Panel title="Meetings">
          {meetings.length === 0 ? (
            <EmptyLine>No meetings recorded against this opportunity.</EmptyLine>
          ) : (
            <ul>
              {meetings.map((meeting) => (
                <li key={meeting.id} className="border-b border-line/60 py-1.5 last:border-b-0">
                  <div className="flex items-baseline gap-3">
                    <span className="min-w-0 flex-1 truncate text-sm text-ivory">
                      {meeting.title}
                    </span>
                    <span className="label-caps shrink-0 text-faint">
                      {meetingKindLabel[meeting.kind]}
                    </span>
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
          )}
        </Panel>
      </div>
    </div>
  );
}
