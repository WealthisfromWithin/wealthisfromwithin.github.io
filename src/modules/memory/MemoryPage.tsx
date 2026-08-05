import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSovereign } from '@/app/context';
import { companyHref, decisionHref, knowledgeHref, personHref } from '@/app/href';
import {
  confirmMemoryEntry,
  recallMemoryEntry,
  retireMemoryEntry,
  saveMemoryEntry,
  setMemoryPinned,
} from '@/data/mutations';
import type { MemoryEntry, MemoryKind, MemoryScope } from '@/domain';
import { relativeTime } from '@/lib/clock';
import { cn } from '@/lib/cn';
import { DemoBadge, SectionLabel, StatePill } from '@/ui/primitives';
import {
  MEMORY_KIND_FILTERS,
  MEMORY_STATES,
  isRetired,
  memoryConfidenceLabel,
  memoryCounts,
  memoryKindFilterLabel,
  memoryKindLabel,
  memoryKindTone,
  memoryLinks,
  memoryScopeLabel,
  memoryStateLabel,
  needsReview,
  parseMemoryQuery,
  selectMemoryEntries,
  type MemoryQuery,
} from './memory';

const filterButton = 'label-caps border px-2.5 py-1 transition-colors disabled:opacity-40';
const rowButton = 'label-caps border px-2 py-0.5 transition-colors disabled:opacity-40';

const KINDS: MemoryKind[] = ['fact', 'preference', 'constraint', 'context', 'lesson'];
const SCOPES: MemoryScope[] = ['operator', 'business', 'relationship', 'system'];

function SaveMemoryForm({ onDone }: { onDone: (message: string) => void }) {
  const [statement, setStatement] = useState('');
  const [kind, setKind] = useState<MemoryKind>('fact');
  const [scope, setScope] = useState<MemoryScope>('operator');
  const [busy, setBusy] = useState(false);

  function submit() {
    if (statement.trim().length === 0) return;
    setBusy(true);
    void saveMemoryEntry({ statement, kind, scope })
      .then((entry) => {
        if (entry) {
          setStatement('');
          onDone(`Saved: "${entry.statement}". It survives a reseed and the demo opt-out.`);
        } else {
          onDone('A memory needs something written in it.');
        }
      })
      .catch((cause: unknown) => {
        onDone(cause instanceof Error ? cause.message : 'Saving failed.');
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
      <label className="label-caps text-faint" htmlFor="memory-statement">
        Save a memory
      </label>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <input
          id="memory-statement"
          value={statement}
          onChange={(event) => {
            setStatement(event.target.value);
          }}
          placeholder="Something that stays true after this session"
          className="min-w-72 flex-1 border border-line bg-surface/60 px-2 py-1.5 text-sm text-on-surface outline-none placeholder:text-faint focus:border-gold/50"
        />
        <select
          aria-label="Kind"
          value={kind}
          onChange={(event) => {
            setKind(event.target.value as MemoryKind);
          }}
          className="label-caps border border-line bg-surface/60 px-2 py-1.5 text-muted outline-none focus:border-gold/50"
        >
          {KINDS.map((value) => (
            <option key={value} value={value}>
              {memoryKindLabel[value]}
            </option>
          ))}
        </select>
        <select
          aria-label="Scope"
          value={scope}
          onChange={(event) => {
            setScope(event.target.value as MemoryScope);
          }}
          className="label-caps border border-line bg-surface/60 px-2 py-1.5 text-muted outline-none focus:border-gold/50"
        >
          {SCOPES.map((value) => (
            <option key={value} value={value}>
              {memoryScopeLabel[value]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={busy || statement.trim().length === 0}
          className={cn(filterButton, 'border-gold/50 text-gold hover:border-gold hover:text-ivory')}
        >
          Save memory
        </button>
      </div>
    </form>
  );
}

function MemoryRow({
  entry,
  now,
  busy,
  onAct,
}: {
  entry: MemoryEntry;
  now: Date;
  busy: boolean;
  onAct: (entry: MemoryEntry, action: 'pin' | 'recall' | 'confirm' | 'retire') => void;
}) {
  const { dataset } = useSovereign();
  const links = useMemo(() => memoryLinks(dataset, entry), [dataset, entry]);
  const review = needsReview(entry, now);
  const retired = isRetired(entry);

  return (
    <li className="border-b border-line/60 py-2.5 last:border-b-0">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p className={cn('text-sm', retired ? 'text-faint line-through' : 'text-ivory')}>
              {entry.statement}
            </p>
            {entry.source === 'demo' ? <DemoBadge /> : null}
            <StatePill tone={memoryKindTone(entry.kind)}>{memoryKindLabel[entry.kind]}</StatePill>
            {entry.pinned ? <StatePill tone="gold">Pinned</StatePill> : null}
            {review ? <StatePill tone="warning">Needs review</StatePill> : null}
            {retired ? <StatePill tone="muted">Retired</StatePill> : null}
          </div>

          {entry.detail.length > 0 ? (
            <p className="mt-0.5 text-xs leading-5 text-muted">{entry.detail}</p>
          ) : null}

          <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 font-mono text-[0.65rem] text-faint">
            <span>{memoryScopeLabel[entry.scope]}</span>
            <span aria-hidden>·</span>
            <span title="How this memory was obtained. Not a confidence score.">
              {memoryConfidenceLabel[entry.confidence]}
            </span>
            <span aria-hidden>·</span>
            <span>
              recalled {entry.recallCount}
              {entry.lastRecalledAt ? `, last ${relativeTime(entry.lastRecalledAt, now)}` : ''}
            </span>
            {entry.reviewAt ? (
              <>
                <span aria-hidden>·</span>
                <span className={review ? 'text-gold' : undefined}>
                  review {relativeTime(entry.reviewAt, now)}
                </span>
              </>
            ) : null}
            {links.person ? (
              <>
                <span aria-hidden>·</span>
                <Link to={personHref(links.person.id)} className="hover:text-ivory">
                  {links.person.name}
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
            {links.decision ? (
              <>
                <span aria-hidden>·</span>
                <Link to={decisionHref(links.decision.id)} className="hover:text-ivory">
                  {links.decision.title}
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
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 pt-0.5">
          {review ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                onAct(entry, 'confirm');
              }}
              className={cn(rowButton, 'border-gold/50 text-gold hover:border-gold hover:text-ivory')}
            >
              Still true
            </button>
          ) : (
            <button
              type="button"
              disabled={busy || retired}
              onClick={() => {
                onAct(entry, 'recall');
              }}
              className={cn(rowButton, 'border-line text-muted hover:border-gold/40 hover:text-ivory')}
            >
              Recall
            </button>
          )}
          <button
            type="button"
            disabled={busy || retired}
            onClick={() => {
              onAct(entry, 'pin');
            }}
            className={cn(rowButton, 'border-line text-muted hover:border-gold/40 hover:text-ivory')}
          >
            {entry.pinned ? 'Unpin' : 'Pin'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              onAct(entry, 'retire');
            }}
            className={cn(rowButton, 'border-line text-faint hover:border-gold/40 hover:text-ivory')}
          >
            {retired ? 'Restore' : 'Retire'}
          </button>
        </div>
      </div>
    </li>
  );
}

export function MemoryPage() {
  const { dataset, ready } = useSovereign();
  const [searchParams, setSearchParams] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const now = useMemo(() => new Date(), []);

  const query = parseMemoryQuery(searchParams);
  const counts = useMemo(() => memoryCounts(dataset, now), [dataset, now]);
  const rows = useMemo(() => selectMemoryEntries(dataset, query, now), [dataset, query, now]);

  function applyQuery(next: Partial<MemoryQuery>) {
    const merged: MemoryQuery = { ...query, ...next };
    const params = new URLSearchParams();
    if (merged.state !== 'working') params.set('state', merged.state);
    if (merged.kind !== 'all') params.set('kind', merged.kind);
    setSearchParams(params);
  }

  function act(entry: MemoryEntry, action: 'pin' | 'recall' | 'confirm' | 'retire') {
    setBusy(true);
    setMessage(null);
    const work =
      action === 'pin'
        ? setMemoryPinned(entry.id, !entry.pinned)
        : action === 'recall'
          ? recallMemoryEntry(entry.id)
          : action === 'confirm'
            ? confirmMemoryEntry(entry.id)
            : retireMemoryEntry(entry.id, !isRetired(entry));

    const done =
      action === 'pin'
        ? entry.pinned
          ? 'Unpinned.'
          : 'Pinned to the working set.'
        : action === 'recall'
          ? 'Recall recorded.'
          : action === 'confirm'
            ? 'Re-confirmed. The next review is 90 days out.'
            : isRetired(entry)
              ? 'Restored to the working set.'
              : 'Retired. It stays in the record.';

    void work
      .then((changed) => {
        setMessage(changed ? done : 'Nothing changed.');
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
        <h1 className="mt-1 font-display text-2xl text-ivory">Memory</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Durable facts, preferences, and constraints. Each one records how it was obtained — stated,
          observed, or inferred — rather than a confidence number nobody measured, and a memory past
          its review date is asked about rather than quietly trusted.
        </p>

        <dl className="mt-4 flex flex-wrap items-baseline gap-x-8 gap-y-2 border-y border-line py-3">
          <div>
            <dt className="label-caps text-faint">Working set</dt>
            <dd className="font-mono text-lg text-ivory tabular-nums">{counts.working}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Pinned</dt>
            <dd className="font-mono text-lg text-gold tabular-nums">{counts.pinned}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Needs review</dt>
            <dd className="font-mono text-lg text-alert tabular-nums">{counts.review}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Constraints</dt>
            <dd className="font-mono text-lg text-muted tabular-nums">{counts.constraint}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Retired</dt>
            <dd className="font-mono text-lg text-faint tabular-nums">{counts.retired}</dd>
          </div>
        </dl>
      </header>

      <SaveMemoryForm onDone={setMessage} />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {MEMORY_STATES.map((state) => (
          <button
            key={state}
            type="button"
            onClick={() => {
              applyQuery({ state });
            }}
            className={cn(
              filterButton,
              query.state === state
                ? 'border-gold/60 bg-gold-faint text-ivory'
                : 'border-line text-faint hover:border-gold/40 hover:text-muted',
            )}
          >
            {memoryStateLabel[state]}
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {MEMORY_KIND_FILTERS.map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => {
              applyQuery({ kind });
            }}
            className={cn(
              filterButton,
              query.kind === kind
                ? 'border-gold/60 bg-gold-faint text-ivory'
                : 'border-line text-faint hover:border-gold/40 hover:text-muted',
            )}
          >
            {memoryKindFilterLabel[kind]}
          </button>
        ))}
      </div>

      {message ? <p className="mb-2 text-xs text-muted">{message}</p> : null}

      {!ready ? (
        <p className="text-sm text-faint italic">Opening the local store…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-faint italic">
          {counts.total === 0
            ? 'The local store holds no memories yet.'
            : 'No memory matches this filter.'}
        </p>
      ) : (
        <ul>
          {rows.map((entry) => (
            <MemoryRow key={entry.id} entry={entry} now={now} busy={busy} onAct={act} />
          ))}
        </ul>
      )}
    </div>
  );
}
