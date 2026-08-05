import type { SovereignDataset } from '@/data/dataset';
import type {
  Approval,
  AutomationMatch,
  AutomationOutcome,
  AutomationReadiness,
  AutomationRule,
  AutomationRun,
} from '@/domain';
import { automationReadiness, evaluateAutomation } from '@/domain';

/**
 * Selectors for the Automation Center.
 *
 * The one thing this module must never do is show a rule as capable of something
 * it is not. Every row carries its readiness from the domain, so what the page
 * prints and what `runAutomation` would do come from the same function.
 */

/* ── Vocabulary ─────────────────────────────────────────────────────────── */

export const automationOutcomeLabel: Record<AutomationOutcome, string> = {
  applied: 'Applied',
  gated: 'Waiting on a gate',
  declined: 'Refused at the gate',
  no_match: 'Nothing matched',
  refused: 'Could not run',
};

export type AutomationTone = 'critical' | 'warning' | 'info' | 'neutral' | 'muted' | 'sentinel';

export function automationOutcomeTone(outcome: AutomationOutcome): AutomationTone {
  switch (outcome) {
    case 'applied':
      return 'sentinel';
    case 'gated':
      return 'warning';
    case 'declined':
      return 'muted';
    case 'refused':
      return 'critical';
    default:
      return 'neutral';
  }
}

/* ── Query ──────────────────────────────────────────────────────────────── */

export const AUTOMATION_FILTERS = ['active', 'blocked', 'off', 'all'] as const;
export type AutomationFilter = (typeof AUTOMATION_FILTERS)[number];

export const automationFilterLabel: Record<AutomationFilter, string> = {
  active: 'Runnable',
  blocked: 'Cannot run',
  off: 'Off',
  all: 'All',
};

export function parseAutomationFilter(value: string | null): AutomationFilter {
  return AUTOMATION_FILTERS.find((filter) => filter === value) ?? 'active';
}

/** A rule, what it could do right now, and what it did last time it was asked. */
export interface AutomationRow {
  rule: AutomationRule;
  readiness: AutomationReadiness;
  /** What the trigger matches in the store right now. A count, not a prediction. */
  matches: AutomationMatch[];
  lastRun: AutomationRun | undefined;
  runs: number;
  /** Runs still waiting on a human, which is where a gated rule stops. */
  openGates: number;
}

function runsOf(dataset: SovereignDataset, ruleId: string): AutomationRun[] {
  return dataset.automationRuns
    .filter((run) => run.ruleId === ruleId)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || b.id.localeCompare(a.id));
}

export function automationRow(
  dataset: SovereignDataset,
  rule: AutomationRule,
  now: Date,
): AutomationRow {
  const readiness = automationReadiness(rule, dataset.integrations);
  const runs = runsOf(dataset, rule.id);

  return {
    rule,
    readiness,
    // A rule that cannot run is not asked what it would match: the answer would
    // read like a plan the surface has no way to carry out.
    matches: readiness.runnable ? evaluateAutomation(rule, dataset, now) : [],
    lastRun: runs[0],
    runs: runs.length,
    openGates: runs.filter((run) => run.outcome === 'gated').length,
  };
}

function matchesFilter(row: AutomationRow, filter: AutomationFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'active':
      return row.readiness.runnable;
    case 'blocked':
      return !row.readiness.runnable && row.readiness.reason !== 'disabled';
    case 'off':
      return row.readiness.reason === 'disabled';
  }
}

/**
 * Rules with something to do first, then rules that cannot run, then the ones
 * that are off. Within a group, the rule with the most matches leads: it is the
 * one whose next run would actually change something.
 */
export function selectAutomations(
  dataset: SovereignDataset,
  filter: AutomationFilter = 'active',
  now: Date = new Date(),
): AutomationRow[] {
  const groupRank = (row: AutomationRow): number => {
    if (row.readiness.reason === 'disabled') return 2;
    return row.readiness.runnable ? 0 : 1;
  };

  return dataset.automations
    .map((rule) => automationRow(dataset, rule, now))
    .filter((row) => matchesFilter(row, filter))
    .sort(
      (a, b) =>
        groupRank(a) - groupRank(b) ||
        b.matches.length - a.matches.length ||
        a.rule.name.localeCompare(b.rule.name),
    );
}

export interface AutomationCounts {
  rules: number;
  runnable: number;
  blocked: number;
  off: number;
  /** Local records the enabled rules would act on right now. */
  matches: number;
  runs: number;
  openGates: number;
  refusedRuns: number;
}

export function automationCounts(dataset: SovereignDataset, now: Date): AutomationCounts {
  const rows = selectAutomations(dataset, 'all', now);

  return {
    rules: rows.length,
    runnable: rows.filter((row) => row.readiness.runnable).length,
    blocked: rows.filter((row) => !row.readiness.runnable && row.readiness.reason !== 'disabled')
      .length,
    off: rows.filter((row) => row.readiness.reason === 'disabled').length,
    matches: rows.reduce((total, row) => total + row.matches.length, 0),
    runs: dataset.automationRuns.length,
    openGates: dataset.automationRuns.filter((run) => run.outcome === 'gated').length,
    refusedRuns: dataset.automationRuns.filter((run) => run.outcome === 'refused').length,
  };
}

export function findAutomation(
  dataset: SovereignDataset,
  id: string | undefined,
): AutomationRule | undefined {
  if (id === undefined) return undefined;
  return dataset.automations.find((rule) => rule.id === id);
}

/** The run log, newest first. Optionally for one rule. */
export function selectAutomationRuns(
  dataset: SovereignDataset,
  options: { ruleId?: string; limit?: number } = {},
): AutomationRun[] {
  const runs =
    options.ruleId === undefined
      ? [...dataset.automationRuns].sort(
          (a, b) => Date.parse(b.at) - Date.parse(a.at) || b.id.localeCompare(a.id),
        )
      : runsOf(dataset, options.ruleId);
  return options.limit === undefined ? runs : runs.slice(0, options.limit);
}

/** The gate a run is waiting on, when it opened one and nobody has decided it. */
export function gateFor(dataset: SovereignDataset, run: AutomationRun): Approval | undefined {
  if (run.approvalId === undefined) return undefined;
  return dataset.approvals.find((approval) => approval.id === run.approvalId);
}

export function ruleNames(dataset: SovereignDataset): Map<string, string> {
  return new Map(dataset.automations.map((rule) => [rule.id, rule.name]));
}

/**
 * Rules whose most recent run could not run at all. The Brief counts these as
 * one aggregate line: a fabric that silently stops is worse than one that says
 * it stopped.
 */
export function automationsThatCannotRun(dataset: SovereignDataset, now: Date): AutomationRow[] {
  return selectAutomations(dataset, 'blocked', now);
}
