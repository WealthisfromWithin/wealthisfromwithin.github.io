import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSovereign } from '@/app/context';
import { savePrompt, startAgentSession } from '@/data/mutations';
import type { Prompt, PromptIntent } from '@/domain';
import { relativeTime } from '@/lib/clock';
import { cn } from '@/lib/cn';
import { DemoBadge, SectionLabel, StatePill } from '@/ui/primitives';
import {
  PROMPT_FILTERS,
  parsePromptFilter,
  promptCounts,
  promptFilterLabel,
  promptIntentLabel,
  promptSegments,
  promptSessions,
  selectPrompts,
} from './prompts';

const filterButton = 'label-caps border px-2.5 py-1 transition-colors disabled:opacity-40';
const rowButton = 'label-caps border px-2 py-0.5 transition-colors disabled:opacity-40';

const INTENTS: PromptIntent[] = ['draft', 'analyse', 'summarise', 'plan', 'critique', 'extract'];

function NewPromptForm({ onDone }: { onDone: (message: string) => void }) {
  const [title, setTitle] = useState('');
  const [intent, setIntent] = useState<PromptIntent>('draft');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const ready = title.trim().length > 0 && body.trim().length > 0;

  return (
    <form
      className="mb-4 space-y-2 border border-line bg-surface/50 px-3 py-2.5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!ready) return;
        setBusy(true);
        void savePrompt({ title, intent, body })
          .then((prompt) => {
            if (prompt) {
              setTitle('');
              setBody('');
              onDone(
                prompt.variables.length === 0
                  ? `Saved "${prompt.title}".`
                  : `Saved "${prompt.title}" with ${String(prompt.variables.length)} variables read off the body.`,
              );
            } else {
              onDone('A prompt needs a title and a body.');
            }
          })
          .catch((cause: unknown) => {
            onDone(cause instanceof Error ? cause.message : 'Saving the prompt failed.');
          })
          .finally(() => {
            setBusy(false);
          });
      }}
    >
      <label className="label-caps text-faint" htmlFor="prompt-title">
        Save a prompt
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id="prompt-title"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
          }}
          placeholder="What this instruction is for"
          className="min-w-64 flex-1 border border-line bg-surface/60 px-2 py-1.5 text-sm text-on-surface outline-none placeholder:text-faint focus:border-gold/50"
        />
        <select
          aria-label="Intent"
          value={intent}
          onChange={(event) => {
            setIntent(event.target.value as PromptIntent);
          }}
          className="label-caps border border-line bg-surface/60 px-2 py-1.5 text-muted outline-none focus:border-gold/50"
        >
          {INTENTS.map((value) => (
            <option key={value} value={value}>
              {promptIntentLabel[value]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={busy || !ready}
          className={cn(filterButton, 'border-gold/50 text-gold hover:border-gold hover:text-ivory')}
        >
          Save prompt
        </button>
      </div>
      <textarea
        aria-label="Prompt body"
        value={body}
        onChange={(event) => {
          setBody(event.target.value);
        }}
        rows={3}
        placeholder="The instruction itself. Wrap variables in {{braces}}."
        className="w-full border border-line bg-surface/60 px-2 py-1.5 font-mono text-xs leading-6 text-on-surface outline-none placeholder:text-faint focus:border-gold/50"
      />
    </form>
  );
}

function PromptRow({
  prompt,
  now,
  busy,
  onRun,
}: {
  prompt: Prompt;
  now: Date;
  busy: boolean;
  onRun: (prompt: Prompt) => void;
}) {
  const { dataset } = useSovereign();
  const [open, setOpen] = useState(false);
  const segments = useMemo(() => promptSegments(prompt.body), [prompt.body]);
  const sessions = useMemo(() => promptSessions(dataset, prompt), [dataset, prompt]);

  return (
    <li className="border-b border-line/60 py-2.5 last:border-b-0">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setOpen((value) => !value);
              }}
              aria-expanded={open}
              className="text-left text-sm text-ivory hover:text-gold"
            >
              {prompt.title}
            </button>
            {prompt.source === 'demo' ? <DemoBadge /> : null}
            <StatePill tone="neutral">{promptIntentLabel[prompt.intent]}</StatePill>
            {prompt.requiresApproval ? (
              <StatePill tone="gold" title="Output from this prompt passes a human gate.">
                Gated
              </StatePill>
            ) : null}
          </div>

          {prompt.notes.length > 0 ? (
            <p className="mt-0.5 text-xs leading-5 text-muted">{prompt.notes}</p>
          ) : null}

          <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 font-mono text-[0.65rem] text-faint">
            <span>
              used {prompt.useCount}
              {prompt.lastUsedAt ? `, last ${relativeTime(prompt.lastUsedAt, now)}` : ''}
            </span>
            {prompt.variables.length > 0 ? (
              <>
                <span aria-hidden>·</span>
                <span>{prompt.variables.map((name) => `{{${name}}}`).join(' ')}</span>
              </>
            ) : null}
            {sessions.length > 0 ? (
              <>
                <span aria-hidden>·</span>
                <span>
                  {sessions.length} session{sessions.length === 1 ? '' : 's'}
                </span>
              </>
            ) : null}
            {prompt.tags.map((tag) => (
              <span key={tag}>#{tag}</span>
            ))}
          </p>

          {open ? (
            <p className="mt-2 border-l border-line pl-3 font-mono text-xs leading-6 whitespace-pre-wrap text-muted">
              {segments.map((segment) =>
                segment.variable ? (
                  <span key={segment.id} className="text-gold">{`{{${segment.text}}}`}</span>
                ) : (
                  <span key={segment.id}>{segment.text}</span>
                ),
              )}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              onRun(prompt);
            }}
            className={cn(rowButton, 'border-line text-muted hover:border-gold/40 hover:text-ivory')}
            title="Opens a workspace session against this prompt. The kernel decides whether a turn can run."
          >
            Open a session
          </button>
        </div>
      </div>
    </li>
  );
}

export function PromptsPage() {
  const { dataset, ready } = useSovereign();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const now = useMemo(() => new Date(), []);

  const filter = parsePromptFilter(searchParams.get('intent'));
  const counts = useMemo(() => promptCounts(dataset), [dataset]);
  const rows = useMemo(() => selectPrompts(dataset, filter), [dataset, filter]);

  function openSession(prompt: Prompt) {
    setBusy(true);
    setMessage(null);
    void startAgentSession({
      title: prompt.title,
      intent: prompt.intent,
      promptId: prompt.id,
      providerPreference: prompt.providerPreference,
      requiresApproval: prompt.requiresApproval,
      opening: prompt.body,
    })
      .then((session) => {
        if (session) {
          void navigate('/ai');
        } else {
          setMessage('The session could not be opened.');
        }
      })
      .catch((cause: unknown) => {
        setMessage(cause instanceof Error ? cause.message : 'Opening the session failed.');
      })
      .finally(() => {
        setBusy(false);
      });
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <header className="mb-5">
        <SectionLabel>Cognition</SectionLabel>
        <h1 className="mt-1 font-display text-2xl text-ivory">Prompt Library</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Reusable instructions, browsable and editable with no provider configured at all. Running
          one is the Agent Kernel&apos;s business: the library records what was written and how often
          it was used, never what a model said back.
        </p>

        <dl className="mt-4 flex flex-wrap items-baseline gap-x-8 gap-y-2 border-y border-line py-3">
          <div>
            <dt className="label-caps text-faint">Prompts</dt>
            <dd className="font-mono text-lg text-ivory tabular-nums">{counts.total}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Used at least once</dt>
            <dd className="font-mono text-lg text-muted tabular-nums">{counts.used}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Behind a gate</dt>
            <dd className="font-mono text-lg text-gold tabular-nums">{counts.gated}</dd>
          </div>
        </dl>
      </header>

      <NewPromptForm onDone={setMessage} />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {PROMPT_FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setSearchParams(value === 'all' ? {} : { intent: value });
            }}
            className={cn(
              filterButton,
              filter === value
                ? 'border-gold/60 bg-gold-faint text-ivory'
                : 'border-line text-faint hover:border-gold/40 hover:text-muted',
            )}
          >
            {promptFilterLabel[value]}
          </button>
        ))}
      </div>

      {message ? <p className="mb-2 text-xs text-muted">{message}</p> : null}

      {!ready ? (
        <p className="text-sm text-faint italic">Opening the local store…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-faint italic">
          {counts.total === 0
            ? 'The library is empty. Nothing here is generated, so it stays empty until something is written.'
            : 'No prompt matches this intent.'}
        </p>
      ) : (
        <ul>
          {rows.map((prompt) => (
            <PromptRow key={prompt.id} prompt={prompt} now={now} busy={busy} onRun={openSession} />
          ))}
        </ul>
      )}
    </div>
  );
}
