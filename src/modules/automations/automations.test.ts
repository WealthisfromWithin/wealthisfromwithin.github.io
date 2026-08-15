import { describe, expect, it } from 'vitest';
import { buildDemoDataset } from '@/data/seed';
import type { SovereignDataset } from '@/data/dataset';
import {
  AUTOMATION_FILTERS,
  automationCounts,
  automationOutcomeLabel,
  automationOutcomeTone,
  automationRow,
  automationsThatCannotRun,
  findAutomation,
  gateFor,
  parseAutomationFilter,
  ruleNames,
  selectAutomationRuns,
  selectAutomations,
} from './automations';

const NOW = new Date('2026-08-05T09:00:00.000Z');
const dataset: SovereignDataset = buildDemoDataset(NOW);

const UNGATED_NOTIFY = 'aut-overdue-tasks';
const HANDOFF = 'aut-publish-fanout';
const DISABLED = 'aut-research-due';

describe('automation filters', () => {
  it('defaults to the runnable rules and refuses an unknown filter', () => {
    expect(parseAutomationFilter(null)).toBe('active');
    expect(parseAutomationFilter('nonsense')).toBe('active');
    expect(parseAutomationFilter('blocked')).toBe('blocked');
  });

  it('labels every filter it offers', () => {
    for (const filter of AUTOMATION_FILTERS) {
      expect(parseAutomationFilter(filter)).toBe(filter);
    }
  });

  it('separates a rule that is off from a rule that cannot run', () => {
    const off = selectAutomations(dataset, 'off', NOW).map((row) => row.rule.id);
    const blocked = selectAutomations(dataset, 'blocked', NOW).map((row) => row.rule.id);

    expect(off).toContain(DISABLED);
    expect(blocked).toContain(HANDOFF);
    expect(blocked).not.toContain(DISABLED);
    expect(off).not.toContain(HANDOFF);
  });

  it('puts every rule under All exactly once', () => {
    const all = selectAutomations(dataset, 'all', NOW);
    expect(all).toHaveLength(dataset.automations.length);
    expect(new Set(all.map((row) => row.rule.id)).size).toBe(all.length);
  });
});

describe('automation rows', () => {
  it('counts what a runnable rule matches right now', () => {
    const row = automationRow(dataset, findAutomation(dataset, UNGATED_NOTIFY)!, NOW);
    expect(row.readiness.runnable).toBe(true);
    expect(row.matches.length).toBeGreaterThan(0);
  });

  it('does not evaluate a rule it has already said cannot run', () => {
    const handoff = automationRow(dataset, findAutomation(dataset, HANDOFF)!, NOW);
    const disabled = automationRow(dataset, findAutomation(dataset, DISABLED)!, NOW);

    expect({ runnable: handoff.readiness.runnable, matches: handoff.matches }).toEqual({
      runnable: false,
      matches: [],
    });
    expect(disabled.matches).toEqual([]);
  });

  it('carries the same readiness the write path would use', () => {
    const row = automationRow(dataset, findAutomation(dataset, HANDOFF)!, NOW);
    expect(row.readiness.reason).toBe('awaiting_credentials');
    expect(row.readiness.statement).toContain('no connector runtime');
  });

  it('reads the run history newest first, and counts the open gates', () => {
    const row = automationRow(dataset, findAutomation(dataset, 'aut-content-today')!, NOW);
    expect(row.lastRun?.id).toBe('run-content-today');
    expect(row.openGates).toBe(1);
  });

  it('leads with the rules that have something to do', () => {
    const rows = selectAutomations(dataset, 'all', NOW);
    const firstBlocked = rows.findIndex((row) => !row.readiness.runnable);
    const firstOff = rows.findIndex((row) => row.readiness.reason === 'disabled');

    expect(rows[0]?.readiness.runnable).toBe(true);
    expect(firstBlocked).toBeGreaterThan(0);
    expect(firstOff).toBeGreaterThan(firstBlocked);
    // Within the runnable group, the rule with the most matches leads.
    const runnable = rows.filter((row) => row.readiness.runnable);
    for (let index = 1; index < runnable.length; index += 1) {
      expect(runnable[index - 1]!.matches.length >= runnable[index]!.matches.length).toBe(true);
    }
  });
});

describe('automation counts', () => {
  it('adds up to the rule list and never double-counts a group', () => {
    const counts = automationCounts(dataset, NOW);
    expect(counts.rules).toBe(dataset.automations.length);
    expect(counts.runnable + counts.blocked + counts.off).toBe(counts.rules);
  });

  it('counts runs, open gates, and refusals from the log rather than the rules', () => {
    const counts = automationCounts(dataset, NOW);
    expect(counts.runs).toBe(dataset.automationRuns.length);
    expect(counts.openGates).toBe(
      dataset.automationRuns.filter((run) => run.outcome === 'gated').length,
    );
    expect(counts.refusedRuns).toBeGreaterThan(0);
  });
});

describe('the run log', () => {
  it('reads newest first across every rule', () => {
    const runs = selectAutomationRuns(dataset);
    expect(runs).toHaveLength(dataset.automationRuns.length);
    for (let index = 1; index < runs.length; index += 1) {
      expect(Date.parse(runs[index - 1]!.at) >= Date.parse(runs[index]!.at)).toBe(true);
    }
  });

  it('narrows to one rule and honours a limit', () => {
    const runs = selectAutomationRuns(dataset, { ruleId: UNGATED_NOTIFY });
    expect(runs.every((run) => run.ruleId === UNGATED_NOTIFY)).toBe(true);
    expect(selectAutomationRuns(dataset, { limit: 2 })).toHaveLength(2);
  });

  it('finds the gate a gated run is waiting on, and none for a run that opened none', () => {
    const gated = dataset.automationRuns.find((run) => run.outcome === 'gated');
    expect(gateFor(dataset, gated!)?.status).toBe('pending');

    const applied = dataset.automationRuns.find((run) => run.approvalId === undefined);
    expect(gateFor(dataset, applied!)).toBeUndefined();
  });

  it('names every rule a run points at, so the log never prints a bare id', () => {
    const names = ruleNames(dataset);
    for (const run of dataset.automationRuns) {
      expect({ run: run.id, named: names.has(run.ruleId) }).toEqual({ run: run.id, named: true });
    }
  });

  it('labels and tones every outcome, including the two that did nothing', () => {
    for (const outcome of ['applied', 'gated', 'declined', 'no_match', 'refused'] as const) {
      expect(automationOutcomeLabel[outcome].length).toBeGreaterThan(0);
      expect(automationOutcomeTone(outcome).length).toBeGreaterThan(0);
    }
    expect(automationOutcomeLabel.refused).toBe('Could not run');
    expect(automationOutcomeTone('refused')).toBe('critical');
  });
});

describe('the Brief hook', () => {
  it('reports the rules that cannot run, so a silent fabric is visible', () => {
    const rows = automationsThatCannotRun(dataset, NOW);
    expect(rows.map((row) => row.rule.id)).toContain(HANDOFF);
    expect(rows.every((row) => row.readiness.reason !== 'disabled')).toBe(true);
  });

  it('reports nothing when there are no rules at all', () => {
    const empty: SovereignDataset = { ...dataset, automations: [], automationRuns: [] };
    expect(automationsThatCannotRun(empty, NOW)).toEqual([]);
    expect(automationCounts(empty, NOW).rules).toBe(0);
  });
});
