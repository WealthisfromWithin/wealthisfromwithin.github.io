import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSovereign } from '@/app/context';
import { normalizeInternalHref } from '@/app/href';
import { archiveAutomationRule, runAutomation, setAutomationEnabled } from '@/data/mutations';
import {
  automationActionLabel,
  automationTriggerHref,
  automationTriggerLabel,
} from '@/domain';
import { relativeTime } from '@/lib/clock';
import { cn } from '@/lib/cn';
import { DemoBadge, EmptyLine, Panel, SectionLabel, StatePill } from '@/ui/primitives';
import {
  automationOutcomeLabel,
  automationOutcomeTone,
  automationRow,
  findAutomation,
  gateFor,
  selectAutomationRuns,
} from './automations';

const button = 'label-caps border px-2.5 py-1 transition-colors disabled:opacity-40';

function MissingRule() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <SectionLabel>Leverage</SectionLabel>
      <h1 className="mt-1 font-display text-2xl text-ivory">Not in the local store</h1>
      <p className="mt-1 text-sm text-muted">
        No automation with that id is in this browser. It may have been archived, or the demo rows
        may have been removed.
      </p>
      <Link
        to="/automations"
        className="label-caps mt-4 inline-block border border-line px-2.5 py-1 text-muted transition-colors hover:border-gold/40 hover:text-ivory"
      >
        Back to automations
      </Link>
    </div>
  );
}

export function AutomationRulePage() {
  const { id } = useParams<{ id: string }>();
  const { dataset, ready } = useSovereign();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const now = useMemo(() => new Date(), []);

  const rule = findAutomation(dataset, id);

  if (!ready && !rule) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-6">
        <p className="text-sm text-faint italic">Opening the local store…</p>
      </div>
    );
  }
  if (!rule) return <MissingRule />;

  const row = automationRow(dataset, rule, now);
  const runs = selectAutomationRuns(dataset, { ruleId: rule.id, limit: 12 });
  const surfaceHref = normalizeInternalHref(automationTriggerHref[rule.trigger], '/');

  function act(work: () => Promise<string>) {
    setBusy(true);
    setMessage(null);
    void work()
      .then(setMessage)
      .catch((cause: unknown) => {
        setMessage(cause instanceof Error ? cause.message : 'The action failed.');
      })
      .finally(() => {
        setBusy(false);
      });
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <header className="mb-5">
        <div className="flex items-center gap-2">
          <SectionLabel>Automation</SectionLabel>
          {rule.source === 'demo' ? <DemoBadge /> : null}
        </div>
        <h1 className="mt-1 font-display text-2xl text-ivory">{rule.name}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          {rule.summary.length > 0 ? rule.summary : 'No summary was recorded for this rule.'}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatePill
            tone={
              row.readiness.runnable ? 'sentinel' : row.readiness.reason === 'disabled' ? 'muted' : 'gold'
            }
            title={row.readiness.statement}
          >
            {row.readiness.runnable
              ? 'Runnable'
              : row.readiness.reason === 'disabled'
                ? 'Off'
                : 'Cannot run'}
          </StatePill>
          {rule.requiresApproval ? <StatePill tone="warning">Gated</StatePill> : null}
          <StatePill tone="muted">{rule.impact} impact</StatePill>
          <span className="font-mono text-[0.65rem] text-faint">
            {rule.lastRunAt ? `last run ${relativeTime(rule.lastRunAt, now)}` : 'never run'} ·{' '}
            {String(rule.runCount)} runs recorded
          </span>
        </div>

        <p className="mt-2 text-xs leading-5 text-muted">{row.readiness.statement}</p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              act(async () => {
                const result = await runAutomation(rule.id);
                const outcome = result.outcome;
                return outcome === undefined
                  ? (result.reason ?? 'The run could not be recorded.')
                  : `${automationOutcomeLabel[outcome]}. ${result.run?.detail ?? ''}`.trim();
              });
            }}
            className={cn(
              button,
              row.readiness.runnable
                ? 'border-sentinel/50 text-sentinel hover:border-sentinel hover:text-ivory'
                : 'border-line text-faint hover:border-gold/40 hover:text-muted',
            )}
          >
            {row.readiness.runnable ? 'Run now' : 'Record the refusal'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              act(async () => {
                const changed = await setAutomationEnabled(rule.id, !rule.enabled);
                if (!changed) return 'Nothing changed.';
                return rule.enabled
                  ? 'Disabled. A run against it is recorded as refused.'
                  : 'Enabled. It evaluates when you run it.';
              });
            }}
            className={cn(button, 'border-line text-muted hover:border-gold/40 hover:text-ivory')}
          >
            {rule.enabled ? 'Disable' : 'Enable'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              act(async () => {
                const changed = await archiveAutomationRule(
                  rule.id,
                  rule.archivedAt === undefined,
                );
                if (!changed) return 'Nothing changed.';
                return rule.archivedAt === undefined
                  ? 'Archived. The rule and its runs stay in the record.'
                  : 'Restored. It is off until you enable it.';
              });
            }}
            className={cn(button, 'border-line text-faint hover:border-gold/40 hover:text-muted')}
          >
            {rule.archivedAt === undefined ? 'Archive' : 'Restore'}
          </button>
          <Link
            to="/automations"
            className={cn(button, 'border-line text-faint hover:border-gold/40 hover:text-muted')}
          >
            All automations
          </Link>
        </div>

        {message ? <p className="mt-2 text-xs text-muted">{message}</p> : null}
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="What it watches">
          <p className="text-sm text-muted">{automationTriggerLabel[rule.trigger]}</p>
          <p className="mt-1 text-xs text-faint">
            {row.readiness.runnable
              ? `${String(row.matches.length)} ${row.matches.length === 1 ? 'record' : 'records'} in the local store match right now. This is a count, not a forecast.`
              : 'The trigger is not evaluated while the rule cannot run.'}
          </p>
          {row.matches.length === 0 ? (
            <EmptyLine>
              {row.readiness.runnable ? 'Nothing matches at the moment.' : 'Not evaluated.'}
            </EmptyLine>
          ) : (
            <ul className="mt-2">
              {row.matches.slice(0, 8).map((match) => (
                <li key={match.id} className="border-b border-line/50 py-1.5 last:border-b-0">
                  <p className="text-sm text-muted">{match.label}</p>
                  <p className="font-mono text-[0.65rem] text-faint">{match.detail}</p>
                </li>
              ))}
            </ul>
          )}
          <Link
            to={surfaceHref}
            className="label-caps mt-3 inline-block border border-line px-2.5 py-1 text-muted transition-colors hover:border-gold/40 hover:text-ivory"
          >
            Open the surface it watches
          </Link>
        </Panel>

        <Panel title="What it does">
          <p className="text-sm text-muted">{automationActionLabel[rule.action]}</p>
          <ul className="mt-2 space-y-1.5 text-xs leading-5 text-faint">
            <li>
              {rule.requiresApproval
                ? 'Gated: the run stops at the Approval Queue, and the effect happens when a human clears it.'
                : 'Not gated: the effect is written to this browser as soon as the run happens.'}
            </li>
            <li>
              {rule.action === 'handoff'
                ? 'A hand-off never runs from this bundle. There is no connector client here, so the run is recorded as refused and nothing is sent.'
                : 'Everything it writes stays in this browser. Nothing is published, sent, or called.'}
            </li>
            <li>
              Runs are operator-invoked. There is no scheduler on this surface, so a rule that is
              never run never does anything.
            </li>
            {rule.notes.length > 0 ? <li className="text-muted">{rule.notes}</li> : null}
          </ul>
        </Panel>

        <Panel className="lg:col-span-2" title={`Run log · ${String(runs.length)} shown`}>
          {runs.length === 0 ? (
            <EmptyLine>This rule has never been run.</EmptyLine>
          ) : (
            <ul>
              {runs.map((run) => {
                const gate = gateFor(dataset, run);
                return (
                  <li key={run.id} className="border-b border-line/50 py-2 last:border-b-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatePill tone={automationOutcomeTone(run.outcome)}>
                        {automationOutcomeLabel[run.outcome]}
                      </StatePill>
                      {run.source === 'demo' ? <DemoBadge /> : null}
                      <span className="ml-auto font-mono text-[0.65rem] text-faint">
                        {relativeTime(run.at, now)} · {String(run.matched)} matched · by{' '}
                        {run.invokedBy}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs leading-5 text-muted">{run.detail}</p>
                    {gate ? (
                      <p className="mt-0.5 font-mono text-[0.65rem] text-faint">
                        gate {gate.status}
                        {gate.decidedAt ? ` ${relativeTime(gate.decidedAt, now)}` : ''} ·{' '}
                        <Link to="/approvals" className="text-gold hover:text-ivory">
                          Approval Queue
                        </Link>
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
