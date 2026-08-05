import type { Integration, IntegrationState } from '@/domain';

export const INTEGRATION_STATES: readonly IntegrationState[] = [
  'connected',
  'disabled',
  'awaiting_credentials',
] as const;

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

export type IntegrationStateCounts = Record<IntegrationState, number>;

export function countByState(integrations: readonly Integration[]): IntegrationStateCounts {
  const counts: IntegrationStateCounts = {
    connected: 0,
    disabled: 0,
    awaiting_credentials: 0,
  };
  for (const integration of integrations) {
    counts[integration.state] += 1;
  }
  return counts;
}

export function isUsable(integration: Integration): boolean {
  return integration.state === 'connected';
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
