import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSovereign } from '@/app/context';
import { decisionHref } from '@/app/href';
import { recordDecision } from '@/data/mutations';
import type { Decision } from '@/domain';
import { relativeTime } from '@/lib/clock';
import { cn } from '@/lib/cn';
import { DemoBadge, SectionLabel, StatePill } from '@/ui/primitives';
import {
  DECISION_FILTERS,
  decisionCounts,
  decisionFilterLabel,
  decisionStatusLabel,
  decisionStatusTone,
  isDueForReview,
  isOverdue,
  parseDecisionFilter,
  selectDecisions,
} from './decisions';

const filterButton = 'label-caps border px-2.5 py-1 transition-colors disabled:opacity-40';

function NewDecisionForm({ onDone }: { onDone: (message: string) => void }) {
  const [title, setTitle] = useState('');
  const [context, setContext] = useState('');
  const [busy, setBusy] = useState(false);

  function submit() {
    if (title.trim().length === 0) return;
    setBusy(true);
    void recordDecision({ title, context })
      .then((decision) => {
        if (decision) {
          setTitle('');
          setContext('');
          onDone(
            `Logged "${decision.title}" as awaiting a call. Open it to record the choice and why.`,
          );
        } else {
          onDone('A decision needs a title.');
        }
      })
      .catch((cause: unknown) => {
        onDone(cause instanceof Error ? cause.message : 'Logging the decision failed.');
      })
      .finally(() => {
        setBusy(false);
      });
  }

  return (
    <form
      className="mb-4 border border-line bg-surface/50 px-3 py-2.5"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label className="label-caps text-faint" htmlFor="decision-title">
        Log a decision
      </label>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <input
          id="decision-title"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
          }}
          placeholder="The call to be made"
          className="min-w-64 flex-1 border border-line bg-surface/60 px-2 py-1.5 text-sm text-on-surface outline-none placeholder:text-faint focus:border-gold/50"
        />
        <input
          id="decision-context"
          aria-label="The question, before anyone answered it"
          value={context}
          onChange={(event) => {
            setContext(event.target.value);
          }}
          placeholder="What forced the question"
          className="min-w-64 flex-1 border border-line bg-surface/60 px-2 py-1.5 text-sm text-on-surface outline-none placeholder:text-faint focus:border-gold/50"
        />
        <button
          type="submit"
          disabled={busy || title.trim().length === 0}
          className={cn(filterButton, 'border-gold/50 text-gold hover:border-gold hover:text-ivory')}
        >
          New decision
        </button>
      </div>
    </form>
  );
}

function DecisionRow({ decision, now }: { decision: Decision; now: Date }) {
  const overdue = isOverdue(decision, now);
  const review = isDueForReview(decision, now);

  return (
    <li className="border-b border-line/60 py-2.5 last:border-b-0">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Link to={decisionHref(decision.id)} className="text-sm text-ivory hover:text-gold">
              {decision.title}
            </Link>
            {decision.source === 'demo' ? <DemoBadge /> : null}
            <StatePill tone={decisionStatusTone(decision.status)}>
              {decisionStatusLabel[decision.status]}
            </StatePill>
            {overdue ? <StatePill tone="critical">Past its date</StatePill> : null}
            {review ? <StatePill tone="warning">Due for review</StatePill> : null}
            {!decision.reversible ? (
              <StatePill tone="critical" title="A one-way door. Reversing it costs more than making it.">
                One-way
              </StatePill>
            ) : null}
          </div>

          <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted">
            {decision.status === 'decided' && decision.choice.length > 0
              ? decision.choice
              : decision.context.length > 0
                ? decision.context
                : 'No context recorded.'}
          </p>

          <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 font-mono text-[0.65rem] text-faint">
            {decision.status === 'proposed' ? (
              <span className={overdue ? 'text-alert' : undefined}>
                {decision.dueAt ? `call due ${relativeTime(decision.dueAt, now)}` : 'no date set'}
              </span>
            ) : (
              <span>
                {decision.decidedAt
                  ? `decided ${relativeTime(decision.decidedAt, now)}`
                  : 'no decision date'}
              </span>
            )}
            <span aria-hidden>·</span>
            <span>{decision.impact} impact</span>
            {decision.alternatives.length > 0 ? (
              <>
                <span aria-hidden>·</span>
                <span>{decision.alternatives.length} alternatives recorded</span>
              </>
            ) : null}
            {decision.tags.map((tag) => (
              <span key={tag} className="flex items-baseline gap-x-2">
                <span aria-hidden>·</span>
                <span>#{tag}</span>
              </span>
            ))}
          </p>
        </div>

        <Link
          to={decisionHref(decision.id)}
          className="label-caps shrink-0 border border-line px-2 py-0.5 text-faint transition-colors hover:border-gold/40 hover:text-ivory"
        >
          {decision.status === 'proposed' ? 'Decide' : 'Open'}
        </Link>
      </div>
    </li>
  );
}

export function DecisionsPage() {
  const { dataset, ready } = useSovereign();
  const [searchParams, setSearchParams] = useSearchParams();
  const [message, setMessage] = useState<string | null>(null);
  const now = useMemo(() => new Date(), []);

  const filter = parseDecisionFilter(searchParams.get('status'));
  const counts = useMemo(() => decisionCounts(dataset, now), [dataset, now]);
  const rows = useMemo(() => selectDecisions(dataset, filter), [dataset, filter]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <header className="mb-5">
        <SectionLabel>Command</SectionLabel>
        <h1 className="mt-1 font-display text-2xl text-ivory">Decision Log</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Every consequential call, with the question that forced it and the reasoning behind the
          answer. A decision cannot be recorded as made without the choice and the rationale — a
          list of choices with no reasoning is not institutional memory.
        </p>

        <dl className="mt-4 flex flex-wrap items-baseline gap-x-8 gap-y-2 border-y border-line py-3">
          <div>
            <dt className="label-caps text-faint">Awaiting a call</dt>
            <dd className="font-mono text-lg text-gold tabular-nums">{counts.proposed}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Past its date</dt>
            <dd className="font-mono text-lg text-alert tabular-nums">{counts.overdue}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Decided</dt>
            <dd className="font-mono text-lg text-ivory tabular-nums">{counts.decided}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">One-way doors</dt>
            <dd className="font-mono text-lg text-muted tabular-nums">{counts.irreversible}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Due for review</dt>
            <dd className="font-mono text-lg text-muted tabular-nums">{counts.review}</dd>
          </div>
        </dl>
      </header>

      <NewDecisionForm onDone={setMessage} />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {DECISION_FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setSearchParams(value === 'open' ? {} : { status: value });
            }}
            className={cn(
              filterButton,
              filter === value
                ? 'border-gold/60 bg-gold-faint text-ivory'
                : 'border-line text-faint hover:border-gold/40 hover:text-muted',
            )}
          >
            {decisionFilterLabel[value]}
          </button>
        ))}
      </div>

      {message ? <p className="mb-2 text-xs text-muted">{message}</p> : null}

      {!ready ? (
        <p className="text-sm text-faint italic">Opening the local store…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-faint italic">
          {counts.total === 0
            ? 'No decision has been recorded yet.'
            : 'No decision matches this filter.'}
        </p>
      ) : (
        <ul>
          {rows.map((decision) => (
            <DecisionRow key={decision.id} decision={decision} now={now} />
          ))}
        </ul>
      )}
    </div>
  );
}
