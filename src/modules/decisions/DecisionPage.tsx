import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSovereign } from '@/app/context';
import {
  companyHref,
  contentHref,
  decisionHref,
  knowledgeHref,
  opportunityHref,
  personHref,
} from '@/app/href';
import { decideDecision, setDecisionStatus, supersedeDecision } from '@/data/mutations';
import { canTransitionDecision } from '@/domain';
import { relativeTime } from '@/lib/clock';
import { cn } from '@/lib/cn';
import { DemoBadge, EmptyLine, Panel, SectionLabel, StatePill } from '@/ui/primitives';
import { memoryKindLabel } from '@/modules/memory/memory';
import {
  decisionLinks,
  decisionStatusLabel,
  decisionStatusTone,
  findDecision,
  isDueForReview,
  isOverdue,
} from './decisions';

const actionButton = 'label-caps border px-2.5 py-1 transition-colors disabled:opacity-40';

function MissingDecision({ id }: { id: string | undefined }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <SectionLabel>Command</SectionLabel>
      <h1 className="mt-1 font-display text-2xl text-ivory">Not in the local store</h1>
      <p className="mt-2 text-sm text-muted">
        No decision with id <span className="font-mono text-faint">{id ?? '—'}</span> exists here.
        The record may have been removed with the demo data.
      </p>
      <Link
        to="/decisions"
        className="label-caps mt-4 inline-block border border-line px-2.5 py-1 text-muted transition-colors hover:border-gold/40 hover:text-ivory"
      >
        Back to the Decision Log
      </Link>
    </div>
  );
}

/**
 * Making the call. The choice and the rationale are both required by the
 * writer, so the form asks for both rather than letting a bare answer through
 * and losing the reasoning that made it one.
 */
function DecideForm({
  decisionId,
  onDone,
}: {
  decisionId: string;
  onDone: (message: string) => void;
}) {
  const [choice, setChoice] = useState('');
  const [rationale, setRationale] = useState('');
  const [consequences, setConsequences] = useState('');
  const [busy, setBusy] = useState(false);

  const ready = choice.trim().length > 0 && rationale.trim().length > 0;

  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!ready) return;
        setBusy(true);
        void decideDecision(decisionId, { choice, rationale, consequences })
          .then((result) => {
            onDone(
              result.ok
                ? 'Recorded, with the reasoning attached.'
                : (result.reason ?? 'Nothing changed.'),
            );
            if (result.ok) {
              setChoice('');
              setRationale('');
              setConsequences('');
            }
          })
          .catch((cause: unknown) => {
            onDone(cause instanceof Error ? cause.message : 'The write failed.');
          })
          .finally(() => {
            setBusy(false);
          });
      }}
    >
      <div>
        <label className="label-caps text-faint" htmlFor="decide-choice">
          What was chosen
        </label>
        <input
          id="decide-choice"
          value={choice}
          onChange={(event) => {
            setChoice(event.target.value);
          }}
          placeholder="The answer, in one line"
          className="mt-1 w-full border border-line bg-surface/60 px-2 py-1.5 text-sm text-on-surface outline-none placeholder:text-faint focus:border-gold/50"
        />
      </div>
      <div>
        <label className="label-caps text-faint" htmlFor="decide-rationale">
          Why
        </label>
        <textarea
          id="decide-rationale"
          value={rationale}
          onChange={(event) => {
            setRationale(event.target.value);
          }}
          rows={3}
          placeholder="The reasoning a future reader will need"
          className="mt-1 w-full border border-line bg-surface/60 px-2 py-1.5 text-sm leading-6 text-on-surface outline-none placeholder:text-faint focus:border-gold/50"
        />
      </div>
      <div>
        <label className="label-caps text-faint" htmlFor="decide-consequences">
          What follows from it
        </label>
        <input
          id="decide-consequences"
          value={consequences}
          onChange={(event) => {
            setConsequences(event.target.value);
          }}
          placeholder="Optional"
          className="mt-1 w-full border border-line bg-surface/60 px-2 py-1.5 text-sm text-on-surface outline-none placeholder:text-faint focus:border-gold/50"
        />
      </div>
      <button
        type="submit"
        disabled={busy || !ready}
        className={cn(actionButton, 'border-gold/50 text-gold hover:border-gold hover:text-ivory')}
      >
        Record the decision
      </button>
      {!ready ? (
        <p className="text-xs text-faint italic">
          A decision needs the choice and the reasoning. A list of answers with no reasoning is not
          institutional memory.
        </p>
      ) : null}
    </form>
  );
}

export function DecisionPage() {
  const { id } = useParams();
  const { dataset } = useSovereign();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [replacement, setReplacement] = useState('');
  const now = useMemo(() => new Date(), []);

  const decision = findDecision(dataset, id);
  const links = useMemo(
    () => (decision ? decisionLinks(dataset, decision) : null),
    [dataset, decision],
  );
  const candidates = useMemo(
    () =>
      decision
        ? dataset.decisions.filter(
            (row) => row.id !== decision.id && row.status === 'decided',
          )
        : [],
    [dataset, decision],
  );

  if (!decision || !links) return <MissingDecision id={id} />;

  function run(work: () => Promise<{ ok: boolean; reason?: string }>, done: string) {
    setBusy(true);
    setMessage(null);
    void work()
      .then((result) => {
        setMessage(result.ok ? done : (result.reason ?? 'Nothing changed.'));
      })
      .catch((cause: unknown) => {
        setMessage(cause instanceof Error ? cause.message : 'The write failed.');
      })
      .finally(() => {
        setBusy(false);
      });
  }

  const overdue = isOverdue(decision, now);
  const review = isDueForReview(decision, now);

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <header className="mb-5">
        <div className="flex items-center gap-2">
          <SectionLabel>Decision Log</SectionLabel>
          <Link to="/decisions" className="label-caps text-faint hover:text-muted">
            · every call
          </Link>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl text-ivory">{decision.title}</h1>
          {decision.source === 'demo' ? <DemoBadge /> : null}
          <StatePill tone={decisionStatusTone(decision.status)}>
            {decisionStatusLabel[decision.status]}
          </StatePill>
          {overdue ? <StatePill tone="critical">Past its date</StatePill> : null}
          {review ? <StatePill tone="warning">Due for review</StatePill> : null}
          {decision.reversible ? null : (
            <StatePill tone="critical" title="Reversing it costs more than making it.">
              One-way door
            </StatePill>
          )}
        </div>

        <p className="mt-2 flex flex-wrap items-baseline gap-x-3 font-mono text-[0.65rem] text-faint">
          <span>{decision.impact} impact</span>
          <span aria-hidden>·</span>
          <span>
            {decision.decidedAt
              ? `decided ${relativeTime(decision.decidedAt, now)}${
                  decision.decidedBy === undefined ? '' : ` by ${decision.decidedBy}`
                }`
              : decision.dueAt
                ? `call due ${relativeTime(decision.dueAt, now)}`
                : 'no date set'}
          </span>
          {decision.reviewAt ? (
            <>
              <span aria-hidden>·</span>
              <span className={review ? 'text-gold' : undefined}>
                review {relativeTime(decision.reviewAt, now)}
              </span>
            </>
          ) : null}
          {decision.tags.map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {canTransitionDecision(decision.status, 'proposed') ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                run(
                  () => setDecisionStatus(decision.id, 'proposed'),
                  'Reopened. The choice stays on the record as what was decided before.',
                );
              }}
              className={cn(
                actionButton,
                'border-line text-muted hover:border-gold/40 hover:text-ivory',
              )}
            >
              Reopen
            </button>
          ) : null}
          {canTransitionDecision(decision.status, 'withdrawn') ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                run(
                  () => setDecisionStatus(decision.id, 'withdrawn'),
                  'Withdrawn. It stays in the log as a question nobody answered.',
                );
              }}
              className={cn(
                actionButton,
                'border-line text-faint hover:border-gold/40 hover:text-ivory',
              )}
            >
              Withdraw
            </button>
          ) : null}
          {message ? <span className="text-xs text-muted">{message}</span> : null}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel title="The question">
            {decision.context.length > 0 ? (
              <p className="text-sm leading-6 text-muted">{decision.context}</p>
            ) : (
              <EmptyLine>Nothing was written about what forced the question.</EmptyLine>
            )}
          </Panel>

          {decision.status === 'proposed' ? (
            <Panel title="Make the call">
              <DecideForm decisionId={decision.id} onDone={setMessage} />
            </Panel>
          ) : (
            <Panel title="What was chosen, and why">
              {decision.choice.length > 0 ? (
                <p className="text-sm leading-6 text-ivory">{decision.choice}</p>
              ) : (
                <EmptyLine>No choice is recorded.</EmptyLine>
              )}
              {decision.rationale.length > 0 ? (
                <p className="mt-2 text-sm leading-6 text-muted">{decision.rationale}</p>
              ) : (
                <EmptyLine>No reasoning is recorded against this call.</EmptyLine>
              )}
              {decision.consequences.length > 0 ? (
                <p className="mt-3 border-t border-line pt-2 text-xs leading-5 text-muted">
                  <span className="label-caps text-faint">What follows · </span>
                  {decision.consequences}
                </p>
              ) : null}
            </Panel>
          )}

          <Panel title="Alternatives considered">
            {decision.alternatives.length === 0 ? (
              <EmptyLine>
                No alternative was written down, so the log cannot show what was weighed.
              </EmptyLine>
            ) : (
              <ul className="space-y-1.5">
                {decision.alternatives.map((line) => (
                  <li key={line} className="flex gap-2 text-sm leading-6 text-muted">
                    <span className="text-faint" aria-hidden>
                      —
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {decision.status === 'decided' && candidates.length > 0 ? (
            <Panel title="Replace it with a later call">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="The decision that replaces this one"
                  value={replacement}
                  onChange={(event) => {
                    setReplacement(event.target.value);
                  }}
                  className="min-w-64 flex-1 border border-line bg-surface/60 px-2 py-1.5 text-sm text-muted outline-none focus:border-gold/50"
                >
                  <option value="">Select the decision that replaced it…</option>
                  {candidates.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.title}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={busy || replacement.length === 0}
                  onClick={() => {
                    run(
                      () => supersedeDecision(decision.id, replacement),
                      'Superseded. Both calls stay in the log, with the link between them.',
                    );
                  }}
                  className={cn(
                    actionButton,
                    'border-line text-muted hover:border-gold/40 hover:text-ivory',
                  )}
                >
                  Supersede
                </button>
              </div>
            </Panel>
          ) : null}
        </div>

        <div className="space-y-4">
          <Panel title="What it touches">
            <ul className="space-y-1.5 text-sm">
              {links.people.map((person) => (
                <li key={person.id}>
                  <Link to={personHref(person.id)} className="text-muted hover:text-gold">
                    {person.name}
                  </Link>
                </li>
              ))}
              {links.company ? (
                <li>
                  <Link to={companyHref(links.company.id)} className="text-muted hover:text-gold">
                    {links.company.name}
                  </Link>
                </li>
              ) : null}
              {links.opportunity ? (
                <li>
                  <Link
                    to={opportunityHref(links.opportunity.id)}
                    className="text-muted hover:text-gold"
                  >
                    {links.opportunity.name}
                  </Link>
                </li>
              ) : null}
              {links.project ? (
                <li>
                  <Link to="/projects?status=all" className="text-muted hover:text-gold">
                    {links.project.title}
                  </Link>
                </li>
              ) : null}
              {links.contentItem ? (
                <li>
                  <Link
                    to={contentHref(links.contentItem.id)}
                    className="text-muted hover:text-gold"
                  >
                    {links.contentItem.title}
                  </Link>
                </li>
              ) : null}
              {links.knowledgeNode ? (
                <li>
                  <Link
                    to={knowledgeHref(links.knowledgeNode.id)}
                    className="text-muted hover:text-gold"
                  >
                    {links.knowledgeNode.title}
                  </Link>
                </li>
              ) : null}
            </ul>
            {links.people.length === 0 &&
            !links.company &&
            !links.opportunity &&
            !links.project &&
            !links.contentItem &&
            !links.knowledgeNode ? (
              <EmptyLine>Nothing in the store is linked to this call.</EmptyLine>
            ) : null}
          </Panel>

          <Panel title="Its history">
            <ul className="space-y-1.5 text-xs">
              {links.supersededBy ? (
                <li className="flex items-baseline gap-2">
                  <span className="label-caps shrink-0 text-faint">Replaced by</span>
                  <Link
                    to={decisionHref(links.supersededBy.id)}
                    className="text-muted hover:text-gold"
                  >
                    {links.supersededBy.title}
                  </Link>
                </li>
              ) : null}
              {links.supersedes.map((row) => (
                <li key={row.id} className="flex items-baseline gap-2">
                  <span className="label-caps shrink-0 text-faint">Replaced</span>
                  <Link to={decisionHref(row.id)} className="text-muted hover:text-gold">
                    {row.title}
                  </Link>
                </li>
              ))}
              {links.memories.map((entry) => (
                <li key={entry.id} className="flex items-baseline gap-2">
                  <span className="label-caps shrink-0 text-faint">
                    {memoryKindLabel[entry.kind]}
                  </span>
                  <Link to="/memory?state=all" className="text-muted hover:text-gold">
                    {entry.statement}
                  </Link>
                </li>
              ))}
            </ul>
            {!links.supersededBy && links.supersedes.length === 0 && links.memories.length === 0 ? (
              <EmptyLine>
                Nothing has replaced this call and no memory was saved from it.
              </EmptyLine>
            ) : null}
          </Panel>
        </div>
      </div>
    </div>
  );
}
