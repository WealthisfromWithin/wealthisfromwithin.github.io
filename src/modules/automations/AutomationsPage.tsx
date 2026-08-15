import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSovereign } from '@/app/context';
import { automationHref, normalizeInternalHref } from '@/app/href';
import {
  createAutomationRule,
  runAutomation,
  runEnabledAutomations,
  setAutomationEnabled,
} from '@/data/mutations';
import {
  automationActionLabel,
  automationActionSchema,
  automationTriggerLabel,
  automationTriggerSchema,
  type AutomationAction,
  type AutomationTrigger,
} from '@/domain';
import { relativeTime } from '@/lib/clock';
import { cn } from '@/lib/cn';
import { DemoBadge, Panel, SectionLabel, StatePill } from '@/ui/primitives';
import {
  AUTOMATION_FILTERS,
  automationCounts,
  automationFilterLabel,
  automationOutcomeLabel,
  automationOutcomeTone,
  parseAutomationFilter,
  ruleNames,
  selectAutomationRuns,
  selectAutomations,
  type AutomationRow,
} from './automations';

const button = 'label-caps border px-2.5 py-1 transition-colors disabled:opacity-40';
const field =
  'border border-line bg-surface/60 px-2 py-1.5 text-sm text-on-surface outline-none placeholder:text-faint focus:border-gold/50';

function NewRuleForm({ onDone }: { onDone: (message: string) => void }) {
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState<AutomationTrigger>('task_overdue');
  const [action, setAction] = useState<AutomationAction>('notify');
  const [busy, setBusy] = useState(false);

  function submit() {
    if (name.trim().length === 0) return;
    setBusy(true);
    void createAutomationRule({ name, trigger, action })
      .then((rule) => {
        if (rule) {
          setName('');
          onDone(
            `Defined "${rule.name}". It is enabled and gated, and it runs only when you ask it to.`,
          );
        } else {
          onDone('A rule needs a name.');
        }
      })
      .catch((cause: unknown) => {
        onDone(cause instanceof Error ? cause.message : 'Defining the rule failed.');
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
      <label className="label-caps text-faint" htmlFor="automation-name">
        Define a rule
      </label>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <input
          id="automation-name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
          }}
          placeholder="What the rule is for"
          className={cn(field, 'min-w-56 flex-1')}
        />
        <select
          aria-label="What it watches"
          value={trigger}
          onChange={(event) => {
            setTrigger(event.target.value as AutomationTrigger);
          }}
          className={field}
        >
          {automationTriggerSchema.options.map((value) => (
            <option key={value} value={value}>
              {automationTriggerLabel[value]}
            </option>
          ))}
        </select>
        <select
          aria-label="What it does"
          value={action}
          onChange={(event) => {
            setAction(event.target.value as AutomationAction);
          }}
          className={field}
        >
          {automationActionSchema.options.map((value) => (
            <option key={value} value={value}>
              {automationActionLabel[value]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={busy || name.trim().length === 0}
          className={cn(button, 'border-gold/50 text-gold hover:border-gold hover:text-ivory')}
        >
          New rule
        </button>
      </div>
      <p className="mt-1.5 text-xs text-faint">
        New rules are gated by default: the run stops at the Approval Queue before anything is
        written. A hand-off to an external system is recorded as an intention and always refuses —
        this bundle has no connector runtime.
      </p>
    </form>
  );
}

function RuleRow({
  row,
  now,
  busy,
  onRun,
  onToggle,
}: {
  row: AutomationRow;
  now: Date;
  busy: boolean;
  onRun: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
}) {
  const { rule, readiness, matches, lastRun } = row;

  return (
    <li className="border-b border-line/60 py-2.5 last:border-b-0">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Link to={automationHref(rule.id)} className="text-sm text-ivory hover:text-gold">
              {rule.name}
            </Link>
            {rule.source === 'demo' ? <DemoBadge /> : null}
            <StatePill
              tone={readiness.runnable ? 'sentinel' : readiness.reason === 'disabled' ? 'muted' : 'gold'}
              title={readiness.statement}
            >
              {readiness.runnable
                ? 'Runnable'
                : readiness.reason === 'disabled'
                  ? 'Off'
                  : 'Cannot run'}
            </StatePill>
            {rule.requiresApproval ? (
              <StatePill tone="warning" title="Runs stop at the Approval Queue before writing.">
                Gated
              </StatePill>
            ) : null}
            {lastRun ? (
              <StatePill tone={automationOutcomeTone(lastRun.outcome)}>
                {automationOutcomeLabel[lastRun.outcome]}
              </StatePill>
            ) : null}
          </div>

          <p className="mt-0.5 text-xs leading-5 text-muted">
            {rule.summary.length > 0 ? rule.summary : readiness.statement}
          </p>

          <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 font-mono text-[0.65rem] text-faint">
            <span>{automationTriggerLabel[rule.trigger].toLowerCase()}</span>
            <span aria-hidden>·</span>
            <span>{automationActionLabel[rule.action].toLowerCase()}</span>
            <span aria-hidden>·</span>
            <span className={matches.length > 0 ? 'text-gold' : undefined}>
              {readiness.runnable
                ? `${String(matches.length)} matching now`
                : 'not evaluated while it cannot run'}
            </span>
            <span aria-hidden>·</span>
            <span>
              {lastRun ? `last run ${relativeTime(lastRun.at, now)}` : 'never run'}
              {rule.runCount > 0 ? ` · ${String(rule.runCount)} runs` : ''}
            </span>
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              onRun(rule.id);
            }}
            className={cn(
              button,
              readiness.runnable
                ? 'border-sentinel/50 text-sentinel hover:border-sentinel hover:text-ivory'
                : 'border-line text-faint hover:border-gold/40 hover:text-muted',
            )}
          >
            {readiness.runnable ? 'Run now' : 'Record the refusal'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              onToggle(rule.id, !rule.enabled);
            }}
            className={cn(button, 'border-line text-muted hover:border-gold/40 hover:text-ivory')}
          >
            {rule.enabled ? 'Disable' : 'Enable'}
          </button>
        </div>
      </div>
    </li>
  );
}

function RunLog({ limit }: { limit: number }) {
  const { dataset } = useSovereign();
  const now = useMemo(() => new Date(), []);
  const names = useMemo(() => ruleNames(dataset), [dataset]);
  const runs = useMemo(() => selectAutomationRuns(dataset, { limit }), [dataset, limit]);

  return (
    <Panel title={`Run log · ${String(dataset.automationRuns.length)} recorded`}>
      <p className="mb-2 text-xs text-muted">
        Every run is recorded, including the ones that did nothing. A rule that matched nothing is
        logged as matching nothing, and a rule that could not run is logged as refusing.
      </p>
      {runs.length === 0 ? (
        <p className="text-sm text-faint italic">No automation has run yet.</p>
      ) : (
        <ul>
          {runs.map((run) => (
            <li key={run.id} className="border-b border-line/50 py-2 last:border-b-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted">{names.get(run.ruleId) ?? run.ruleId}</span>
                {run.source === 'demo' ? <DemoBadge /> : null}
                <StatePill tone={automationOutcomeTone(run.outcome)}>
                  {automationOutcomeLabel[run.outcome]}
                </StatePill>
                <span className="ml-auto font-mono text-[0.65rem] text-faint">
                  {relativeTime(run.at, now)} · {String(run.matched)} matched · by {run.invokedBy}
                </span>
              </div>
              <p className="mt-0.5 text-xs leading-5 text-faint">{run.detail}</p>
              {run.outcome === 'gated' ? (
                <Link
                  to="/approvals"
                  className="label-caps mt-1 inline-block border border-line px-2 py-0.5 text-muted transition-colors hover:border-gold/40 hover:text-ivory"
                >
                  Open the gate
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function AutomationsPage() {
  const { dataset, ready } = useSovereign();
  const [searchParams, setSearchParams] = useSearchParams();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const now = useMemo(() => new Date(), []);

  const filter = parseAutomationFilter(searchParams.get('state'));
  const counts = useMemo(() => automationCounts(dataset, now), [dataset, now]);
  const rows = useMemo(() => selectAutomations(dataset, filter, now), [dataset, filter, now]);

  function run(id: string) {
    setBusy(true);
    setMessage(null);
    void runAutomation(id)
      .then((result) => {
        const outcome = result.outcome;
        setMessage(
          outcome === undefined
            ? (result.reason ?? 'The run could not be recorded.')
            : `${automationOutcomeLabel[outcome]}. ${result.run?.detail ?? ''}`.trim(),
        );
      })
      .catch((cause: unknown) => {
        setMessage(cause instanceof Error ? cause.message : 'The run failed.');
      })
      .finally(() => {
        setBusy(false);
      });
  }

  function runAll() {
    setBusy(true);
    setMessage(null);
    void runEnabledAutomations()
      .then((results) => {
        const applied = results.filter((result) => result.outcome === 'applied').length;
        const gated = results.filter((result) => result.outcome === 'gated').length;
        const refused = results.filter((result) => result.outcome === 'refused').length;
        const empty = results.filter((result) => result.outcome === 'no_match').length;
        setMessage(
          `${String(results.length)} rules run: ${String(applied)} applied, ${String(gated)} waiting on a gate, ${String(empty)} matched nothing, ${String(refused)} could not run.`,
        );
      })
      .catch((cause: unknown) => {
        setMessage(cause instanceof Error ? cause.message : 'The pass failed.');
      })
      .finally(() => {
        setBusy(false);
      });
  }

  function toggle(id: string, enabled: boolean) {
    setBusy(true);
    void setAutomationEnabled(id, enabled)
      .then((changed) => {
        setMessage(
          changed
            ? enabled
              ? 'Enabled. It evaluates when you run it; nothing here runs on a timer.'
              : 'Disabled. A run against it is recorded as refused.'
            : 'Nothing changed.',
        );
      })
      .catch((cause: unknown) => {
        setMessage(cause instanceof Error ? cause.message : 'The change failed.');
      })
      .finally(() => {
        setBusy(false);
      });
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <header className="mb-5">
        <SectionLabel>Leverage</SectionLabel>
        <h1 className="mt-1 font-display text-2xl text-ivory">Automations</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Local rules over the local store. Each one can write a signal to the inbox, open a gate in
          the Approval Queue, or record that it ran — and nothing else. No rule can publish, send, or
          call an external system, and none of them runs on a schedule: this surface has no
          scheduler, so a run happens when you ask for one.
        </p>

        <dl className="mt-4 flex flex-wrap items-baseline gap-x-8 gap-y-2 border-y border-line py-3">
          <div>
            <dt className="label-caps text-faint">Runnable</dt>
            <dd className="font-mono text-lg text-sentinel tabular-nums">{counts.runnable}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Cannot run</dt>
            <dd className="font-mono text-lg text-gold tabular-nums">{counts.blocked}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Off</dt>
            <dd className="font-mono text-lg text-muted tabular-nums">{counts.off}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Matching now</dt>
            <dd className="font-mono text-lg text-ivory tabular-nums">{counts.matches}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Open gates</dt>
            <dd className="font-mono text-lg text-gold tabular-nums">{counts.openGates}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Runs recorded</dt>
            <dd className="font-mono text-lg text-muted tabular-nums">{counts.runs}</dd>
          </div>
        </dl>
      </header>

      <NewRuleForm onDone={setMessage} />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {AUTOMATION_FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setSearchParams(value === 'active' ? {} : { state: value });
            }}
            className={cn(
              button,
              filter === value
                ? 'border-gold/60 bg-gold-faint text-ivory'
                : 'border-line text-faint hover:border-gold/40 hover:text-muted',
            )}
          >
            {automationFilterLabel[value]}
          </button>
        ))}
        <button
          type="button"
          disabled={busy || counts.runnable === 0}
          onClick={runAll}
          className={cn(
            button,
            'ml-auto border-sentinel/50 text-sentinel hover:border-sentinel hover:text-ivory',
          )}
        >
          Run every enabled rule
        </button>
      </div>

      {message ? <p className="mb-2 text-xs text-muted">{message}</p> : null}

      {!ready ? (
        <p className="text-sm text-faint italic">Opening the local store…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-faint italic">
          {counts.rules === 0
            ? 'No automation is defined yet.'
            : 'No rule matches this filter.'}
        </p>
      ) : (
        <ul className="mb-5">
          {rows.map((row) => (
            <RuleRow
              key={row.rule.id}
              row={row}
              now={now}
              busy={busy}
              onRun={run}
              onToggle={toggle}
            />
          ))}
        </ul>
      )}

      <div className="grid grid-cols-1 gap-4">
        <RunLog limit={8} />
        <Panel title="What an automation cannot do here">
          <ul className="space-y-1.5 text-xs leading-5 text-muted">
            <li>
              Publish, post, or send anything. Those need a credential a static bundle cannot hold,
              so the action does not exist in the domain.
            </li>
            <li>
              Run on a timer. Nothing wakes up in this surface; a rule evaluates when the operator
              asks, and the run log records who asked.
            </li>
            <li>
              Write a signal past a gate. A gated rule stops at the Approval Queue, and the signal is
              written when — and only when — a human clears it.{' '}
              <Link
                to={normalizeInternalHref('/approvals?status=pending', '/approvals')}
                className="text-gold hover:text-ivory"
              >
                Open the queue
              </Link>
              .
            </li>
            <li>
              Reach n8n or any other connector. A hand-off rule records the intention and refuses,
              naming the integration that would have to carry it.
            </li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
