import type { Integration, IntegrationState } from '@/domain';
import { effectiveIntegrationState, integrationStateMeta } from './state';

/**
 * The MCP surface, read from the integration registry.
 *
 * There is no MCP client in this bundle: no transport is opened, no server is
 * pinged, and no tool list is fetched. A server's state is therefore whatever the
 * registry row says — one of Connected, Disabled, or Awaiting Credentials — and
 * `connected` still means what it means everywhere else on this surface: a
 * verified probe, which nothing here has performed.
 *
 * The extra fields below are declared intent about servers the operation plans to
 * run. They describe what a server would carry, in the operator's words; they are
 * never evidence that it is reachable. That is why they live next to the registry
 * rather than inside it: the registry holds state, this holds description.
 */

export type McpTransport = 'stdio' | 'http' | 'unknown';

export interface McpServerProfile {
  /** Matches the integration row id, so state has exactly one source. */
  integrationId: string;
  /** How the server would be reached if it existed. Declared, never probed. */
  transport: McpTransport;
  /** Who runs it: the operation itself, or somebody else. */
  ownership: 'first_party' | 'vendor';
  /** What it is meant to carry, in plain words. */
  purpose: string;
  /** Why it is not connected. The honest half of the panel. */
  gap: string;
}

export const mcpTransportLabel: Record<McpTransport, string> = {
  stdio: 'stdio (local process)',
  http: 'HTTP (remote)',
  unknown: 'Transport undecided',
};

/**
 * Profiles for the MCP rows in the catalog. A server with no profile still shows
 * up in the panel from its registry row — a missing description is a gap in the
 * documentation, not a reason to hide a declared dependency.
 */
export const mcpProfiles: readonly McpServerProfile[] = [
  {
    integrationId: 'hermes-memory',
    transport: 'http',
    ownership: 'first_party',
    purpose:
      'Long-term memory the operation owns: durable facts, preferences, and constraints, shared across surfaces rather than per-browser.',
    gap: 'The server is not built. Memory currently lives in this browser only, on the Memory surface.',
  },
  {
    integrationId: 'hermesbrain',
    transport: 'unknown',
    ownership: 'first_party',
    purpose: 'Reasoning orchestration across the memory, content, and pipeline tools.',
    gap: 'Brand surface only today. No runtime exists, so nothing can call it and no tool list can be enumerated.',
  },
  {
    integrationId: 'sovereign-mind-mcp',
    transport: 'http',
    ownership: 'first_party',
    purpose:
      'The gateway that would expose this Command Center as tools — read the brief, open a gate, record a decision — to an external agent.',
    gap: 'Not built. It also needs the Command API of Wave 7 before any write could be authorised.',
  },
  {
    integrationId: 'github-mcp',
    transport: 'stdio',
    ownership: 'vendor',
    purpose: 'Repository and issue reads for an agent working on this codebase.',
    gap: 'Disabled by choice: the read-only GitHub connector already covers the same signals, and two paths to one system is a synchronisation problem nobody asked for.',
  },
  {
    integrationId: 'notion-mcp',
    transport: 'http',
    ownership: 'vendor',
    purpose: 'Documents and databases held in Notion, exposed as tools.',
    gap: 'Disabled while Documents and Knowledge stay local-first. Nothing is lost by leaving it off, because nothing depends on it.',
  },
];

export function mcpProfileFor(integrationId: string): McpServerProfile | undefined {
  return mcpProfiles.find((profile) => profile.integrationId === integrationId);
}

export interface McpServerRow {
  integration: Integration;
  profile: McpServerProfile | undefined;
  state: IntegrationState;
  stateLabel: string;
  tone: 'sentinel' | 'muted' | 'gold';
  /**
   * What this surface can honestly say about the connection right now. Never
   * "healthy", never a latency, never a tool count.
   */
  statement: string;
}

/**
 * Every MCP row in the registry, in state order. Nothing is added to this list
 * that the registry does not carry, so the panel and `/integrations` can never
 * disagree about whether a server is connected.
 */
export function mcpServers(integrations: readonly Integration[]): McpServerRow[] {
  return integrations
    .filter((integration) => integration.category === 'mcp')
    .map((integration) => {
      // The registry's own state, after the connected-probe invariant: a row
      // claiming Connected with no probe behind it reads as awaiting
      // credentials here exactly as it does on `/integrations`.
      const state = effectiveIntegrationState(integration);
      const meta = integrationStateMeta[state];
      const profile = mcpProfileFor(integration.id);
      return {
        integration,
        profile,
        state,
        stateLabel: meta.label,
        tone: meta.tone,
        statement:
          state === 'connected'
            ? 'The registry records a verified probe for this server.'
            : state === 'disabled'
              ? 'Turned off deliberately. It is offered in no flow and no rule can name it.'
              : 'Declared and unconfigured. No transport is opened from this bundle, so no tool it would expose is callable.',
      };
    })
    .sort((a, b) => {
      const order: Record<IntegrationState, number> = {
        connected: 0,
        awaiting_credentials: 1,
        disabled: 2,
      };
      return (
        order[a.state] - order[b.state] || a.integration.name.localeCompare(b.integration.name)
      );
    });
}

export interface McpSummary {
  total: number;
  connected: number;
  awaiting: number;
  disabled: number;
  firstParty: number;
  /** One sentence for the header. Derived, so it cannot drift from the counts. */
  statement: string;
}

export function mcpSummary(integrations: readonly Integration[]): McpSummary {
  const rows = mcpServers(integrations);
  const connected = rows.filter((row) => row.state === 'connected').length;
  const awaiting = rows.filter((row) => row.state === 'awaiting_credentials').length;
  const disabled = rows.filter((row) => row.state === 'disabled').length;

  return {
    total: rows.length,
    connected,
    awaiting,
    disabled,
    firstParty: rows.filter((row) => row.profile?.ownership === 'first_party').length,
    statement:
      rows.length === 0
        ? 'No MCP server is declared in the registry.'
        : connected === 0
          ? `No MCP server is connected. ${String(awaiting)} awaiting credentials, ${String(disabled)} disabled, and this bundle ships no MCP client to connect with.`
          : `${String(connected)} of ${String(rows.length)} MCP servers record a verified probe.`,
  };
}
