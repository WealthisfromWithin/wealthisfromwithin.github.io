import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSovereign } from '@/app/context';
import {
  companyHref,
  contentHref,
  decisionHref,
  documentHref,
  knowledgeHref,
  opportunityHref,
  personHref,
} from '@/app/href';
import { archiveKnowledgeNode, reviewKnowledgeNode, setKnowledgePinned } from '@/data/mutations';
import { relativeTime } from '@/lib/clock';
import { cn } from '@/lib/cn';
import { DemoBadge, EmptyLine, Panel, SectionLabel, StatePill } from '@/ui/primitives';
import { documentBlocks } from '@/modules/documents/documents';
import { decisionStatusLabel } from '@/modules/decisions/decisions';
import { memoryKindLabel } from '@/modules/memory/memory';
import { researchStatusLabel } from '@/modules/research/research';
import {
  findKnowledgeNode,
  isArchived,
  knowledgeKindLabel,
  knowledgeKindTone,
  knowledgeLinks,
} from './knowledge';

const actionButton = 'label-caps border px-2.5 py-1 transition-colors disabled:opacity-40';

function MissingNode({ id }: { id: string | undefined }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <SectionLabel>Cognition</SectionLabel>
      <h1 className="mt-1 font-display text-2xl text-ivory">Not in the local store</h1>
      <p className="mt-2 text-sm text-muted">
        No knowledge node with id <span className="font-mono text-faint">{id ?? '—'}</span> exists
        here. The record may have been removed with the demo data.
      </p>
      <Link
        to="/knowledge"
        className="label-caps mt-4 inline-block border border-line px-2.5 py-1 text-muted transition-colors hover:border-gold/40 hover:text-ivory"
      >
        Back to Knowledge
      </Link>
    </div>
  );
}

export function KnowledgeNodePage() {
  const { id } = useParams();
  const { dataset } = useSovereign();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const now = useMemo(() => new Date(), []);

  const node = findKnowledgeNode(dataset, id);
  const links = useMemo(() => (node ? knowledgeLinks(dataset, node) : null), [dataset, node]);
  const blocks = useMemo(() => (node ? documentBlocks(node.body) : []), [node]);

  if (!node || !links) return <MissingNode id={id} />;

  function run(work: () => Promise<boolean>, done: string) {
    setBusy(true);
    setMessage(null);
    void work()
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

  const archived = isArchived(node);

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <header className="mb-5">
        <div className="flex items-center gap-2">
          <SectionLabel>Knowledge</SectionLabel>
          <Link to="/knowledge" className="label-caps text-faint hover:text-muted">
            · all nodes
          </Link>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl text-ivory">{node.title}</h1>
          {node.source === 'demo' ? <DemoBadge /> : null}
          <StatePill tone={knowledgeKindTone(node.kind)}>{knowledgeKindLabel[node.kind]}</StatePill>
          {node.pinned ? <StatePill tone="gold">Pinned</StatePill> : null}
          {archived ? <StatePill tone="muted">Archived</StatePill> : null}
        </div>
        {node.summary.length > 0 ? (
          <p className="mt-1 max-w-3xl text-sm text-muted">{node.summary}</p>
        ) : null}

        <p className="mt-2 flex flex-wrap items-baseline gap-x-3 font-mono text-[0.65rem] text-faint">
          <span>{node.origin.length > 0 ? node.origin : 'no recorded origin'}</span>
          <span aria-hidden>·</span>
          <span>touched {relativeTime(node.touchedAt ?? node.updatedAt, now)}</span>
          <span aria-hidden>·</span>
          <span>
            {node.reviewedAt ? `reviewed ${relativeTime(node.reviewedAt, now)}` : 'never reviewed'}
          </span>
          {node.tags.map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              run(
                () => setKnowledgePinned(node.id, !node.pinned),
                node.pinned ? 'Unpinned.' : 'Pinned to the top of the list.',
              );
            }}
            className={cn(actionButton, 'border-line text-muted hover:border-gold/40 hover:text-ivory')}
          >
            {node.pinned ? 'Unpin' : 'Pin'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              run(() => reviewKnowledgeNode(node.id), 'Marked as read and still true.');
            }}
            className={cn(actionButton, 'border-line text-muted hover:border-gold/40 hover:text-ivory')}
          >
            Still true
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              run(
                () => archiveKnowledgeNode(node.id, !archived),
                archived ? 'Restored to the working set.' : 'Archived. It stays in the record.',
              );
            }}
            className={cn(actionButton, 'border-line text-faint hover:border-gold/40 hover:text-ivory')}
          >
            {archived ? 'Restore' : 'Archive'}
          </button>
          {message ? <span className="text-xs text-muted">{message}</span> : null}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel title="What is known">
          {blocks.length === 0 ? (
            <EmptyLine>Nothing is written in the body of this node.</EmptyLine>
          ) : (
            <div className="space-y-2">
              {blocks.map((block) =>
                block.kind === 'heading' ? (
                  <h2 key={block.id} className="font-display text-base text-ivory">
                    {block.text}
                  </h2>
                ) : block.kind === 'subheading' ? (
                  <h3 key={block.id} className="label-caps text-gold/80">
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
        </Panel>

        <div className="space-y-4">
          <Panel title="What it is about">
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
              {links.meeting ? (
                <li>
                  <Link to="/meetings?when=all" className="text-muted hover:text-gold">
                    {links.meeting.title}
                  </Link>
                </li>
              ) : null}
              {links.documents.map((document) => (
                <li key={document.id}>
                  <Link to={documentHref(document.id)} className="text-muted hover:text-gold">
                    {document.title}
                  </Link>
                </li>
              ))}
              {links.related.map((related) => (
                <li key={related.id}>
                  <Link to={knowledgeHref(related.id)} className="text-muted hover:text-gold">
                    {related.title}
                  </Link>
                </li>
              ))}
            </ul>
            {links.people.length === 0 &&
            links.documents.length === 0 &&
            links.related.length === 0 &&
            !links.company &&
            !links.opportunity &&
            !links.contentItem &&
            !links.meeting ? (
              <EmptyLine>This node stands alone. Nothing in the store links to it.</EmptyLine>
            ) : null}
          </Panel>

          <Panel title="What it produced">
            {links.memories.length === 0 &&
            links.decisions.length === 0 &&
            links.research.length === 0 ? (
              <EmptyLine>No memory, decision, or question points back at this node.</EmptyLine>
            ) : (
              <ul className="space-y-1.5 text-xs">
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
                {links.decisions.map((decision) => (
                  <li key={decision.id} className="flex items-baseline gap-2">
                    <span className="label-caps shrink-0 text-faint">
                      {decisionStatusLabel[decision.status]}
                    </span>
                    <Link to={decisionHref(decision.id)} className="text-muted hover:text-gold">
                      {decision.title}
                    </Link>
                  </li>
                ))}
                {links.research.map((item) => (
                  <li key={item.id} className="flex items-baseline gap-2">
                    <span className="label-caps shrink-0 text-faint">
                      {researchStatusLabel[item.status]}
                    </span>
                    <Link to="/research?status=all" className="text-muted hover:text-gold">
                      {item.question}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
