import type { LLMProvider } from '../kernel';
import { createCredentialedProviders } from './credentialed';
import { createLocalProvider, type LocalProviderConfig } from './local';

/**
 * The only sanctioned home for provider adapters (eslint enforces it). The
 * composition below is the whole registry: one local adapter that can run when
 * the operator points it at a runtime, and four hosted adapters that refuse.
 */

export interface AgentEnv {
  VITE_LOCAL_AI_URL?: string;
  VITE_LOCAL_AI_MODEL?: string;
}

export function readAgentEnv(env: AgentEnv = import.meta.env): LocalProviderConfig {
  return {
    endpoint: env.VITE_LOCAL_AI_URL,
    model: env.VITE_LOCAL_AI_MODEL,
  };
}

/**
 * Local first: preference order is "what can run without a secret", then the
 * hosted providers, which are external and refuse under the default policy.
 */
export function createDefaultProviders(config?: LocalProviderConfig): LLMProvider[] {
  return [createLocalProvider(config ?? readAgentEnv()), ...createCredentialedProviders()];
}

export { createLocalProvider, type LocalProviderConfig } from './local';
export {
  CREDENTIALED_PROVIDERS,
  createCredentialedProvider,
  createCredentialedProviders,
  type CredentialedProviderDefinition,
} from './credentialed';
