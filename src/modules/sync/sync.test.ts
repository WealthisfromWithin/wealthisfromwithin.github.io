import { describe, expect, it, vi } from 'vitest';
import {
  HEALTH_PATH,
  probeCommandApi,
  readSyncEnv,
  resolveApiBaseUrl,
  syncCapabilities,
  syncStatus,
  type ProbeRecord,
  type SyncConfig,
} from './sync';

const NOW = new Date('2026-08-05T09:00:00.000Z');

type FetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function configured(url = 'https://api.example.com'): Extract<SyncConfig, { kind: 'configured' }> {
  const config = resolveApiBaseUrl(url);
  if (config.kind !== 'configured') throw new Error(`expected a configured adapter: ${url}`);
  return config;
}

function ok(status = 200) {
  // 204 carries no body, and `Response` refuses to be built with one.
  const body = status === 204 || status === 205 ? null : '{"ok":true}';
  return vi.fn<FetchImpl>(() => Promise.resolve(new Response(body, { status })));
}

describe('resolveApiBaseUrl', () => {
  it('reports an unset variable as absent rather than as a fault', () => {
    for (const value of [undefined, '', '   ']) {
      const config = resolveApiBaseUrl(value);
      expect(config.kind).toBe('absent');
      expect(config.detail).toContain('VITE_API_BASE_URL is unset');
    }
  });

  it('accepts an https origin and normalises it to a base with no trailing slash', () => {
    expect(configured('https://api.example.com/').base).toBe('https://api.example.com');
    expect(configured('https://api.example.com/v1/').base).toBe('https://api.example.com/v1');
    expect(configured('https://api.example.com').host).toBe('api.example.com');
  });

  it('accepts http only on this machine, where there is no network to eavesdrop on', () => {
    expect(configured('http://localhost:3000').base).toBe('http://localhost:3000');
    expect(configured('http://127.0.0.1:3000').host).toBe('127.0.0.1:3000');
    expect(resolveApiBaseUrl('http://api.example.com').kind).toBe('refused');
    expect(resolveApiBaseUrl('http://api.example.com').detail).toContain('Only https is called');
  });

  it('refuses a base URL carrying credentials, because the bundle is public', () => {
    const refused = resolveApiBaseUrl('https://operator:s3cret@api.example.com');
    expect(refused.kind).toBe('refused');
    expect(refused.detail).toContain('credentials in the URL');
    // The refusal must not reprint the secret it is refusing.
    expect(refused.detail).not.toContain('s3cret');
  });

  it('refuses a query string or fragment, the other place an API key hides', () => {
    expect(resolveApiBaseUrl('https://api.example.com?api_key=abc').kind).toBe('refused');
    expect(resolveApiBaseUrl('https://api.example.com?api_key=abc').detail).not.toContain('abc');
    expect(resolveApiBaseUrl('https://api.example.com#token').kind).toBe('refused');
  });

  it('refuses anything it cannot parse, and anything that is not http(s)', () => {
    expect(resolveApiBaseUrl('not a url').kind).toBe('refused');
    expect(resolveApiBaseUrl('javascript:alert(1)').kind).toBe('refused');
    expect(resolveApiBaseUrl('file:///etc/passwd').kind).toBe('refused');
  });

  it('reads the variable from the environment it is handed', () => {
    expect(readSyncEnv({ VITE_API_BASE_URL: 'https://api.example.com' })).toBe(
      'https://api.example.com',
    );
    expect(readSyncEnv({})).toBeUndefined();
  });
});

describe('probeCommandApi', () => {
  it('sends nothing at all when no base URL is configured', async () => {
    const fetchImpl = ok();
    const result = await probeCommandApi(resolveApiBaseUrl(undefined), { fetchImpl, now: NOW });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.verified).toBe(false);
    expect(result.failure).toBe('not_configured');
    expect(result.at).toBe(NOW.toISOString());
  });

  it('sends nothing to a base URL it refused', async () => {
    const fetchImpl = ok();
    const result = await probeCommandApi(resolveApiBaseUrl('https://user:pw@api.example.com'), {
      fetchImpl,
      now: NOW,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.verified).toBe(false);
  });

  it('asks for /health with no credentials and no headers', async () => {
    const fetchImpl = ok();
    const result = await probeCommandApi(configured(), { fetchImpl, now: NOW });

    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe(`https://api.example.com${HEALTH_PATH}`);
    expect(init?.method).toBe('GET');
    expect(init?.credentials).toBe('omit');
    expect(init?.headers).toBeUndefined();
    expect(result.verified).toBe(true);
    expect(result.status).toBe(200);
    expect(result.at).toBe(NOW.toISOString());
  });

  it('calls a 2xx reachability and refuses to call it anything more', async () => {
    const result = await probeCommandApi(configured(), { fetchImpl: ok(204), now: NOW });

    expect(result.verified).toBe(true);
    expect(result.detail).toContain('reachability, not authorisation and not a sync');
    expect(result.detail).not.toMatch(/synced|records/i);
  });

  it('records a non-2xx as reachable but unverified, with the status', async () => {
    const result = await probeCommandApi(configured(), { fetchImpl: ok(503), now: NOW });

    expect(result.verified).toBe(false);
    expect(result.status).toBe(503);
    expect(result.failure).toBe('status');
    expect(result.detail).toContain('did not report itself healthy');
  });

  it('records a failed request as a probe that ran, with the time it ran', async () => {
    const fetchImpl = vi.fn<FetchImpl>(() => Promise.reject(new Error('network down')));
    const result = await probeCommandApi(configured(), { fetchImpl, now: NOW });

    expect(result.verified).toBe(false);
    expect(result.failure).toBe('unreachable');
    expect(result.at).toBe(NOW.toISOString());
    expect(result.detail).toContain('network down');
  });
});

describe('syncStatus', () => {
  function probe(verified: boolean, at = NOW.toISOString()): ProbeRecord {
    return { verified, at, detail: 'detail sentence.' };
  }

  it('is Disabled with no configuration, and cannot probe', () => {
    const status = syncStatus(resolveApiBaseUrl(undefined), null);

    expect(status.state).toBe('disabled');
    expect(status.label).toBe('Disabled');
    expect(status.canProbe).toBe(false);
    expect(status.lastProbedAt).toBeUndefined();
  });

  it('is Disabled when the configuration was refused, and says why', () => {
    const status = syncStatus(resolveApiBaseUrl('http://api.example.com'), null);

    expect(status.state).toBe('disabled');
    expect(status.canProbe).toBe(false);
    expect(status.statement).toContain('Only https is called');
  });

  it('is Awaiting Credentials once configured but never probed', () => {
    const status = syncStatus(configured(), null);

    expect(status.state).toBe('awaiting_credentials');
    expect(status.canProbe).toBe(true);
    expect(status.lastProbedAt).toBeUndefined();
    expect(status.host).toBe('api.example.com');
  });

  it('stays Awaiting Credentials after a failed probe, and keeps the probe date', () => {
    const status = syncStatus(configured(), probe(false));

    expect(status.state).toBe('awaiting_credentials');
    expect(status.lastProbedAt).toBe(NOW.toISOString());
    expect(status.statement).toContain('stays Awaiting Credentials');
  });

  it('is Connected only with a successful probe that carries its timestamp', () => {
    expect(syncStatus(configured(), probe(true)).state).toBe('connected');
    // The invariant: no timestamp, no Connected — even when the probe claims success.
    expect(syncStatus(configured(), probe(true, '')).state).toBe('awaiting_credentials');
    expect(syncStatus(configured(), probe(true, 'not a date')).state).toBe('awaiting_credentials');
  });

  it('never claims a record moved, in any state', () => {
    const statements = [
      syncStatus(resolveApiBaseUrl(undefined), null),
      syncStatus(configured(), null),
      syncStatus(configured(), probe(false)),
      syncStatus(configured(), probe(true)),
    ].map((status) => status.statement);

    for (const statement of statements) {
      expect(statement).not.toMatch(/synchronised \d|records? synced|in sync\b|up to date/i);
    }
    expect(syncStatus(configured(), probe(true)).statement).toContain('no sync path is implemented');
  });
});

describe('syncCapabilities', () => {
  it('implements exactly one thing, and names what the rest would need', () => {
    const capabilities = syncCapabilities();
    const implemented = capabilities.filter((capability) => capability.implemented);

    expect(implemented.map((capability) => capability.id)).toEqual(['health-probe']);
    expect(capabilities.length).toBeGreaterThan(4);
    for (const capability of capabilities) {
      expect(capability.detail.length).toBeGreaterThan(40);
    }
  });
});
