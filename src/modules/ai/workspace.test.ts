import { describe, expect, it } from 'vitest';
import type { ProviderHealth } from '@/agents';
import { emptyDataset } from '@/data/dataset';
import { buildDemoDataset } from '@/data/seed';
import {
  anyProviderReady,
  findSession,
  providerStatusRows,
  providerSummary,
  selectSessions,
  sessionMessages,
  sessionThread,
  sessionsAwaitingProvider,
  workspaceCounts,
} from './workspace';

const now = new Date('2026-08-05T07:30:00.000Z');
const dataset = buildDemoDataset(now);

function health(
  id: string,
  state: ProviderHealth['state'],
  external = state === 'awaiting_credentials',
): ProviderHealth {
  return {
    id,
    label: id,
    state,
    reachable: state === 'ready',
    external,
    detail: '',
  };
}

describe('sessions', () => {
  it('lists sessions newest activity first', () => {
    expect(selectSessions(dataset).map((session) => session.id)).toEqual([
      'ags-renewal-memo',
      'ags-week-plan',
    ]);
  });

  it('reads a thread in order and counts what was generated against what was refused', () => {
    const session = findSession(dataset, 'ags-renewal-memo');
    expect(session).toBeDefined();
    if (!session) return;

    const thread = sessionThread(dataset, session);

    expect(thread.messages.map((message) => message.id)).toEqual([
      'agm-renewal-1',
      'agm-renewal-2',
    ]);
    expect(thread.turns).toBe(1);
    expect(thread.generated).toBe(0);
    expect(thread.refused).toBe(1);
    expect(thread.prompt?.id).toBe('pr-renewal-memo');
  });

  it('marks no seeded assistant message as generated, because none was', () => {
    for (const message of dataset.agentMessages) {
      expect({ id: message.id, generated: message.generated }).toEqual({
        id: message.id,
        generated: false,
      });
    }
  });

  it('counts the whole workspace without claiming output it does not hold', () => {
    const counts = workspaceCounts(dataset);

    expect(counts.sessions).toBe(dataset.agentSessions.length);
    expect(counts.generated).toBe(0);
    expect(counts.refused).toBe(2);
    expect(counts.turns).toBe(2);
  });

  it('reports the sessions whose turns the kernel could not run', () => {
    expect(sessionsAwaitingProvider(dataset).map((session) => session.id)).toEqual([
      'ags-renewal-memo',
      'ags-week-plan',
    ]);
    expect(sessionsAwaitingProvider(emptyDataset)).toHaveLength(0);
  });

  it('finds nothing for an id the store does not hold', () => {
    expect(findSession(dataset, 'ags-nope')).toBeUndefined();
    expect(sessionMessages(dataset, 'ags-nope')).toHaveLength(0);
  });
});

describe('provider status', () => {
  it('lines each adapter up with the registry row an operator would configure', () => {
    const rows = providerStatusRows(
      [health('local', 'unconfigured', false), health('claude', 'awaiting_credentials')],
      dataset.integrations,
    );

    expect(rows.map((row) => row.integration?.id)).toEqual(['local-ai', 'anthropic']);
  });

  it('leaves an adapter with no registry row unmatched rather than inventing one', () => {
    const rows = providerStatusRows([health('mystery', 'unconfigured', false)], dataset.integrations);
    expect(rows[0]?.integration).toBeUndefined();
  });

  it('never reports ready unless an adapter says it is', () => {
    expect(anyProviderReady([])).toBe(false);
    expect(
      anyProviderReady([health('local', 'unconfigured', false), health('claude', 'awaiting_credentials')]),
    ).toBe(false);
    expect(anyProviderReady([health('local', 'ready', false)])).toBe(true);
  });

  it('summarises an unconfigured roster without the word ready', () => {
    const summary = providerSummary([
      health('local', 'unconfigured', false),
      health('claude', 'awaiting_credentials'),
      health('openai', 'awaiting_credentials'),
    ]);

    expect(summary).toContain('No adapter can run a turn');
    expect(summary).toContain('2 awaiting credentials');
    expect(summary.toLowerCase()).not.toContain('ready');
  });

  it('names the adapters that can run once one is configured', () => {
    const summary = providerSummary([
      health('local', 'ready', false),
      health('claude', 'awaiting_credentials'),
    ]);

    expect(summary).toContain('1 of 2 adapters can run a turn');
    expect(summary).toContain('local');
  });

  it('says so plainly when nothing is registered at all', () => {
    expect(providerSummary([])).toBe('No provider adapter is registered.');
  });
});
