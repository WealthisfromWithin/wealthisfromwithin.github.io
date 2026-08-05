import { describe, expect, it, vi } from 'vitest';
import { createKernel } from '../kernel';
import { CREDENTIALED_PROVIDERS, createCredentialedProviders } from './credentialed';
import { createLocalProvider } from './local';
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
});
