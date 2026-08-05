import { describe, expect, it } from 'vitest';
import { buildDemoDataset } from '@/data/seed';
import { integrationCatalog } from './catalog';
import { mcpProfileFor, mcpProfiles, mcpServers, mcpSummary, mcpTransportLabel } from './mcp';

const NOW = new Date('2026-08-05T09:00:00.000Z');
const integrations = buildDemoDataset(NOW).integrations;

describe('mcp profiles', () => {
  it('names an integration row that exists for every profile', () => {
    const ids = new Set(integrationCatalog.map((entry) => entry.id));
    for (const profile of mcpProfiles) {
      expect(ids.has(profile.integrationId)).toBe(true);
      expect(profile.purpose.length).toBeGreaterThan(20);
      expect(profile.gap.length).toBeGreaterThan(20);
      expect(mcpTransportLabel[profile.transport].length).toBeGreaterThan(0);
    }
  });

  it('profiles only MCP rows, so the panel cannot describe a non-MCP integration', () => {
    const mcp = new Set(
      integrationCatalog.filter((entry) => entry.category === 'mcp').map((entry) => entry.id),
    );
    expect(mcpProfiles.every((profile) => mcp.has(profile.integrationId))).toBe(true);
  });

  it('looks a profile up by id and admits when there is none', () => {
    expect(mcpProfileFor('hermes-memory')?.ownership).toBe('first_party');
    expect(mcpProfileFor('linkedin')).toBeUndefined();
  });
});

describe('mcp servers', () => {
  it('takes its rows and its states from the registry alone', () => {
    const rows = mcpServers(integrations);
    const fromCatalog = integrations.filter((integration) => integration.category === 'mcp');

    expect(rows).toHaveLength(fromCatalog.length);
    expect(rows.length).toBeGreaterThan(3);
    for (const row of rows) {
      expect(row.state).toBe(
        fromCatalog.find((integration) => integration.id === row.integration.id)?.state,
      );
      expect(row.stateLabel.length).toBeGreaterThan(0);
      expect(row.statement.length).toBeGreaterThan(20);
    }
  });

  it('claims nothing is connected, because no probe was ever performed', () => {
    const rows = mcpServers(integrations);
    expect(rows.every((row) => row.state !== 'connected')).toBe(true);
    expect(rows.some((row) => row.state === 'awaiting_credentials')).toBe(true);
    expect(rows.some((row) => row.state === 'disabled')).toBe(true);
  });

  it('orders connected first, then awaiting credentials, then the ones turned off', () => {
    const rank = { connected: 0, awaiting_credentials: 1, disabled: 2 } as const;
    const rows = mcpServers([
      ...integrations,
      {
        ...(integrations.find((integration) => integration.category === 'mcp') as (typeof integrations)[number]),
        id: 'probed-mcp',
        name: 'Probed MCP',
        state: 'connected' as const,
        lastProbedAt: NOW.toISOString(),
      },
    ]);
    expect(rows[0]?.state).toBe('connected');
    expect(rows[0]?.statement).toContain('verified probe');
    for (let index = 1; index < rows.length; index += 1) {
      expect(rank[rows[index]?.state ?? 'disabled']).toBeGreaterThanOrEqual(
        rank[rows[index - 1]?.state ?? 'connected'],
      );
    }
  });

  it('reads a connected row with no probe behind it as awaiting credentials', () => {
    const rows = mcpServers([
      ...integrations,
      {
        ...(integrations.find((integration) => integration.category === 'mcp') as (typeof integrations)[number]),
        id: 'claims-connected-mcp',
        name: 'Claims Connected MCP',
        state: 'connected' as const,
      },
    ]);
    const row = rows.find((entry) => entry.integration.id === 'claims-connected-mcp');

    expect(row?.state).toBe('awaiting_credentials');
    expect(row?.stateLabel).toBe('Awaiting Credentials');
    expect(row?.statement).not.toContain('verified probe');
    expect(rows.every((entry) => entry.state !== 'connected')).toBe(true);
  });

  it('shows a declared server with no profile rather than hiding the dependency', () => {
    const rows = mcpServers([
      ...integrations,
      {
        ...(integrations.find((integration) => integration.category === 'mcp') as (typeof integrations)[number]),
        id: 'undocumented-mcp',
        name: 'Undocumented MCP',
        state: 'awaiting_credentials' as const,
      },
    ]);
    const row = rows.find((entry) => entry.integration.id === 'undocumented-mcp');
    expect(row).toBeDefined();
    expect(row?.profile).toBeUndefined();
    expect(row?.statement).toContain('no tool it would expose is callable');
  });

  it('says a disabled server is offered in no flow', () => {
    const row = mcpServers(integrations).find((entry) => entry.state === 'disabled');
    expect(row?.statement).toContain('Turned off deliberately');
  });

  it('carries no secret into the panel', () => {
    const printed = JSON.stringify(mcpServers(integrations));
    expect(printed).not.toMatch(/api[_-]?key|secret|token|bearer/i);
  });
});

describe('mcp summary', () => {
  it('adds up to the row count and states that no client ships in this bundle', () => {
    const summary = mcpSummary(integrations);
    expect(summary.connected + summary.awaiting + summary.disabled).toBe(summary.total);
    expect(summary.connected).toBe(0);
    expect(summary.firstParty).toBeGreaterThan(0);
    expect(summary.statement).toContain('ships no MCP client');
  });

  it('reports a verified probe only when the registry records one', () => {
    const claimed = integrations.map((integration) =>
      integration.category === 'mcp' ? { ...integration, state: 'connected' as const } : integration,
    );
    // Every MCP row now claims Connected, and not one carries a probe: the
    // summary must count zero rather than repeat the claim.
    expect(mcpSummary(claimed).connected).toBe(0);
    expect(mcpSummary(claimed).statement).toContain('ships no MCP client');

    const probed = claimed.map((integration) =>
      integration.category === 'mcp'
        ? { ...integration, lastProbedAt: NOW.toISOString() }
        : integration,
    );
    const summary = mcpSummary(probed);
    expect(summary.statement).toContain('record a verified probe');
    expect(summary.awaiting).toBe(0);
  });

  it('says the registry declares none rather than showing zeroes', () => {
    expect(mcpSummary([]).statement).toBe('No MCP server is declared in the registry.');
    expect(mcpSummary([]).total).toBe(0);
  });
});
