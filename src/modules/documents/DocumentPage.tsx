import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSovereign } from '@/app/context';
import { companyHref, knowledgeHref, opportunityHref, personHref } from '@/app/href';
import { setDocumentStatus } from '@/data/mutations';
import type { DocumentStatus } from '@/domain';
import { relativeTime } from '@/lib/clock';
import { cn } from '@/lib/cn';
import { DemoBadge, EmptyLine, Panel, SectionLabel, StatePill } from '@/ui/primitives';
import {
  documentBlocks,
  documentKindLabel,
  documentLinks,
  documentStatusLabel,
  documentStatusTone,
  findDocument,
  wordCount,
} from './documents';

const actionButton = 'label-caps border px-2.5 py-1 transition-colors disabled:opacity-40';

/** The moves offered from each state, matching the write path's own table. */
const NEXT_STATUS: Record<DocumentStatus, readonly DocumentStatus[]> = {
  draft: ['final', 'archived'],
  final: ['draft', 'archived'],
  archived: ['draft'],
};

function MissingDocument({ id }: { id: string | undefined }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <SectionLabel>Cognition</SectionLabel>
      <h1 className="mt-1 font-display text-2xl text-ivory">Not in the local store</h1>
      <p className="mt-2 text-sm text-muted">
        No document with id <span className="font-mono text-faint">{id ?? '—'}</span> exists here.
        The record may have been removed with the demo data.
      </p>
      <Link
        to="/documents"
        className="label-caps mt-4 inline-block border border-line px-2.5 py-1 text-muted transition-colors hover:border-gold/40 hover:text-ivory"
      >
        Back to Documents
      </Link>
    </div>
  );
}

export function DocumentPage() {
  const { id } = useParams();
  const { dataset } = useSovereign();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const now = useMemo(() => new Date(), []);

  const document = findDocument(dataset, id);
  const links = useMemo(() => (document ? documentLinks(dataset, document) : null), [dataset, document]);
  const blocks = useMemo(() => (document ? documentBlocks(document.body) : []), [document]);

  if (!document || !links) return <MissingDocument id={id} />;

  function move(status: DocumentStatus) {
    if (!document) return;
    setBusy(true);
    setMessage(null);
    void setDocumentStatus(document.id, status)
      .then((result) => {
        setMessage(
          result.ok
            ? `Marked ${status}. Written to the local store.`
            : (result.reason ?? 'Nothing changed.'),
        );
      })
      .catch((cause: unknown) => {
        setMessage(cause instanceof Error ? cause.message : 'The move failed.');
      })
      .finally(() => {
        setBusy(false);
      });
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <header className="mb-5">
        <div className="flex items-center gap-2">
          <SectionLabel>Documents</SectionLabel>
          <Link to="/documents" className="label-caps text-faint hover:text-muted">
            · all documents
          </Link>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl text-ivory">{document.title}</h1>
          {document.source === 'demo' ? <DemoBadge /> : null}
          <StatePill tone={documentStatusTone(document.status)}>
            {documentStatusLabel[document.status]}
          </StatePill>
          <span className="label-caps text-faint">{documentKindLabel[document.kind]}</span>
        </div>
        {document.summary.length > 0 ? (
          <p className="mt-1 max-w-3xl text-sm text-muted">{document.summary}</p>
        ) : null}

        <p className="mt-2 flex flex-wrap items-baseline gap-x-3 font-mono text-[0.65rem] text-faint">
          <span>{document.author}</span>
          <span aria-hidden>·</span>
          <span>{wordCount(document.body)} words</span>
          <span aria-hidden>·</span>
          <span>touched {relativeTime(document.touchedAt ?? document.updatedAt, now)}</span>
          {document.reviewedAt ? (
            <>
              <span aria-hidden>·</span>
              <span>reviewed {relativeTime(document.reviewedAt, now)}</span>
            </>
          ) : null}
          {document.tags.map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {NEXT_STATUS[document.status].map((status) => (
            <button
              key={status}
              type="button"
              disabled={busy}
              onClick={() => {
                move(status);
              }}
              className={cn(
                actionButton,
                status === 'final'
                  ? 'border-gold/50 text-gold hover:border-gold hover:text-ivory'
                  : 'border-line text-muted hover:border-gold/40 hover:text-ivory',
              )}
            >
              Mark {documentStatusLabel[status].toLowerCase()}
            </button>
          ))}
          {message ? <span className="text-xs text-muted">{message}</span> : null}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel title="Document">
          {blocks.length === 0 ? (
            <EmptyLine>
              This record holds metadata only. The body lives wherever the location says it does.
            </EmptyLine>
          ) : (
            <div className="space-y-2">
              {blocks.map((block) =>
                block.kind === 'heading' ? (
                  <h2 key={block.id} className="font-display text-lg text-ivory">
                    {block.text}
                  </h2>
                ) : block.kind === 'subheading' ? (
                  <h3 key={block.id} className="label-caps pt-1 text-gold/80">
                    {block.text}
                  </h3>
                ) : block.kind === 'list' ? (
                  <p key={block.id} className="flex gap-2 text-sm leading-6 text-muted">
                    <span className="text-faint" aria-hidden>
                      —
                    </span>
                    <span>{block.text}</span>
                  </p>
                ) : (
                  <p key={block.id} className="text-sm leading-6 text-muted">
                    {block.text}
                  </p>
                ),
              )}
            </div>
          )}
          <p className="mt-3 border-t border-line pt-2 text-[0.65rem] leading-4 text-faint">
            Rendered as text nodes. Headings and list markers are the only markdown this surface
            reads; everything else, including any markup in the source, is shown literally.
          </p>
        </Panel>

        <div className="space-y-4">
          <Panel title="Attached to">
            <ul className="space-y-1.5 text-sm">
              {links.company ? (
                <li>
                  <Link to={companyHref(links.company.id)} className="text-muted hover:text-gold">
                    {links.company.name}
                  </Link>
                </li>
              ) : null}
              {links.person ? (
                <li>
                  <Link to={personHref(links.person.id)} className="text-muted hover:text-gold">
                    {links.person.name}
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
              {links.meeting ? (
                <li>
                  <Link to="/meetings?when=all" className="text-muted hover:text-gold">
                    {links.meeting.title}
                  </Link>
                </li>
              ) : null}
              {links.knowledgeNodes.map((node) => (
                <li key={node.id}>
                  <Link to={knowledgeHref(node.id)} className="text-muted hover:text-gold">
                    {node.title}
                  </Link>
                </li>
              ))}
            </ul>
            {!links.company &&
            !links.person &&
            !links.opportunity &&
            !links.project &&
            !links.meeting &&
            links.knowledgeNodes.length === 0 ? (
              <EmptyLine>Nothing in the store points at this document.</EmptyLine>
            ) : null}
          </Panel>

          <Panel title="Where it lives">
            <p className="text-xs leading-5 text-muted">
              {document.location.length > 0
                ? document.location
                : 'Only here. This surface stores the text in IndexedDB and nowhere else.'}
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
