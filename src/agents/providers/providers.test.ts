import { describe, expect, it, vi } from 'vitest';
import { createKernel } from '../kernel';
import { CREDENTIALED_PROVIDERS, createCredentialedProviders } from './credentialed';
import { createLocalProvider, resolveLocalEndpoint } from './local';
import { createDefaultProviders, readAgentEnv } from './index';

const request = {
  intent: 'draft',
  messages: [{ role: 'user' as const, content: 'Draft the renewal memo.' }],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('local provider', () => {
  it('reports unconfigured and names the variable that would configure it', async () => {
    const health = await createLocalProvider().health();

    expect(health.state).toBe('unconfigured');
    expect(health.reachable).toBe(false);
    expect(health.external).toBe(false);
    expect(health.detail).toContain('VITE_LOCAL_AI_URL');
  });

  it('refuses with no_provider rather than inventing a completion', async () => {
    const result = await createLocalProvider().complete(request);

    expect(result.ok).toBe(false);
    expect(result.generated).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('no_provider');
  });

  it('probes the configured endpoint and reports ready when it answers', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(jsonResponse({ models: [] })));
    const health = await createLocalProvider({
      endpoint: 'http://localhost:11434/',
      fetchImpl,
    }).health();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('http://localhost:11434/api/tags');
    expect(health.state).toBe('ready');
    expect(health.reachable).toBe(true);
  });

  it('reports unreachable rather than ready when the endpoint refuses the probe', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response('', { status: 503 })),
    );
    const health = await createLocalProvider({
      endpoint: 'http://localhost:11434',
      fetchImpl,
    }).health();

    expect(health.state).toBe('unreachable');
    expect(health.reachable).toBe(false);
  });

  it('reports unreachable when the endpoint does not answer at all', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.reject(new Error('connection refused')));
    const health = await createLocalProvider({
      endpoint: 'http://localhost:11434',
      fetchImpl,
    }).health();

    expect(health.state).toBe('unreachable');
    expect(health.detail).toBe('connection refused');
  });

  it('returns only text the endpoint actually sent', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(jsonResponse({ message: { content: 'From the local runtime.' } })),
    );
    const result = await createLocalProvider({
      endpoint: 'http://localhost:11434',
      model: 'llama3.2',
      fetchImpl,
    }).complete(request);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.text).toBe('From the local runtime.');
    expect(result.generated).toBe(true);
    expect(result.provider).toBe('local');

    const body = fetchImpl.mock.calls[0]?.[1]?.body;
    expect(typeof body).toBe('string');
    expect(JSON.parse(typeof body === 'string' ? body : '{}')).toMatchObject({
      model: 'llama3.2',
      stream: false,
    });
  });

  it('refuses when the endpoint answers in a shape it does not recognise', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(jsonResponse({ choices: ['nope'] })),
    );
    const result = await createLocalProvider({
      endpoint: 'http://localhost:11434',
      fetchImpl,
    }).complete(request);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('provider_error');
  });

  it('refuses when the endpoint errors instead of surfacing a partial answer', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(new Response('', { status: 500 })));
    const result = await createLocalProvider({
      endpoint: 'http://localhost:11434',
      fetchImpl,
    }).complete(request);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('provider_error');
    expect(result.message).toContain('500');
  });
});

describe('local endpoint policy', () => {
  const loopback = [
    ['http://localhost:11434', 'http://localhost:11434'],
    ['http://127.0.0.1:11434/', 'http://127.0.0.1:11434'],
    ['http://[::1]:11434', 'http://[::1]:11434'],
    // URL normalises the written-out address and the upper-case scheme.
    ['http://[0:0:0:0:0:0:0:1]:11434', 'http://[::1]:11434'],
    ['HTTP://LOCALHOST:11434', 'http://localhost:11434'],
    ['https://localhost:11434', 'https://localhost:11434'],
    // A query string is not part of a base URL this adapter appends paths to.
    ['http://localhost:11434/ollama/?debug=1#x', 'http://localhost:11434/ollama'],
  ] as const;

  it.each(loopback)('accepts the loopback endpoint %s', (raw, base) => {
    expect(resolveLocalEndpoint(raw)).toEqual({ ok: true, base });
  });

  const remote = [
    'https://example.invalid',
    'http://models.example.com:11434',
    // Hosts that only read as local.
    'http://localhost.example.com:11434',
    'http://127.0.0.1.example.com:11434',
    'http://notlocalhost:11434',
    // Userinfo is not a host: this one resolves to example.com.
    'http://localhost@example.com:11434',
    // Other machines on the LAN are other machines.
    'http://192.168.1.10:11434',
    'http://10.0.0.4:11434',
    'http://[fe80::1]:11434',
    // Binding address, not a destination.
    'http://0.0.0.0:11434',
    // Not http at all.
    'file:///etc/hosts',
    'ws://localhost:11434',
    'javascript:fetch("https://example.invalid")',
    // Not parseable as a URL, or missing the scheme entirely.
    'localhost:11434',
    'not a url',
  ];

  it.each(remote)('refuses the non-loopback endpoint %s', (raw) => {
    const check = resolveLocalEndpoint(raw);

    expect(check.ok).toBe(false);
    if (check.ok) return;
    expect(check.detail).toContain('VITE_LOCAL_AI_URL');
  });

  it('names the rejected host but never echoes credentials written into the URL', () => {
    const check = resolveLocalEndpoint('http://operator:hunter2@models.example.com:11434');

    expect(check.ok).toBe(false);
    if (check.ok) return;
    expect(check.detail).toContain('models.example.com');
    expect(check.detail).not.toContain('hunter2');
  });

  it('reports a remote endpoint as unavailable without probing it', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(jsonResponse({ models: [] })));
    const health = await createLocalProvider({
      endpoint: 'https://models.example.com',
      fetchImpl,
    }).health();

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(health.state).toBe('unconfigured');
    expect(health.reachable).toBe(false);
    expect(health.external).toBe(false);
    expect(health.detail).toContain('models.example.com');
    expect(health.detail).toContain('loopback');
  });

  it('refuses a turn against a remote endpoint without sending it anything', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(jsonResponse({ message: { content: 'from a remote host' } })),
    );
    const result = await createLocalProvider({
      endpoint: 'https://models.example.com',
      fetchImpl,
    }).complete(request);

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(result.generated).toBe(false);
    expect(result).not.toHaveProperty('text');
    if (result.ok) return;
    expect(result.reason).toBe('no_provider');
    expect(result.message).toContain('loopback');
  });

  it('does not treat a rejected endpoint as a reason to skip validation later', async () => {
    // The same adapter instance is asked twice: a refusal is not cached into a
    // state where the second call falls through to the endpoint.
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(jsonResponse({ models: [] })));
    const provider = createLocalProvider({ endpoint: 'https://models.example.com', fetchImpl });

    await provider.health();
    await provider.complete(request);
    await provider.health();

    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('credentialed providers', () => {
  it('registers one adapter per hosted provider, all external', () => {
    const providers = createCredentialedProviders();

    expect(providers.map((entry) => entry.id)).toEqual(
      CREDENTIALED_PROVIDERS.map((entry) => entry.id),
    );
    expect(providers.every((entry) => entry.external)).toBe(true);
  });

  it('reports awaiting_credentials rather than ready', async () => {
    for (const provider of createCredentialedProviders()) {
      const health = await provider.health();
      expect({ id: provider.id, state: health.state }).toEqual({
        id: provider.id,
        state: 'awaiting_credentials',
      });
      expect(health.reachable).toBe(false);
    }
  });

  it('refuses every completion and never carries text', async () => {
    for (const provider of createCredentialedProviders()) {
      const result = await provider.complete(request);
      expect({ id: provider.id, ok: result.ok, generated: result.generated }).toEqual({
        id: provider.id,
        ok: false,
        generated: false,
      });
      if (result.ok) continue;
      expect(result.reason).toBe('awaiting_credentials');
      expect(result).not.toHaveProperty('text');
    }
  });
});

describe('the default roster', () => {
  it('puts the local adapter first, because it is the only one that can run', () => {
    expect(createDefaultProviders().map((entry) => entry.id)).toEqual([
      'local',
      'claude',
      'openai',
      'gemini',
      'openrouter',
    ]);
  });

  it('reads the local endpoint from the build environment and nothing else', () => {
    expect(readAgentEnv({})).toEqual({ endpoint: undefined, model: undefined });
    expect(readAgentEnv({ VITE_LOCAL_AI_URL: 'http://localhost:11434' })).toEqual({
      endpoint: 'http://localhost:11434',
      model: undefined,
    });
  });

  it('refuses honestly end to end when nothing is configured', async () => {
    const result = await createKernel(createDefaultProviders({})).run(request);

    expect(result.ok).toBe(false);
    expect(result.generated).toBe(false);
    if (result.ok) return;
    // Local is unconfigured and the hosted four are external, so the default
    // policy blocks them before any of them is asked.
    expect(['no_provider', 'awaiting_credentials', 'policy_blocked']).toContain(result.reason);
  });

  it('runs a loopback endpoint under the default policy, which forbids external calls', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(jsonResponse({ message: { content: 'From this machine.' } })),
    );
    const kernel = createKernel(
      createDefaultProviders({ endpoint: 'http://127.0.0.1:11434', fetchImpl }),
    );

    const result = await kernel.run(request);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.provider).toBe('local');
    expect(result.text).toBe('From this machine.');
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('http://127.0.0.1:11434/api/chat');
  });

  it('cannot be pointed at a remote host through the local endpoint variable', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(jsonResponse({ message: { content: 'from a remote host' } })),
    );
    const kernel = createKernel(
      createDefaultProviders({ endpoint: 'https://models.example.com', fetchImpl }),
    );

    const result = await kernel.run(request);

    // Nothing left the machine: the local adapter refused before building a
    // request, and the hosted four are external under a policy that forbids it.
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(result.generated).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('no_provider');
  });

  it('still refuses the remote endpoint when the policy does allow external calls', async () => {
    // Allowing external calls is a statement about the hosted adapters. It does
    // not reclassify a remote URL as the local runtime.
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(jsonResponse({ message: { content: 'from a remote host' } })),
    );
    const kernel = createKernel(
      createDefaultProviders({ endpoint: 'https://models.example.com', fetchImpl }),
    );

    const result = await kernel.run({ ...request, policy: { allowExternalCalls: true } });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('no_provider');
  });

  it('reports every adapter as unable to run when the local endpoint is remote', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(jsonResponse({ models: [] })));
    const health = await createKernel(
      createDefaultProviders({ endpoint: 'https://models.example.com', fetchImpl }),
    ).health();

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(health.some((entry) => entry.state === 'ready')).toBe(false);
    expect(health.some((entry) => entry.reachable)).toBe(false);
  });
});
