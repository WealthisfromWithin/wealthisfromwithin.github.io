import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSovereign } from '@/app/context';
import { contentHref } from '@/app/href';
import { captureContentIdea, promoteContentIdea, setIdeaStatus } from '@/data/mutations';
import type { ContentIdea } from '@/domain';
import { cn } from '@/lib/cn';
import { DemoBadge, SectionLabel, StatePill } from '@/ui/primitives';
import { ContentTabs } from './ContentTabs';
import {
  IDEA_FILTERS,
  ideaFilterLabel,
  ideaScore,
  ideaStatusLabel,
  parseIdeaFilter,
  selectIdeas,
} from './content';

const filterButton = 'label-caps border px-2.5 py-1 transition-colors disabled:opacity-40';
const rowButton = 'label-caps border px-2 py-0.5 transition-colors disabled:opacity-40';

function CaptureForm({ onCaptured }: { onCaptured: (message: string) => void }) {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="mb-4 border border-line bg-surface/50 px-3 py-2.5"
      onSubmit={(event) => {
        event.preventDefault();
        if (title.trim().length === 0) return;
        setBusy(true);
        void captureContentIdea({ title, summary })
          .then((idea) => {
            if (idea) {
              setTitle('');
              setSummary('');
              onCaptured(
                `Captured "${idea.title}" at the default 3/3/3 score. Operator-owned, so no reseed removes it.`,
              );
            }
          })
          .finally(() => {
            setBusy(false);
          });
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <label className="label-caps text-faint" htmlFor="new-idea-title">
          Capture
        </label>
        <input
          id="new-idea-title"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
          }}
          placeholder="What is worth saying?"
          className="min-w-0 flex-1 bg-transparent text-sm text-ivory outline-none placeholder:text-faint"
        />
        <button
          type="submit"
          disabled={busy || title.trim().length === 0}
          className={cn(rowButton, 'border-gold/50 text-gold hover:border-gold hover:text-ivory')}
        >
          Add
        </button>
      </div>
      <input
        id="new-idea-summary"
        value={summary}
        onChange={(event) => {
          setSummary(event.target.value);
        }}
        placeholder="The argument in one line (optional)"
        aria-label="Idea summary"
        className="mt-1.5 w-full bg-transparent text-xs text-muted outline-none placeholder:text-faint"
      />
    </form>
  );
}

function IdeaRow({
  idea,
  busy,
  onPromote,
  onPark,
}: {
  idea: ContentIdea;
  busy: boolean;
  onPromote: (idea: ContentIdea) => void;
  onPark: (idea: ContentIdea) => void;
}) {
  const { dataset } = useSovereign();
  const promoted = dataset.contentItems.find((item) => item.id === idea.promotedItemId);

  return (
    <li className="border-b border-line/60 py-2.5 last:border-b-0">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="text-sm text-ivory">{idea.title}</span>
            {idea.source === 'demo' ? <DemoBadge /> : null}
            <StatePill tone={idea.status === 'captured' ? 'gold' : 'muted'}>
              {ideaStatusLabel[idea.status]}
            </StatePill>
          </div>
          {idea.summary.length > 0 ? (
            <p className="mt-0.5 text-xs leading-5 text-muted">{idea.summary}</p>
          ) : null}
          <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 font-mono text-[0.65rem] text-faint">
            <span>reach {idea.reach}</span>
            <span aria-hidden>·</span>
            <span>effort {idea.effort}</span>
            <span aria-hidden>·</span>
            <span>confidence {idea.confidence}</span>
            {idea.origin.length > 0 ? (
              <>
                <span aria-hidden>·</span>
                <span>{idea.origin}</span>
              </>
            ) : null}
            {promoted ? (
              <>
                <span aria-hidden>·</span>
                <Link to={contentHref(promoted.id)} className="hover:text-ivory">
                  drafted as {promoted.title}
                </Link>
              </>
            ) : null}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          <span
            className="font-mono text-sm text-gold tabular-nums"
            title="reach × confidence ÷ effort, on the scores recorded here"
          >
            {ideaScore(idea).toFixed(1)}
          </span>
          {idea.promotedItemId === undefined ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  onPromote(idea);
                }}
                className={cn(
                  rowButton,
                  'border-line text-muted hover:border-gold/40 hover:text-ivory',
                )}
              >
                Promote to draft
              </button>
              {idea.status === 'captured' ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    onPark(idea);
                  }}
                  className={cn(
                    rowButton,
                    'border-line text-faint hover:border-gold/40 hover:text-muted',
                  )}
                >
                  Park
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function ContentIdeasPage() {
  const { dataset, ready } = useSovereign();
  const [searchParams, setSearchParams] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const filter = parseIdeaFilter(searchParams.get('status'));
  const rows = useMemo(() => selectIdeas(dataset, filter), [dataset, filter]);

  function promote(idea: ContentIdea) {
    setBusy(true);
    setMessage(null);
    void promoteContentIdea(idea.id)
      .then((result) => {
        setMessage(
          result
            ? `"${result.item.title}" is now a draft in the production queue.`
            : 'That idea has already been promoted.',
        );
      })
      .finally(() => {
        setBusy(false);
      });
  }

  function park(idea: ContentIdea) {
    setBusy(true);
    setMessage(null);
    void setIdeaStatus(idea.id, 'parked')
      .then((changed) => {
        setMessage(changed ? `Parked "${idea.title}".` : 'Nothing changed.');
      })
      .finally(() => {
        setBusy(false);
      });
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <header className="mb-5">
        <SectionLabel>
          <Link to="/content" className="hover:text-ivory">
            Content
          </Link>{' '}
          · Vault
        </SectionLabel>
        <h1 className="mt-1 font-display text-2xl text-ivory">Idea Vault</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Ranked by reach × confidence ÷ effort, on the three numbers recorded against each idea.
          The inputs are printed beside the result: nothing here is scored by a model.
        </p>
      </header>

      <ContentTabs />

      <CaptureForm onCaptured={setMessage} />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {IDEA_FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              const params = new URLSearchParams();
              if (value !== 'captured') params.set('status', value);
              setSearchParams(params);
            }}
            className={cn(
              filterButton,
              filter === value
                ? 'border-gold/60 bg-gold-faint text-ivory'
                : 'border-line text-faint hover:border-gold/40 hover:text-muted',
            )}
          >
            {ideaFilterLabel[value]}
          </button>
        ))}
      </div>

      {message ? <p className="mb-2 text-xs text-muted">{message}</p> : null}

      {!ready ? (
        <p className="text-sm text-faint italic">Opening the local store…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-faint italic">
          {dataset.contentIdeas.length === 0
            ? 'The vault is empty. Capture the first idea above.'
            : 'No ideas in this state.'}
        </p>
      ) : (
        <ul>
          {rows.map((idea) => (
            <IdeaRow key={idea.id} idea={idea} busy={busy} onPromote={promote} onPark={park} />
          ))}
        </ul>
      )}
    </div>
  );
}
