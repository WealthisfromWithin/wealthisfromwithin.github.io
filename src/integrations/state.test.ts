import { describe, expect, it } from 'vitest';
import type { Integration, IntegrationState } from '@/domain';
import { integrationCatalog } from './catalog';
import {
  countByState,
  deriveSubstrateHealth,
  INTEGRATION_STATES,
  integrationStateMeta,
  isUsable,
} from './state';

const stamp = '2026-08-05T06:00:00.000Z';

function integration(
  id: string,
  state: IntegrationState,
  substrate = false,
): Integration {
  return {
    id,
    name: id,
    source: 'local',
    createdAt: stamp,
    updatedAt: stamp,
    category: 'data',
    state,
    capabilities: [],
    rationale: '',
    substrate,
  };
}

describe('integration state model', () => {
  it('exposes exactly three legal states', () => {
    expect(INTEGRATION_STATES).toHaveLength(3);
    expect(Object.keys(integrationStateMeta).sort()).toEqual(
      [...INTEGRATION_STATES].sort(),
    );
  });

  it('only treats connected as usable', () => {
    expect(isUsable(integration('a', 'connected'))).toBe(true);
    expect(isUsable(integration('b', 'awaiting_credentials'))).toBe(false);
    expect(isUsable(integration('c', 'disabled'))).toBe(false);
  });

  it('counts each state', () => {
    const counts = countByState([
      integration('a', 'connected'),
      integration('b', 'disabled'),
      integration('c', 'awaiting_credentials'),
      integration('d', 'awaiting_credentials'),
    ]);
    expect(counts).toEqual({ connected: 1, disabled: 1, awaiting_credentials: 2 });
  });
});

describe('deriveSubstrateHealth', () => {
  it('reports offline when nothing is verified', () => {
    const health = deriveSubstrateHealth([
      integration('a', 'awaiting_credentials', true),
      integration('b', 'awaiting_credentials', true),
    ]);
    expect(health.status).toBe('offline');
    expect(health.connected).toBe(0);
    expect(health.statement).toContain('No substrate connection is verified');
  });

  it('reports degraded on partial verification', () => {
    const health = deriveSubstrateHealth([
      integration('a', 'connected', true),
      integration('b', 'awaiting_credentials', true),
    ]);
    expect(health.status).toBe('degraded');
  });

  it('ignores disabled substrate members', () => {
    const health = deriveSubstrateHealth([
      integration('a', 'connected', true),
      integration('b', 'disabled', true),
    ]);
    expect(health.status).toBe('operational');
    expect(health.total).toBe(1);
  });

  it('ignores non-substrate integrations', () => {
    const health = deriveSubstrateHealth([integration('a', 'connected', false)]);
    expect(health.status).toBe('offline');
    expect(health.total).toBe(0);
  });
});

describe('integration catalog', () => {
  it('never ships a Connected connector without a probe', () => {
    expect(integrationCatalog.some((entry) => entry.state === 'connected')).toBe(false);
  });

  it('has unique ids and legal states', () => {
    const ids = integrationCatalog.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of integrationCatalog) {
      expect(INTEGRATION_STATES).toContain(entry.state);
    }
  });
});
