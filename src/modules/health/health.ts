import type { SovereignDataset } from '@/data/dataset';
import type { ActivityEvent, Integration, IntegrationCategory } from '@/domain';
import {
  countByState,
  deriveSubstrateHealth,
  effectiveIntegrationState,
  isUsable,
  type IntegrationStateCounts,
  type SubstrateHealth,
} from '@/integrations/state';

/**
 * Health is a projection of the Integration Registry, nothing else. This module
 * owns no probe, no ping, and no timer: if a value is not in the registry it is
 * not on this page (ARCHITECTURE_AUDIT §5.7, §11).
 */

export interface ProbeStatus {
  /** True only when some integration carries a recorded probe timestamp. */
  hasRun: boolean;
  lastProbedAt?: string;
  statement: string;
}

export interface CategoryHealth {
  category: IntegrationCategory;
  counts: IntegrationStateCounts;
  total: number;
}

export interface BlockedCapability {
  integrationId: string;
  integrationName: string;
  capability: string;
}

export interface HealthReport {
  substrate: SubstrateHealth;
  counts: IntegrationStateCounts;
  total: number;
  probe: ProbeStatus;
  categories: CategoryHealth[];
  substrateMembers: Integration[];
  /** Capabilities the registry says cannot run, with the connector that owns them. */
  blockedCapabilities: BlockedCapability[];
  /** The local activity log. Recorded events only — never synthesised telemetry. */
  events: ActivityEvent[];
}

const EVENT_LIMIT = 12;

/**
 * Verified means the registry row is connected *and* carries the probe that
 * verified it, which is what `isUsable` enforces — a Health Monitor that
 * repeated an unverified claim would be the fake green this module exists to
 * prevent.
 */
export function verifiedIntegrations(integrations: readonly Integration[]): Integration[] {
  return integrations.filter(isUsable);
}

function lastProbe(integrations: readonly Integration[]): string | undefined {
  const stamps = integrations
    .map((integration) => integration.lastProbedAt)
    .filter((value): value is string => value !== undefined && !Number.isNaN(Date.parse(value)));
  if (stamps.length === 0) return undefined;
  return stamps.reduce((latest, value) => (Date.parse(value) > Date.parse(latest) ? value : latest));
}

export function probeStatus(integrations: readonly Integration[]): ProbeStatus {
  const at = lastProbe(integrations);
  if (at === undefined) {
    return {
      hasRun: false,
      statement:
        'No health probe has ever run from this surface. Every state below is declared configuration, not a measurement.',
    };
  }
  return {
    hasRun: true,
    lastProbedAt: at,
    statement: `Last probe recorded ${at}.`,
  };
}

function categoryHealth(integrations: readonly Integration[]): CategoryHealth[] {
  const byCategory = new Map<IntegrationCategory, Integration[]>();
  for (const integration of integrations) {
    const bucket = byCategory.get(integration.category) ?? [];
    bucket.push(integration);
    byCategory.set(integration.category, bucket);
  }

  return [...byCategory.entries()]
    .map(([category, members]) => ({
      category,
      counts: countByState(members),
      total: members.length,
    }))
    .sort((a, b) => b.total - a.total || a.category.localeCompare(b.category));
}

function blockedCapabilities(integrations: readonly Integration[]): BlockedCapability[] {
  return integrations
    .filter((integration) => effectiveIntegrationState(integration) === 'awaiting_credentials')
    .flatMap((integration) =>
      integration.capabilities.map((capability) => ({
        integrationId: integration.id,
        integrationName: integration.name,
        capability,
      })),
    );
}

export function buildHealthReport(
  dataset: SovereignDataset,
  eventLimit: number = EVENT_LIMIT,
): HealthReport {
  const integrations = dataset.integrations;

  return {
    substrate: deriveSubstrateHealth(integrations),
    counts: countByState(integrations),
    total: integrations.length,
    probe: probeStatus(integrations),
    categories: categoryHealth(integrations),
    substrateMembers: integrations
      .filter((integration) => integration.substrate)
      .sort((a, b) => a.name.localeCompare(b.name)),
    blockedCapabilities: blockedCapabilities(integrations),
    events: [...dataset.events]
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      .slice(0, eventLimit),
  };
}
