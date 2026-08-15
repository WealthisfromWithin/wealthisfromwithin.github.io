import { describe, expect, it } from 'vitest';
import type { Integration, IntegrationState } from '@/domain';
import { integrationCatalog } from './catalog';
import {
  countByState,
  deriveSubstrateHealth,
  effectiveIntegrationState,
  hasVerifiedProbe,
  INTEGRATION_STATES,
  integrationStateMeta,
  isUnverifiedConnectedClaim,
  isUsable,
} from './state';

const stamp = '2026-08-05T06:00:00.000Z';

/**
 * A row in the state it claims. `connected` carries the probe that justifies it
 * unless a test is specifically about a claim with no probe behind it, which is
 * the whole subject of the invariant suite below.
 */
function integration(
  id: string,
  state: IntegrationState,
  substrate = false,
  probedAt: string | undefined = state === 'connected' ? stamp : undefined,
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
    lastProbedAt: probedAt,
    substrate,
  };
}

/** A row that says Connected with nothing to show for it. */
function unverified(id: string, substrate = false): Integration {
  return { ...integration(id, 'connected', substrate), lastProbedAt: undefined };
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

/**
 * The connected-probe invariant (`docs/reviews/WAVE_6_GPT_REVIEW.md` L1). Wave 7
 * is the first wave with a writer that can set `connected`, so these tests are
 * the contract that writer has to satisfy — and the guarantee every reading
 * surface gets whether or not it remembers to ask.
 */
describe('connected requires a probe', () => {
  it('recognises a probe only when the row carries a parseable timestamp', () => {
    expect(hasVerifiedProbe(integration('a', 'connected'))).toBe(true);
    expect(hasVerifiedProbe(unverified('b'))).toBe(false);
    expect(hasVerifiedProbe(integration('c', 'connected', false, 'yesterday'))).toBe(false);
  });

  it('downgrades a connected claim with no probe to awaiting credentials', () => {
    expect(effectiveIntegrationState(unverified('a'))).toBe('awaiting_credentials');
    expect(isUnverifiedConnectedClaim(unverified('a'))).toBe(true);

    expect(effectiveIntegrationState(integration('b', 'connected'))).toBe('connected');
    expect(isUnverifiedConnectedClaim(integration('b', 'connected'))).toBe(false);
  });

  it('leaves every other state exactly as the registry recorded it', () => {
    for (const state of ['disabled', 'awaiting_credentials'] as const) {
      const row = integration('a', state);
      expect(effectiveIntegrationState(row)).toBe(state);
      expect(isUnverifiedConnectedClaim(row)).toBe(false);
    }
    // A probe date on a disabled row is a probe that ran and a decision to stay
    // off. It does not promote anything.
    expect(effectiveIntegrationState(integration('b', 'disabled', false, stamp))).toBe('disabled');
  });

  it('refuses to treat an unverified claim as usable', () => {
    expect(isUsable(unverified('a'))).toBe(false);
    expect(isUsable(integration('b', 'connected'))).toBe(true);
  });

  it('counts an unverified claim as awaiting credentials, so no surface prints a green it lacks', () => {
    const counts = countByState([unverified('a'), integration('b', 'connected')]);
    expect(counts).toEqual({ connected: 1, disabled: 0, awaiting_credentials: 1 });
  });

  it('keeps substrate health offline when the only connected member was never probed', () => {
    const health = deriveSubstrateHealth([unverified('a', true)]);

    expect(health.status).toBe('offline');
    expect(health.connected).toBe(0);
    expect(health.statement).toContain('No substrate connection is verified');
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
