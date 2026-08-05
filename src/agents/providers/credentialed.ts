import type { AgentResult, LLMProvider, ProviderHealth, ProviderId } from '../kernel';

/**
 * Adapters for the hosted providers.
 *
 * They exist so the boundary is real — the roster the AI Workspace prints comes
 * from the kernel, not from a hard-coded list in a component — and they refuse
 * every call. A static bundle on GitHub Pages holds no secrets and can hold
 * none (ARCHITECTURE_AUDIT §5.9), so a key would have to be shipped publicly to
 * make one of these run. Until the Command API can hold credentials and sign a
 * request, the only honest answer is `awaiting_credentials`.
 *
 * There is deliberately no code path here that produces text.
 */

export interface CredentialedProviderDefinition {
  id: ProviderId;
  label: string;
  /** The integration registry row an operator would configure. */
  integrationId: string;
  detail: string;
}

export const CREDENTIALED_PROVIDERS: readonly CredentialedProviderDefinition[] = [
  {
    id: 'claude',
    label: 'Anthropic Claude',
    integrationId: 'anthropic',
    detail: 'Completions. Needs an API key held by the Command API, which does not exist yet.',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    integrationId: 'openai',
    detail: 'Completions and embeddings. Needs an API key held server-side.',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    integrationId: 'gemini',
    detail: 'Completions. No credential path exists from this surface.',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    integrationId: 'openrouter',
    detail: 'Provider routing. No credential path exists from this surface.',
  },
] as const;

export function createCredentialedProvider(
  definition: CredentialedProviderDefinition,
): LLMProvider {
  const health: ProviderHealth = {
    id: definition.id,
    label: definition.label,
    state: 'awaiting_credentials',
    reachable: false,
    external: true,
    detail: definition.detail,
  };

  const refusal: AgentResult = {
    ok: false,
    generated: false,
    reason: 'awaiting_credentials',
    message: `${definition.label} is Awaiting Credentials. This surface is a static bundle and holds no keys, so nothing was sent and nothing was generated.`,
    provider: definition.id,
  };

  return {
    id: definition.id,
    label: definition.label,
    external: true,
    health: () => Promise.resolve(health),
    complete: () => Promise.resolve(refusal),
  };
}

export function createCredentialedProviders(
  definitions: readonly CredentialedProviderDefinition[] = CREDENTIALED_PROVIDERS,
): LLMProvider[] {
  return definitions.map(createCredentialedProvider);
}
