import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSovereign } from '@/app/context';
import { companyHref, opportunityHref } from '@/app/href';
import { setOpportunityStage } from '@/data/mutations';
import type { Opportunity, PipelineStage } from '@/domain';
import { relativeTime } from '@/lib/clock';
import { cn } from '@/lib/cn';
import { formatCurrencyCents } from '@/lib/format';
import { DemoBadge, SectionLabel, StatePill } from '@/ui/primitives';
import {
  PIPELINE_STAGE_FILTERS,
  daysInStage,
  expectedValueCents,
  isStalled,
  nextOpenStage,
  pipelineStageLabel,
  pipelineSummary,
  parseStageFilter,
  selectOpportunities,
  stageBoard,
  stageFilterLabel,
} from './pipeline';

const actionButton = 'label-caps border px-2 py-0.5 transition-colors disabled:opacity-40';

function StageDistribution() {
  const { dataset } = useSovereign();
  const board = useMemo(() => stageBoard(dataset), [dataset]);
  const [, setSearchParams] = useSearchParams();

  return (
    <div className="mb-4 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
      {board.map((column) => (
        <button
          key={column.stage}
          type="button"
          onClick={() => {
            setSearchParams({ stage: column.stage });
          }}
          className="bg-surface/70 px-3 py-2 text-left transition-colors hover:bg-surface-high/60"
        >
          <p className="label-caps truncate text-faint">{column.label}</p>
          <p className="font-mono text-sm text-ivory tabular-nums">{column.count}</p>
          <p className="font-mono text-[0.65rem] text-faint tabular-nums">
            {formatCurrencyCents(column.valueCents)}
          </p>
        </button>
      ))}
    </div>
  );
}

function OpportunityRow({
  opportunity,
  companyName,
  now,
  busy,
  onMove,
}: {
  opportunity: Opportunity;
  companyName: string | undefined;
  now: Date;
  busy: boolean;
  onMove: (opportunity: Opportunity, stage: PipelineStage) => void;
}) {
  const advance = nextOpenStage(opportunity.stage);
  const stalled = isStalled(opportunity, now);
  const days = daysInStage(opportunity, now);

  return (
    <tr className="border-b border-line/60 align-top last:border-b-0">
      <td className="py-2.5 pr-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={opportunityHref(opportunity.id)}
            className="text-sm text-ivory hover:text-gold"
          >
            {opportunity.name}
          </Link>
          {opportunity.source === 'demo' ? <DemoBadge /> : null}
          {stalled ? <StatePill tone="warning">Stalled</StatePill> : null}
        </div>
        <p className="mt-0.5 text-xs text-muted">
          {opportunity.nextStep.length > 0 ? opportunity.nextStep : 'No next step recorded.'}
          {opportunity.nextStepAt ? ` · ${relativeTime(opportunity.nextStepAt, now)}` : ''}
        </p>
      </td>
      <td className="py-2.5 pr-4 whitespace-nowrap">
        {opportunity.companyId !== undefined && companyName !== undefined ? (
          <Link
            to={companyHref(opportunity.companyId)}
            className="text-xs text-muted hover:text-gold"
          >
            {companyName}
          </Link>
        ) : (
          <span className="text-xs text-faint">—</span>
        )}
      </td>
      <td className="py-2.5 pr-4 label-caps whitespace-nowrap text-faint">
        {pipelineStageLabel[opportunity.stage]}
        <span className="ml-1 font-mono normal-case">
          {days === null ? '' : `${String(days)}d`}
        </span>
      </td>
      <td className="py-2.5 pr-4 font-mono text-[0.65rem] whitespace-nowrap text-faint tabular-nums">
        {formatCurrencyCents(opportunity.valueCents)} · {opportunity.probability}%
      </td>
      <td className="py-2.5 pr-4 font-mono text-[0.65rem] whitespace-nowrap text-ivory tabular-nums">
        {formatCurrencyCents(expectedValueCents(opportunity))}
      </td>
      <td className="py-2.5">
        <div className="flex flex-wrap justify-end gap-1.5">
          {advance ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                onMove(opportunity, advance);
              }}
              className={cn(actionButton, 'border-line text-muted hover:border-gold/40 hover:text-ivory')}
            >
              {`To ${pipelineStageLabel[advance]}`}
            </button>
          ) : null}
          {opportunity.stage !== 'won' ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                onMove(opportunity, 'won');
              }}
              className={cn(actionButton, 'border-sentinel/50 text-sentinel hover:border-sentinel hover:text-ivory')}
            >
              Won
            </button>
          ) : null}
          {opportunity.stage !== 'lost' ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                onMove(opportunity, 'lost');
              }}
              className={cn(actionButton, 'border-alert/50 text-alert/90 hover:border-alert hover:text-alert')}
            >
              Lost
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

export function PipelinePage() {
  const { dataset, ready } = useSovereign();
  const [searchParams, setSearchParams] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const now = useMemo(() => new Date(), []);

  const filter = parseStageFilter(searchParams.get('stage'));
  const summary = useMemo(() => pipelineSummary(dataset, now), [dataset, now]);
  const rows = useMemo(() => selectOpportunities(dataset, filter), [dataset, filter]);
  const companyNames = useMemo(
    () => new Map(dataset.companies.map((company) => [company.id, company.name])),
    [dataset.companies],
  );

  function move(opportunity: Opportunity, stage: PipelineStage) {
    setBusy(true);
    setMessage(null);
    void setOpportunityStage(opportunity.id, stage)
      .then((changed) => {
        setMessage(
          changed
            ? `${opportunity.name} moved to ${pipelineStageLabel[stage]}. Written to the local store.`
            : 'Nothing changed.',
        );
      })
      .catch((cause: unknown) => {
        setMessage(cause instanceof Error ? cause.message : 'Stage change failed.');
      })
      .finally(() => {
        setBusy(false);
      });
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <header className="mb-5">
        <SectionLabel>Revenue</SectionLabel>
        <h1 className="mt-1 font-display text-2xl text-ivory">Pipeline</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          One ordered funnel with explicit closed states. Expected value is value × the probability
          written on the record — no model, no forecast. Stage moves persist locally.
        </p>

        <dl className="mt-4 flex flex-wrap items-baseline gap-x-8 gap-y-2 border-y border-line py-3">
          <div>
            <dt className="label-caps text-faint">Open</dt>
            <dd className="font-mono text-lg text-ivory tabular-nums">{summary.openCount}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Open value</dt>
            <dd className="font-mono text-lg text-ivory tabular-nums">
              {formatCurrencyCents(summary.openValueCents)}
            </dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Expected</dt>
            <dd className="font-mono text-lg text-gold tabular-nums">
              {formatCurrencyCents(summary.expectedValueCents)}
            </dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Stalled</dt>
            <dd className="font-mono text-lg text-alert tabular-nums">{summary.stalledCount}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Won / Lost</dt>
            <dd className="font-mono text-lg text-muted tabular-nums">
              {summary.wonCount} / {summary.lostCount}
            </dd>
          </div>
        </dl>
      </header>

      <StageDistribution />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {PIPELINE_STAGE_FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setSearchParams(value === 'open' ? {} : { stage: value });
            }}
            className={cn(
              'label-caps border px-2.5 py-1 transition-colors',
              filter === value
                ? 'border-gold/60 bg-gold-faint text-ivory'
                : 'border-line text-faint hover:border-gold/40 hover:text-muted',
            )}
          >
            {stageFilterLabel[value]}
          </button>
        ))}
        {message ? <p className="ml-auto text-xs text-muted">{message}</p> : null}
      </div>

      {!ready ? (
        <p className="text-sm text-faint italic">Opening the local store…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-faint italic">No opportunities in this stage.</p>
      ) : (
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              <th className="label-caps pb-2 text-faint">Opportunity</th>
              <th className="label-caps pb-2 text-faint">Company</th>
              <th className="label-caps pb-2 text-faint">Stage</th>
              <th className="label-caps pb-2 text-faint">Value</th>
              <th className="label-caps pb-2 text-faint">Expected</th>
              <th className="label-caps pb-2 text-right text-faint">Move</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((opportunity) => (
              <OpportunityRow
                key={opportunity.id}
                opportunity={opportunity}
                companyName={
                  opportunity.companyId === undefined
                    ? undefined
                    : companyNames.get(opportunity.companyId)
                }
                now={now}
                busy={busy}
                onMove={move}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
