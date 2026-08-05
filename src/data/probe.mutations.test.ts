import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { recordIntegrationProbe } from './mutations';
import { ensureSeeded, readDataset, resetLocalStore } from './repositories';
import { countByState, effectiveIntegrationState, isUsable } from '@/integrations/state';
import { deriveSubstrateHealth } from '@/integrations/state';

const NOW = new Date('2026-08-05T09:00:00.000Z');
const PROBED_AT = '2026-08-05T08:59:58.000Z';

async function row(id: string) {
  const integration = await db.integrations.get(id);
  if (!integration) throw new Error(`no integration ${id}`);
  return integration;
}

beforeEach(async () => {
  await resetLocalStore(db);
  await ensureSeeded(db, NOW);
});

/**
 * The write half of the connected-probe invariant. `recordIntegrationProbe` is
 * the only writer in the codebase that can set `state: 'connected'`, so the
 * guarantee that Connected implies a probe is a property of this function plus
 * the reader-side downgrade in `src/integrations/state.ts`.
 */
describe('recordIntegrationProbe', () => {
  it('is the only writer that can set connected, and it needs a probe timestamp', async () => {
    const refused = await recordIntegrationProbe(
      'contentdone',
      { verified: true, at: '', detail: 'claims a verified probe with no time' },
      db,
      NOW,
    );

    expect(refused.ok).toBe(false);
    expect(refused.reason).toContain('must carry the time it ran');
    expect((await row('contentdone')).state).toBe('awaiting_credentials');
    expect((await row('contentdone')).lastProbedAt).toBeUndefined();
  });

  it('refuses a timestamp it cannot parse rather than storing it', async () => {
    const refused = await recordIntegrationProbe(
      'contentdone',
      { verified: true, at: 'this morning', detail: 'probe' },
      db,
      NOW,
    );

    expect(refused.ok).toBe(false);
    expect((await row('contentdone')).lastProbedAt).toBeUndefined();
  });

  it('writes connected with the probe date when the probe verified the endpoint', async () => {
    const written = await recordIntegrationProbe(
      'contentdone',
      { verified: true, at: PROBED_AT, detail: 'api.example.com answered 200 for /health.' },
      db,
      NOW,
    );

    expect(written).toEqual({ ok: true, state: 'connected' });
    const updated = await row('contentdone');
    expect(updated.state).toBe('connected');
    expect(updated.lastProbedAt).toBe(PROBED_AT);
    expect(updated.touchedAt).toBe(NOW.toISOString());
    // What the registry stores is what every reader derives.
    expect(effectiveIntegrationState(updated)).toBe('connected');
    expect(isUsable(updated)).toBe(true);
  });

  it('records a failed probe as a probe that ran, leaving the row awaiting credentials', async () => {
    const written = await recordIntegrationProbe(
      'contentdone',
      { verified: false, at: PROBED_AT, detail: 'api.example.com could not be reached.' },
      db,
      NOW,
    );

    expect(written).toEqual({ ok: true, state: 'awaiting_credentials' });
    const updated = await row('contentdone');
    expect(updated.state).toBe('awaiting_credentials');
    expect(updated.lastProbedAt).toBe(PROBED_AT);
  });

  it('moves a connected row back to awaiting credentials when a later probe fails', async () => {
    await recordIntegrationProbe(
      'contentdone',
      { verified: true, at: PROBED_AT, detail: 'answered 200' },
      db,
      NOW,
    );
    await recordIntegrationProbe(
      'contentdone',
      { verified: false, at: '2026-08-05T10:00:00.000Z', detail: 'answered 503' },
      db,
      new Date('2026-08-05T10:00:00.000Z'),
    );

    const updated = await row('contentdone');
    expect(updated.state).toBe('awaiting_credentials');
    expect(updated.lastProbedAt).toBe('2026-08-05T10:00:00.000Z');
  });

  it('refuses to probe a row that was turned off deliberately', async () => {
    const refused = await recordIntegrationProbe(
      'github-mcp',
      { verified: true, at: PROBED_AT, detail: 'answered 200' },
      db,
      NOW,
    );

    expect(refused.ok).toBe(false);
    expect(refused.reason).toContain('disabled deliberately');
    expect((await row('github-mcp')).state).toBe('disabled');
  });

  it('refuses an id the registry does not hold', async () => {
    const refused = await recordIntegrationProbe(
      'no-such-connector',
      { verified: true, at: PROBED_AT, detail: 'answered 200' },
      db,
      NOW,
    );

    expect(refused.ok).toBe(false);
    expect(refused.reason).toContain('No integration with that id');
  });

  it('records the probe in the activity log, so the Health Monitor can show it', async () => {
    await recordIntegrationProbe(
      'contentdone',
      { verified: true, at: PROBED_AT, detail: 'api.example.com answered 200 for /health.' },
      db,
      NOW,
    );

    const events = (await readDataset(db)).events.filter((event) =>
      event.title.startsWith('Health probe'),
    );
    expect(events).toHaveLength(1);
    expect(events[0]?.title).toContain('verified');
    expect(events[0]?.channel).toBe('system');
    expect(events[0]?.detail).toContain('/health');
  });

  it('moves substrate health only for the connector that actually answered', async () => {
    await recordIntegrationProbe(
      'contentdone',
      { verified: true, at: PROBED_AT, detail: 'answered 200' },
      db,
      NOW,
    );

    const { integrations } = await readDataset(db);
    const health = deriveSubstrateHealth(integrations);
    expect(countByState(integrations).connected).toBe(1);
    expect(health.status).toBe('degraded');
    expect(health.connected).toBe(1);
  });
});
