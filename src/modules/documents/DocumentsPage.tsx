import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSovereign } from '@/app/context';
import { documentHref } from '@/app/href';
import { createDocument } from '@/data/mutations';
import type { SovereignDocument } from '@/domain';
import { relativeTime } from '@/lib/clock';
import { cn } from '@/lib/cn';
import { DemoBadge, SectionLabel, StatePill } from '@/ui/primitives';
import {
  DOCUMENT_KIND_FILTERS,
  DOCUMENT_STATUS_FILTERS,
  documentCounts,
  documentKindFilterLabel,
  documentKindLabel,
  documentLinks,
  documentStatusFilterLabel,
  documentStatusLabel,
  documentStatusTone,
  parseDocumentQuery,
  selectDocuments,
  wordCount,
  type DocumentQuery,
} from './documents';

const filterButton = 'label-caps border px-2.5 py-1 transition-colors disabled:opacity-40';

function NewDocumentForm({ onDone }: { onDone: (message: string) => void }) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  function submit() {
    if (title.trim().length === 0) return;
    setBusy(true);
    void createDocument({ title })
      .then((document) => {
        if (document) {
          setTitle('');
          onDone(`Created "${document.title}" as a draft. The body is written elsewhere.`);
        } else {
          onDone('A document needs a title.');
        }
      })
      .catch((cause: unknown) => {
        onDone(cause instanceof Error ? cause.message : 'Creating the document failed.');
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
      <label className="label-caps text-faint" htmlFor="document-title">
        Start a document
      </label>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <input
          id="document-title"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
          }}
          placeholder="What it is called"
          className="min-w-72 flex-1 border border-line bg-surface/60 px-2 py-1.5 text-sm text-on-surface outline-none placeholder:text-faint focus:border-gold/50"
        />
        <button
          type="submit"
          disabled={busy || title.trim().length === 0}
          className={cn(filterButton, 'border-gold/50 text-gold hover:border-gold hover:text-ivory')}
        >
          Create draft
        </button>
      </div>
    </form>
  );
}

function DocumentRow({ document, now }: { document: SovereignDocument; now: Date }) {
  const { dataset } = useSovereign();
  const links = useMemo(() => documentLinks(dataset, document), [dataset, document]);
  const words = wordCount(document.body);

  return (
    <li className="border-b border-line/60 py-2.5 last:border-b-0">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Link to={documentHref(document.id)} className="text-sm text-ivory hover:text-gold">
              {document.title}
            </Link>
            {document.source === 'demo' ? <DemoBadge /> : null}
            <StatePill tone={documentStatusTone(document.status)}>
              {documentStatusLabel[document.status]}
            </StatePill>
            <span className="label-caps text-faint">{documentKindLabel[document.kind]}</span>
          </div>

          {document.summary.length > 0 ? (
            <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted">{document.summary}</p>
          ) : words === 0 ? (
            <p className="mt-0.5 text-xs leading-5 text-faint italic">
              No body written in this store.
            </p>
          ) : null}

          <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 font-mono text-[0.65rem] text-faint">
            <span>{words} words</span>
            <span aria-hidden>·</span>
            <span>{document.format}</span>
            <span aria-hidden>·</span>
            <span>touched {relativeTime(document.touchedAt ?? document.updatedAt, now)}</span>
            {links.company ? (
              <>
                <span aria-hidden>·</span>
                <span>{links.company.name}</span>
              </>
            ) : null}
            {document.location.length > 0 ? (
              <>
                <span aria-hidden>·</span>
                <span title="Where the original lives. Nothing is uploaded here.">
                  {document.location}
                </span>
              </>
            ) : null}
          </p>
        </div>

        <Link
          to={documentHref(document.id)}
          className={cn(
            'label-caps shrink-0 border border-line px-2 py-0.5 text-faint transition-colors hover:border-gold/40 hover:text-ivory',
          )}
        >
          Read
        </Link>
      </div>
    </li>
  );
}

export function DocumentsPage() {
  const { dataset, ready } = useSovereign();
  const [searchParams, setSearchParams] = useSearchParams();
  const [message, setMessage] = useState<string | null>(null);
  const now = useMemo(() => new Date(), []);

  const query = parseDocumentQuery(searchParams);
  const counts = useMemo(() => documentCounts(dataset), [dataset]);
  const rows = useMemo(() => selectDocuments(dataset, query), [dataset, query]);

  function applyQuery(next: Partial<DocumentQuery>) {
    const merged: DocumentQuery = { ...query, ...next };
    const params = new URLSearchParams();
    if (merged.status !== 'open') params.set('status', merged.status);
    if (merged.kind !== 'all') params.set('kind', merged.kind);
    setSearchParams(params);
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <header className="mb-5">
        <SectionLabel>Cognition</SectionLabel>
        <h1 className="mt-1 font-display text-2xl text-ivory">Documents</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Documents held in the local store and rendered as text — never as markup, so a document
          cannot inject anything into this surface. Nothing is uploaded or hosted; where a document
          also lives elsewhere, the location is recorded as a note.
        </p>

        <dl className="mt-4 flex flex-wrap items-baseline gap-x-8 gap-y-2 border-y border-line py-3">
          <div>
            <dt className="label-caps text-faint">In use</dt>
            <dd className="font-mono text-lg text-ivory tabular-nums">{counts.open}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Drafts</dt>
            <dd className="font-mono text-lg text-gold tabular-nums">{counts.draft}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Final</dt>
            <dd className="font-mono text-lg text-sentinel tabular-nums">{counts.final}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Words held</dt>
            <dd className="font-mono text-lg text-muted tabular-nums">{counts.words}</dd>
          </div>
        </dl>
      </header>

      <NewDocumentForm onDone={setMessage} />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {DOCUMENT_STATUS_FILTERS.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => {
              applyQuery({ status });
            }}
            className={cn(
              filterButton,
              query.status === status
                ? 'border-gold/60 bg-gold-faint text-ivory'
                : 'border-line text-faint hover:border-gold/40 hover:text-muted',
            )}
          >
            {documentStatusFilterLabel[status]}
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {DOCUMENT_KIND_FILTERS.map((kind) => (
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
            {documentKindFilterLabel[kind]}
          </button>
        ))}
      </div>

      {message ? <p className="mb-2 text-xs text-muted">{message}</p> : null}

      {!ready ? (
        <p className="text-sm text-faint italic">Opening the local store…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-faint italic">
          {counts.total === 0
            ? 'The local store holds no documents.'
            : 'No document matches this filter.'}
        </p>
      ) : (
        <ul>
          {rows.map((document) => (
            <DocumentRow key={document.id} document={document} now={now} />
          ))}
        </ul>
      )}
    </div>
  );
}
