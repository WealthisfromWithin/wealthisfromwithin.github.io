import { describe, expect, it, vi } from 'vitest';
import {
  createKernel,
  createStubKernel,
  type AgentRequest,
  type AgentResult,
  type LLMProvider,
  type ProviderHealth,
  type ProviderId,
} from './kernel';

const request: AgentRequest = {
  intent: 'draft',
  messages: [{ role: 'user', content: 'Draft the renewal memo.' }],
};

function health(id: ProviderId, state: ProviderHealth['state'], external: boolean): ProviderHealth {
  return { id, label: id, state, reachable: state === 'ready', external, detail: '' };
}

function provider(
  id: ProviderId,
  options: { external?: boolean; result?: AgentResult; throws?: Error } = {},
): LLMProvider {
  const external = options.external ?? false;
  return {
    id,
    label: id,
    external,
    health: () => Promise.resolve(health(id, options.result?.ok ? 'ready' : 'unconfigured', external)),
    complete: () => {
      if (options.throws) throw options.throws;
      return Promise.resolve(
        options.result ?? {
          ok: false,
          generated: false,
          reason: 'no_provider',
          message: `${id} has nothing to run with.`,
          provider: id,
        },
      );
    },
  };
}

function completion(id: ProviderId, text: string): AgentResult {
  return { ok: true, generated: true, provider: id, text, requiresApproval: false };
}

describe('createKernel', () => {
  it('refuses with no_provider when nothing is registered', async () => {
    const result = await createStubKernel().run(request);

    expect(result.ok).toBe(false);
    expect(result.generated).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('no_provider');
    expect(result.message).toContain('draft');
  });

  it('never carries text on a refusal', async () => {
    const result = await createStubKernel().run(request);

    expect(result).not.toHaveProperty('text');
    expect(result.generated).toBe(false);
  });

  it('lists its roster without probing any adapter', () => {
    const probe = vi.fn(() => Promise.resolve(health('local', 'ready', false)));
    const kernel = createKernel([{ ...provider('local'), health: probe }]);

    expect(kernel.roster()).toEqual([{ id: 'local', label: 'local', external: false }]);
    expect(kernel.providers()).toEqual(['local']);
    expect(probe).not.toHaveBeenCalled();
  });

  it('reports the health each adapter claims for itself', async () => {
    const kernel = createKernel([provider('local'), provider('claude', { external: true })]);

    expect((await kernel.health()).map((entry) => entry.id)).toEqual(['local', 'claude']);
  });

  it('blocks an external provider under the default policy without calling it', async () => {
    const complete = vi.fn(() => Promise.resolve(completion('claude', 'text')));
    const kernel = createKernel([{ ...provider('claude', { external: true }), complete }]);

    const result = await kernel.run(request);

    expect(complete).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('policy_blocked');
  });

  it('calls an external provider once the policy allows it', async () => {
    const kernel = createKernel([
      provider('claude', { external: true, result: completion('claude', 'drafted') }),
    ]);

    const result = await kernel.run({ ...request, policy: { allowExternalCalls: true } });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.text).toBe('drafted');
    expect(result.generated).toBe(true);
  });

  it('owns the approval flag rather than letting a provider clear it', async () => {
    const kernel = createKernel([provider('local', { result: completion('local', 'drafted') })]);

    const gated = await kernel.run(request);
    const ungated = await kernel.run({ ...request, policy: { requiresApproval: false } });

    expect(gated.ok && gated.requiresApproval).toBe(true);
    expect(ungated.ok && ungated.requiresApproval).toBe(false);
  });

  it('falls through to the next adapter when the first refuses', async () => {
    const kernel = createKernel([
      provider('local'),
      provider('backup', { result: completion('backup', 'drafted') }),
    ]);

    const result = await kernel.run(request);

    expect(result.ok).toBe(true);
    expect(result.provider).toBe('backup');
  });

  it('honours the preference order before the registration order', async () => {
    const kernel = createKernel([
      provider('local', { result: completion('local', 'from local') }),
      provider('backup', { result: completion('backup', 'from backup') }),
    ]);

    const result = await kernel.run({ ...request, providerPreference: ['backup'] });

    expect(result.provider).toBe('backup');
  });

  it('returns the most explanatory refusal when every adapter declines', async () => {
    const kernel = createKernel([
      provider('flaky', { throws: new Error('socket hang up') }),
      provider('claude', {
        result: {
          ok: false,
          generated: false,
          reason: 'awaiting_credentials',
          message: 'Anthropic Claude is Awaiting Credentials.',
          provider: 'claude',
        },
      }),
    ]);

    const result = await kernel.run(request);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('awaiting_credentials');
    expect(result.message).toContain('Awaiting Credentials');
  });

  it('turns a thrown adapter into a refusal rather than an unhandled rejection', async () => {
    const kernel = createKernel([provider('flaky', { throws: new Error('socket hang up') })]);

    const result = await kernel.run(request);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('provider_error');
    expect(result.message).toBe('socket hang up');
    expect(result.provider).toBe('flaky');
  });

  it('names the adapter on a refusal that did not name itself', async () => {
    const kernel = createKernel([
      {
        ...provider('local'),
        complete: () =>
          Promise.resolve({
            ok: false,
            generated: false,
            reason: 'no_provider',
            message: 'nothing configured',
          } satisfies AgentResult),
      },
    ]);

    const result = await kernel.run(request);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.provider).toBe('local');
  });
});
