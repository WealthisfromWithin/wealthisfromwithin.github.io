import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSovereign } from '@/app/context';
import { companyHref, knowledgeHref, opportunityHref } from '@/app/href';
import {
  answerResearchItem,
  captureResearchItem,
  recordResearchFinding,
  setResearchStatus,
} from '@/data/mutations';
import type { ResearchItem } from '@/domain';
import { relativeTime } from '@/lib/clock';
import { cn } from '@/lib/cn';
import { DemoBadge, SectionLabel, StatePill } from '@/ui/primitives';
import {
  RESEARCH_FILTERS,
  isDueToday,
  isOverdue,
  parseResearchFilter,
  researchCounts,
  researchFilterLabel,
  researchLinks,
  researchStatusLabel,
  researchStatusTone,
  selectResearchItems,
} from './research';

const filterButton = 'label-caps border px-2.5 py-1 transition-colors disabled:opacity-40';
const rowButton = 'label-caps border px-2 py-0.5 transition-colors disabled:opacity-40';

function AskForm({ onDone }: { onDone: (message: string) => void }) {
  const [question, setQuestion] = useState('');
  const [topic, setTopic] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="mb-4 border border-line bg-surface/50 px-3 py-2.5"
      onSubmit={(event) => {
        event.preventDefault();
        if (question.trim().length === 0) return;
        setBusy(true);
        void captureResearchItem({ question, topic })
          .then((item) => {
            if (item) {
              setQuestion('');
              setTopic('');
              onDone(`Queued: "${item.question}". Nothing will fetch an answer for it.`);
            } else {
              onDone('A question needs something written in it.');
            }
          })
          .catch((cause: unknown) => {
            onDone(cause instanceof Error ? cause.message : 'Queuing the question failed.');
          })
          .finally(() => {
            setBusy(false);
          });
      }}
    >
      <label className="label-caps text-faint" htmlFor="research-question">
        Ask a question
      </label>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <input
          id="research-question"
          value={question}
          onChange={(event) => {
            setQuestion(event.target.value);
          }}
          placeholder="What the operation does not yet know"
          className="min-w-72 flex-1 border border-line bg-surface/60 px-2 py-1.5 text-sm text-on-surface outline-none placeholder:text-faint focus:border-gold/50"
        />
        <input
          aria-label="Topic"
          value={topic}
          onChange={(event) => {
            setTopic(event.target.value);
          }}
          placeholder="Topic"
          className="min-w-40 border border-line bg-surface/60 px-2 py-1.5 text-sm text-on-surface outline-none placeholder:text-faint focus:border-gold/50"
        />
        <button
          type="submit"
          disabled={busy || question.trim().length === 0}
          className={cn(filterButton, 'border-gold/50 text-gold hover:border-gold hover:text-ivory')}
        >
          Queue the question
        </button>
      </div>
    </form>
  );
}

/** Findings and answers are both typed by hand; the form says so where it asks. */
function CaptureBox({
  item,
  busy,
  onFinding,
  onAnswer,
}: {
  item: ResearchItem;
  busy: boolean;
  onFinding: (item: ResearchItem, note: string, source: string) => void;
  onAnswer: (item: ResearchItem, answer: string) => void;
}) {
  const [note, setNote] = useState('');
  const [source, setSource] = useState('');
  const [answer, setAnswer] = useState('');

  return (
    <div className="mt-2 space-y-2 border-l border-line pl-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label={`Finding for ${item.question}`}
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
          }}
          placeholder="What you found out"
          className="min-w-64 flex-1 border border-line bg-surface/60 px-2 py-1 text-xs text-on-surface outline-none placeholder:text-faint focus:border-gold/50"
        />
        <input
          aria-label={`Source for ${item.question}`}
          value={source}
          onChange={(event) => {
            setSource(event.target.value);
          }}
          placeholder="Where it came from"
          className="min-w-40 border border-line bg-surface/60 px-2 py-1 text-xs text-on-surface outline-none placeholder:text-faint focus:border-gold/50"
        />
        <button
          type="button"
          disabled={busy || note.trim().length === 0}
          onClick={() => {
            onFinding(item, note, source);
            setNote('');
            setSource('');
          }}
          className={cn(rowButton, 'border-line text-muted hover:border-gold/40 hover:text-ivory')}
        >
          Record finding
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label={`Answer for ${item.question}`}
          value={answer}
          onChange={(event) => {
            setAnswer(event.target.value);
          }}
          placeholder="The answer, once you have one"
          className="min-w-64 flex-1 border border-line bg-surface/60 px-2 py-1 text-xs text-on-surface outline-none placeholder:text-faint focus:border-gold/50"
        />
        <button
          type="button"
          disabled={busy || answer.trim().length === 0}
          onClick={() => {
            onAnswer(item, answer);
            setAnswer('');
          }}
          className={cn(rowButton, 'border-gold/50 text-gold hover:border-gold hover:text-ivory')}
        >
          Answer it
        </button>
      </div>
    </div>
  );
}

function ResearchRow({
  item,
  now,
  busy,
  onFinding,
  onAnswer,
  onStatus,
}: {
  item: ResearchItem;
  now: Date;
  busy: boolean;
  onFinding: (item: ResearchItem, note: string, source: string) => void;
  onAnswer: (item: ResearchItem, answer: string) => void;
  onStatus: (item: ResearchItem, status: 'queued' | 'active' | 'parked') => void;
}) {
  const { dataset } = useSovereign();
  const [open, setOpen] = useState(false);
  const links = useMemo(() => researchLinks(dataset, item), [dataset, item]);
  const overdue = isOverdue(item, now);
  const today = isDueToday(item, now);

  return (
    <li className="border-b border-line/60 py-2.5 last:border-b-0">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <button
              type="button"
              aria-expanded={open}
              onClick={() => {
                setOpen((value) => !value);
              }}
              className="text-left text-sm text-ivory hover:text-gold"
            >
              {item.question}
            </button>
            {item.source === 'demo' ? <DemoBadge /> : null}
            <StatePill tone={researchStatusTone(item.status)}>
              {researchStatusLabel[item.status]}
            </StatePill>
            {overdue ? <StatePill tone="critical">Overdue</StatePill> : null}
            {today ? <StatePill tone="warning">Due today</StatePill> : null}
          </div>

          {item.status === 'answered' && item.answer.length > 0 ? (
            <p className="mt-0.5 text-xs leading-5 text-muted">{item.answer}</p>
          ) : null}

          <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 font-mono text-[0.65rem] text-faint">
            {item.topic.length > 0 ? <span>{item.topic}</span> : null}
            <span aria-hidden>·</span>
            <span>{item.priority} priority</span>
            <span aria-hidden>·</span>
            <span>
              {item.findings.length} finding{item.findings.length === 1 ? '' : 's'}
            </span>
            {item.dueAt ? (
              <>
                <span aria-hidden>·</span>
                <span className={overdue ? 'text-alert' : today ? 'text-gold' : undefined}>
                  due {relativeTime(item.dueAt, now)}
                </span>
              </>
            ) : null}
            {links.opportunity ? (
              <>
                <span aria-hidden>·</span>
                <Link to={opportunityHref(links.opportunity.id)} className="hover:text-ivory">
                  {links.opportunity.name}
                </Link>
              </>
            ) : null}
            {links.company ? (
              <>
                <span aria-hidden>·</span>
                <Link to={companyHref(links.company.id)} className="hover:text-ivory">
                  {links.company.name}
                </Link>
              </>
            ) : null}
            {links.knowledgeNode ? (
              <>
                <span aria-hidden>·</span>
                <Link to={knowledgeHref(links.knowledgeNode.id)} className="hover:text-ivory">
                  {links.knowledgeNode.title}
                </Link>
              </>
            ) : null}
          </p>

          {open ? (
            <div className="mt-2">
              {item.findings.length === 0 ? (
                <p className="text-xs text-faint italic">
                  Nothing has been recorded against this question. No connector will fetch anything
                  for it.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {item.findings.map((finding) => (
                    <li key={`${finding.at}:${finding.note}`} className="text-xs leading-5">
                      <span className="text-muted">{finding.note}</span>
                      <span className="ml-2 font-mono text-[0.65rem] text-faint">
                        {finding.source.length > 0 ? `${finding.source} · ` : ''}
                        {relativeTime(finding.at, now)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {item.status === 'answered' ? null : (
                <CaptureBox item={item} busy={busy} onFinding={onFinding} onAnswer={onAnswer} />
              )}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 pt-0.5">
          {item.status === 'queued' ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                onStatus(item, 'active');
              }}
              className={cn(
                rowButton,
                'border-line text-muted hover:border-gold/40 hover:text-ivory',
              )}
            >
              Start
            </button>
          ) : null}
          {item.status === 'parked' || item.status === 'answered' ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                onStatus(item, 'active');
              }}
              className={cn(
                rowButton,
                'border-line text-muted hover:border-gold/40 hover:text-ivory',
              )}
            >
              Reopen
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                onStatus(item, 'parked');
              }}
              className={cn(
                rowButton,
                'border-line text-faint hover:border-gold/40 hover:text-ivory',
              )}
            >
              Park
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

export function ResearchPage() {
  const { dataset, ready } = useSovereign();
  const [searchParams, setSearchParams] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const now = useMemo(() => new Date(), []);

  const filter = parseResearchFilter(searchParams.get('status'));
  const counts = useMemo(() => researchCounts(dataset, now), [dataset, now]);
  const rows = useMemo(() => selectResearchItems(dataset, filter), [dataset, filter]);

  function run(work: Promise<{ ok: boolean; reason?: string }>, done: string) {
    setBusy(true);
    setMessage(null);
    void work
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

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <header className="mb-5">
        <SectionLabel>Cognition</SectionLabel>
        <h1 className="mt-1 font-display text-2xl text-ivory">Research</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Open questions and the findings recorded against them by hand. There is no crawler and no
          search connector here: a question stays open until somebody writes down what they learned,
          and the queue shows how long that has taken.
        </p>

        <dl className="mt-4 flex flex-wrap items-baseline gap-x-8 gap-y-2 border-y border-line py-3">
          <div>
            <dt className="label-caps text-faint">Open</dt>
            <dd className="font-mono text-lg text-ivory tabular-nums">{counts.open}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Overdue</dt>
            <dd className="font-mono text-lg text-alert tabular-nums">{counts.overdue}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Due today</dt>
            <dd className="font-mono text-lg text-gold tabular-nums">{counts.dueToday}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Answered</dt>
            <dd className="font-mono text-lg text-muted tabular-nums">{counts.answered}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Findings recorded</dt>
            <dd className="font-mono text-lg text-muted tabular-nums">{counts.findings}</dd>
          </div>
        </dl>
      </header>

      <AskForm onDone={setMessage} />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {RESEARCH_FILTERS.map((value) => (
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
            {researchFilterLabel[value]}
          </button>
        ))}
      </div>

      {message ? <p className="mb-2 text-xs text-muted">{message}</p> : null}

      {!ready ? (
        <p className="text-sm text-faint italic">Opening the local store…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-faint italic">
          {counts.total === 0
            ? 'No question has been queued yet.'
            : 'No question matches this filter.'}
        </p>
      ) : (
        <ul>
          {rows.map((item) => (
            <ResearchRow
              key={item.id}
              item={item}
              now={now}
              busy={busy}
              onFinding={(target, note, source) => {
                run(
                  recordResearchFinding(target.id, note, source),
                  'Finding recorded against the question.',
                );
              }}
              onAnswer={(target, answer) => {
                run(answerResearchItem(target.id, answer), 'Answered, in your words.');
              }}
              onStatus={(target, status) => {
                run(
                  setResearchStatus(target.id, status),
                  status === 'active' ? 'Marked in progress.' : 'Parked.',
                );
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
