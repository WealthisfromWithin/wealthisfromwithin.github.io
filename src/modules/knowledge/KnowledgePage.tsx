import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSovereign } from '@/app/context';
import { knowledgeHref } from '@/app/href';
import { captureKnowledgeNode, setKnowledgePinned } from '@/data/mutations';
import type { KnowledgeNode } from '@/domain';
import { relativeTime } from '@/lib/clock';
import { cn } from '@/lib/cn';
import { DemoBadge, SectionLabel, StatePill } from '@/ui/primitives';
import {
  KNOWLEDGE_KIND_FILTERS,
  KNOWLEDGE_VIEWS,
  isArchived,
  isLinked,
  knowledgeCounts,
  knowledgeKindFilterLabel,
  knowledgeKindLabel,
  knowledgeKindTone,
  knowledgeTags,
  knowledgeViewLabel,
  parseKnowledgeQuery,
  selectKnowledgeNodes,
  type KnowledgeQuery,
} from './knowledge';

const filterButton = 'label-caps border px-2.5 py-1 transition-colors disabled:opacity-40';
const rowButton = 'label-caps border px-2 py-0.5 transition-colors disabled:opacity-40';

function CaptureForm({ onDone }: { onDone: (message: string) => void }) {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);

  function submit() {
    if (title.trim().length === 0) return;
    setBusy(true);
    void captureKnowledgeNode({ title, summary })
      .then((node) => {
        if (node) {
          setTitle('');
          setSummary('');
          onDone(`Captured "${node.title}". Written to the local store as your own record.`);
        } else {
          onDone('A node needs a title.');
        }
      })
      .catch((cause: unknown) => {
        onDone(cause instanceof Error ? cause.message : 'Capture failed.');
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
      <label className="label-caps text-faint" htmlFor="knowledge-title">
        Capture what you learned
      </label>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <input
          id="knowledge-title"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
          }}
          placeholder="The thing that turned out to be true"
          className="min-w-64 flex-1 border border-line bg-surface/60 px-2 py-1.5 text-sm text-on-surface outline-none placeholder:text-faint focus:border-gold/50"
        />
        <input
          id="knowledge-summary"
          aria-label="One-line summary"
          value={summary}
          onChange={(event) => {
            setSummary(event.target.value);
          }}
          placeholder="One line of why it matters"
          className="min-w-64 flex-1 border border-line bg-surface/60 px-2 py-1.5 text-sm text-on-surface outline-none placeholder:text-faint focus:border-gold/50"
        />
        <button
          type="submit"
          disabled={busy || title.trim().length === 0}
          className={cn(filterButton, 'border-gold/50 text-gold hover:border-gold hover:text-ivory')}
        >
          Capture
        </button>
      </div>
    </form>
  );
}

function NodeRow({
  node,
  now,
  busy,
  onPin,
}: {
  node: KnowledgeNode;
  now: Date;
  busy: boolean;
  onPin: (node: KnowledgeNode) => void;
}) {
  return (
    <li className="border-b border-line/60 py-2.5 last:border-b-0">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Link to={knowledgeHref(node.id)} className="text-sm text-ivory hover:text-gold">
              {node.title}
            </Link>
            {node.source === 'demo' ? <DemoBadge /> : null}
            <StatePill tone={knowledgeKindTone(node.kind)}>
              {knowledgeKindLabel[node.kind]}
            </StatePill>
            {node.pinned ? <StatePill tone="gold">Pinned</StatePill> : null}
            {isArchived(node) ? <StatePill tone="muted">Archived</StatePill> : null}
          </div>

          {node.summary.length > 0 ? (
            <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted">{node.summary}</p>
          ) : null}

          <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 font-mono text-[0.65rem] text-faint">
            <span>{node.origin.length > 0 ? node.origin : 'no recorded origin'}</span>
            <span aria-hidden>·</span>
            <span>touched {relativeTime(node.touchedAt ?? node.updatedAt, now)}</span>
            {isLinked(node) ? (
              <>
                <span aria-hidden>·</span>
                <span>linked</span>
              </>
            ) : null}
            {node.tags.map((tag) => (
              <span key={tag} className="flex items-baseline gap-x-2">
                <span aria-hidden>·</span>
                <span>#{tag}</span>
              </span>
            ))}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              onPin(node);
            }}
            className={cn(rowButton, 'border-line text-muted hover:border-gold/40 hover:text-ivory')}
          >
            {node.pinned ? 'Unpin' : 'Pin'}
          </button>
          <Link
            to={knowledgeHref(node.id)}
            className={cn(rowButton, 'border-line text-faint hover:border-gold/40 hover:text-ivory')}
          >
            Open
          </Link>
        </div>
      </div>
    </li>
  );
}

export function KnowledgePage() {
  const { dataset, ready } = useSovereign();
  const [searchParams, setSearchParams] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const now = useMemo(() => new Date(), []);

  const query = parseKnowledgeQuery(searchParams);
  const counts = useMemo(() => knowledgeCounts(dataset), [dataset]);
  const rows = useMemo(() => selectKnowledgeNodes(dataset, query), [dataset, query]);
  const tags = useMemo(() => knowledgeTags(dataset).slice(0, 8), [dataset]);

  function applyQuery(next: Partial<KnowledgeQuery>) {
    const merged: KnowledgeQuery = { ...query, ...next };
    const params = new URLSearchParams();
    if (merged.view !== 'active') params.set('view', merged.view);
    if (merged.kind !== 'all') params.set('kind', merged.kind);
    setSearchParams(params);
  }

  function pin(node: KnowledgeNode) {
    setBusy(true);
    setMessage(null);
    void setKnowledgePinned(node.id, !node.pinned)
      .then((changed) => {
        setMessage(
          changed
            ? `${node.pinned ? 'Unpinned' : 'Pinned'} "${node.title}".`
            : 'Nothing changed.',
        );
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
        <h1 className="mt-1 font-display text-2xl text-ivory">Knowledge</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          What the operation knows, written by a human and linked to the records it is about.
          Nothing here was summarised by a model, and no search on this page is semantic — matching
          is on the words you type.
        </p>

        <dl className="mt-4 flex flex-wrap items-baseline gap-x-8 gap-y-2 border-y border-line py-3">
          <div>
            <dt className="label-caps text-faint">In use</dt>
            <dd className="font-mono text-lg text-ivory tabular-nums">{counts.active}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Pinned</dt>
            <dd className="font-mono text-lg text-gold tabular-nums">{counts.pinned}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Linked to records</dt>
            <dd className="font-mono text-lg text-sentinel tabular-nums">{counts.linked}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Open questions</dt>
            <dd className="font-mono text-lg text-muted tabular-nums">{counts.question}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Related</dt>
            <dd className="font-mono text-sm">
              <Link to="/memory" className="text-muted hover:text-gold">
                Memory
              </Link>
              <span className="mx-1.5 text-faint" aria-hidden>
                ·
              </span>
              <Link to="/documents" className="text-muted hover:text-gold">
                Documents
              </Link>
            </dd>
          </div>
        </dl>
      </header>

      <CaptureForm onDone={setMessage} />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {KNOWLEDGE_VIEWS.map((view) => (
          <button
            key={view}
            type="button"
            onClick={() => {
              applyQuery({ view });
            }}
            className={cn(
              filterButton,
              query.view === view
                ? 'border-gold/60 bg-gold-faint text-ivory'
                : 'border-line text-faint hover:border-gold/40 hover:text-muted',
            )}
          >
            {knowledgeViewLabel[view]}
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {KNOWLEDGE_KIND_FILTERS.map((kind) => (
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
            {knowledgeKindFilterLabel[kind]}
          </button>
        ))}
      </div>

      {tags.length > 0 ? (
        <p className="mb-3 flex flex-wrap items-baseline gap-x-3 font-mono text-[0.65rem] text-faint">
          <span className="label-caps">Tags</span>
          {tags.map((entry) => (
            <span key={entry.tag}>
              #{entry.tag} {entry.count}
            </span>
          ))}
        </p>
      ) : null}

      {message ? <p className="mb-2 text-xs text-muted">{message}</p> : null}

      {!ready ? (
        <p className="text-sm text-faint italic">Opening the local store…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-faint italic">
          {counts.total === 0
            ? 'The local store holds no knowledge yet. Capture the first thing above.'
            : 'No node matches this filter.'}
        </p>
      ) : (
        <ul>
          {rows.map((node) => (
            <NodeRow key={node.id} node={node} now={now} busy={busy} onPin={pin} />
          ))}
        </ul>
      )}
    </div>
  );
}
