import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSovereign } from '@/app/context';
import { decideApproval } from '@/data/mutations';
import type { Approval } from '@/domain';
import { relativeTime } from '@/lib/clock';
import { cn } from '@/lib/cn';
import { DemoBadge, SectionLabel, StatePill } from '@/ui/primitives';
import {
  APPROVAL_FILTERS,
  approvalCounts,
  approvalFilterLabel,
  approvalKindLabel,
  approvalStatusLabel,
  isOverdue,
  parseApprovalFilter,
  riskTone,
  selectApprovals,
} from './queue';

const actionButton =
  'label-caps border px-2.5 py-1 transition-colors disabled:opacity-40';

function DecisionLine({ approval, now }: { approval: Approval; now: Date }) {
  if (approval.status === 'pending') {
    const due = approval.dueAt;
    return (
      <span className={cn(isOverdue(approval, now) ? 'text-alert' : 'text-faint')}>
        {due ? `due ${relativeTime(due, now)}` : 'no due date'}
      </span>
    );
  }
  return (
    <span className="text-faint">
      {approvalStatusLabel[approval.status].toLowerCase()}
      {approval.decidedAt ? ` ${relativeTime(approval.decidedAt, now)}` : ''}
      {approval.decidedBy ? ` by ${approval.decidedBy}` : ''}
    </span>
  );
}

function ApprovalRow({
  approval,
  now,
  busy,
  onDecide,
}: {
  approval: Approval;
  now: Date;
  busy: boolean;
  onDecide: (approval: Approval, status: Approval['status']) => void;
}) {
  const pending = approval.status === 'pending';

  return (
    <li className="border-b border-line/60 py-2.5 last:border-b-0">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className={cn('text-sm', pending ? 'text-ivory' : 'text-muted')}>
              {approval.title}
            </span>
            {approval.source === 'demo' ? <DemoBadge /> : null}
            {pending ? null : (
              <StatePill tone={approval.status === 'approved' ? 'sentinel' : 'muted'}>
                {approvalStatusLabel[approval.status]}
              </StatePill>
            )}
          </div>
          {approval.summary ? (
            <p className="mt-0.5 text-xs leading-5 text-muted">{approval.summary}</p>
          ) : null}
          <p className="mt-0.5 flex flex-wrap gap-x-2 font-mono text-[0.65rem] text-faint">
            <span>{approvalKindLabel[approval.kind]}</span>
            <span aria-hidden>·</span>
            <span>{approval.requestedBy}</span>
            <span aria-hidden>·</span>
            <DecisionLine approval={approval} now={now} />
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          <StatePill tone={riskTone[approval.risk]} title="Risk recorded on the request">
            {approval.risk}
          </StatePill>
          {pending ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  onDecide(approval, 'approved');
                }}
                className={cn(
                  actionButton,
                  'border-sentinel/50 text-sentinel hover:border-sentinel hover:text-ivory',
                )}
              >
                Approve
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  onDecide(approval, 'rejected');
                }}
                className={cn(
                  actionButton,
                  'border-alert/50 text-alert/90 hover:border-alert hover:text-alert',
                )}
              >
                Reject
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                onDecide(approval, 'pending');
              }}
              className={cn(
                actionButton,
                'border-line text-muted hover:border-gold/40 hover:text-ivory',
              )}
            >
              Reopen
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

export function ApprovalsPage() {
  const { dataset, ready } = useSovereign();
  const [searchParams, setSearchParams] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const now = useMemo(() => new Date(), []);

  const filter = parseApprovalFilter(searchParams.get('status'));
  const counts = useMemo(() => approvalCounts(dataset), [dataset]);
  const rows = useMemo(() => selectApprovals(dataset, filter), [dataset, filter]);

  function decide(approval: Approval, status: Approval['status']) {
    setBusy(true);
    setMessage(null);
    void decideApproval(approval.id, status)
      .then((changed) => {
        setMessage(
          changed
            ? `${approvalStatusLabel[status]}: ${approval.title}. Recorded in the local store.`
            : 'Nothing changed.',
        );
      })
      .catch((cause: unknown) => {
        setMessage(cause instanceof Error ? cause.message : 'Decision failed.');
      })
      .finally(() => {
        setBusy(false);
      });
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <header className="mb-5">
        <SectionLabel>Human gate</SectionLabel>
        <h1 className="mt-1 font-display text-2xl text-ivory">Approval Queue</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Nothing customer-facing, irreversible, or credential-bearing proceeds without a decision
          here. Decisions are written to IndexedDB, recorded as activity, and reflected in the
          Morning Brief.
        </p>

        <dl className="mt-4 flex flex-wrap items-baseline gap-x-8 gap-y-2 border-y border-line py-3">
          <div>
            <dt className="label-caps text-faint">Pending</dt>
            <dd className="font-mono text-lg text-ivory tabular-nums">{counts.pending}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Approved</dt>
            <dd className="font-mono text-lg text-sentinel tabular-nums">{counts.approved}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Rejected</dt>
            <dd className="font-mono text-lg text-muted tabular-nums">{counts.rejected}</dd>
          </div>
        </dl>
      </header>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {APPROVAL_FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setSearchParams(value === 'pending' ? {} : { status: value });
            }}
            className={cn(
              actionButton,
              filter === value
                ? 'border-gold/60 bg-gold-faint text-ivory'
                : 'border-line text-faint hover:border-gold/40 hover:text-muted',
            )}
          >
            {approvalFilterLabel[value]}
          </button>
        ))}
        {message ? <p className="ml-auto text-xs text-muted">{message}</p> : null}
      </div>

      {!ready ? (
        <p className="text-sm text-faint italic">Opening the local store…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-faint italic">
          {filter === 'pending' ? 'No gate is waiting on you.' : 'No approvals in this state.'}
        </p>
      ) : (
        <ul>
          {rows.map((approval) => (
            <ApprovalRow
              key={approval.id}
              approval={approval}
              now={now}
              busy={busy}
              onDecide={decide}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
