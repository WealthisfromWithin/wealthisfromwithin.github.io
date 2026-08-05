import type { Integration, IntegrationCategory, IntegrationState } from '@/domain';
import { integrationCategorySchema } from '@/domain';

export const integrationCategoryLabel: Record<IntegrationCategory, string> = {
  ai: 'AI',
  automation: 'Automation',
  communication: 'Communication',
  crm: 'CRM',
  data: 'Data',
  productivity: 'Productivity',
  publishing: 'Publishing',
  mcp: 'MCP',
};

export const INTEGRATION_STATES: readonly IntegrationState[] = [
  'connected',
  'disabled',
  'awaiting_credentials',
] as const;

/**
 * Registry filters. `all` first, then the categories the domain declares, so a
 * new category cannot exist in the schema and be unfilterable on the surface.
 */
export const INTEGRATION_CATEGORY_FILTERS = [
  'all',
  ...integrationCategorySchema.options,
] as const;
export type IntegrationCategoryFilter = (typeof INTEGRATION_CATEGORY_FILTERS)[number];

export function categoryFilterLabel(value: IntegrationCategoryFilter): string {
  return value === 'all' ? 'Every category' : integrationCategoryLabel[value];
}

export interface IntegrationStateMeta {
  label: string;
  /** Semantic tone consumed by the UI; never a raw colour. */
  tone: 'sentinel' | 'muted' | 'gold';
  description: string;
}

export const integrationStateMeta: Record<IntegrationState, IntegrationStateMeta> = {
  connected: {
    label: 'Connected',
    tone: 'sentinel',
    description: 'Credentials verified by a health probe.',
  },
  disabled: {
    label: 'Disabled',
    tone: 'muted',
    description: 'Intentionally off. Not offered in any flow.',
  },
  awaiting_credentials: {
    label: 'Awaiting Credentials',
    tone: 'gold',
    description: 'Supported, not configured. Configure in Settings.',
  },
};

/**
 * The connected-probe invariant (`docs/reviews/WAVE_6_GPT_REVIEW.md` L1).
 *
 * `connected` is defined on this surface as "credentials verified by a health
 * probe", so a row claiming it must carry the timestamp of the probe that
 * verified it. Before Wave 7 nothing could write that state, which made the
 * invariant a convention; `/sync` can now record a probe, so it is enforced
 * here — once, at the point every surface reads state — rather than in each
 * selector that would otherwise have to remember.
 *
 * Enforcement is a downgrade, not a throw. A row that says connected without
 * evidence is a row whose credentials are unverified, which is exactly what
 * `awaiting_credentials` means, and refusing to read the store would hide the
 * problem behind an error boundary instead of showing it.
 */
export function hasVerifiedProbe(integration: Integration): boolean {
  const at = integration.lastProbedAt;
  return at !== undefined && !Number.isNaN(Date.parse(at));
}

/** True when a row claims Connected with no probe behind the claim. */
export function isUnverifiedConnectedClaim(integration: Integration): boolean {
  return integration.state === 'connected' && !hasVerifiedProbe(integration);
}

/**
 * The state every surface must render, filter, and count by. Identical to
 * `integration.state` except for an unverified Connected claim, which reads as
 * Awaiting Credentials.
 */
export function effectiveIntegrationState(integration: Integration): IntegrationState {
  return isUnverifiedConnectedClaim(integration) ? 'awaiting_credentials' : integration.state;
}

export type IntegrationStateCounts = Record<IntegrationState, number>;

export function countByState(integrations: readonly Integration[]): IntegrationStateCounts {
  const counts: IntegrationStateCounts = {
    connected: 0,
    disabled: 0,
    awaiting_credentials: 0,
  };
  for (const integration of integrations) {
    counts[effectiveIntegrationState(integration)] += 1;
  }
  return counts;
}

export function isUsable(integration: Integration): boolean {
  return effectiveIntegrationState(integration) === 'connected';
}

export type SubstrateStatus = 'operational' | 'degraded' | 'offline';

export interface SubstrateHealth {
  status: SubstrateStatus;
  connected: number;
  total: number;
  /** Plain-language truth for the UI. Never a synthetic "Healthy". */
  statement: string;
}

/**
 * Health is derived only from registry truth. With zero verified probes the
 * honest answer is "offline", not a Sentinel green (ARCHITECTURE_AUDIT §11).
 */
export function deriveSubstrateHealth(integrations: readonly Integration[]): SubstrateHealth {
  const substrate = integrations.filter((entry) => entry.substrate);
  const eligible = substrate.filter((entry) => entry.state !== 'disabled');
  const connected = eligible.filter(isUsable).length;
  const total = eligible.length;

  if (total === 0) {
    return {
      status: 'offline',
      connected: 0,
      total: 0,
      statement: 'No substrate systems are enabled.',
    };
  }
  if (connected === 0) {
    return {
      status: 'offline',
      connected,
      total,
      statement: `No substrate connection is verified. ${String(total)} awaiting credentials.`,
    };
  }
  if (connected < total) {
    return {
      status: 'degraded',
      connected,
      total,
      statement: `${String(connected)} of ${String(total)} substrate systems verified.`,
    };
  }
  return {
    status: 'operational',
    connected,
    total,
    statement: `All ${String(total)} substrate systems verified.`,
  };
}

export function stateFilterLabel(state: IntegrationState | 'all'): string {
  return state === 'all' ? 'All' : integrationStateMeta[state].label;
}
