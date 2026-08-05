import { z } from 'zod';
import type { AgentRequest, AgentResult, LLMProvider, ProviderHealth } from '../kernel';

/**
 * The local provider: an Ollama-shaped endpoint on the operator's own machine.
 *
 * It is the only adapter that can ever succeed from this bundle, because it is
 * the only one that needs no secret — the endpoint is a loopback URL, not a
 * credential. With no endpoint configured it refuses with `no_provider` and
 * says which variable would configure it. It never returns text it did not
 * receive from the endpoint.
 */

export interface LocalProviderConfig {
  /** Base URL of the local runtime, e.g. `http://localhost:11434`. */
  endpoint?: string;
  model?: string;
  /** Injected in tests. Defaults to the ambient `fetch` when one exists. */
  fetchImpl?: typeof fetch;
  /** Guards a hung local runtime from freezing the surface. */
  timeoutMs?: number;
}

const DEFAULT_MODEL = 'llama3.1';
const DEFAULT_TIMEOUT_MS = 20_000;

/** Ollama's `/api/chat` response, narrowed to the field this adapter reads. */
const chatResponseSchema = z.object({
  message: z.object({ content: z.string() }),
});

function trimEndpoint(endpoint: string): string {
  return endpoint.replace(/\/+$/, '');
}

function unavailable(detail: string): ProviderHealth {
  return {
    id: 'local',
    label: 'Local model',
    state: 'unconfigured',
    reachable: false,
    external: false,
    detail,
  };
}

export function createLocalProvider(config: LocalProviderConfig = {}): LLMProvider {
  const endpoint = config.endpoint?.trim();
  const model = config.model ?? DEFAULT_MODEL;
  const fetchImpl = config.fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined);
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const missing =
    endpoint === undefined || endpoint.length === 0
      ? 'No local model endpoint is configured. Set VITE_LOCAL_AI_URL to a runtime on this machine.'
      : fetchImpl === undefined
        ? 'This runtime has no fetch implementation, so the local endpoint cannot be reached.'
        : null;

  return {
    id: 'local',
    label: 'Local model',
    external: false,

    health: async () => {
      if (missing !== null || endpoint === undefined || fetchImpl === undefined) {
        return unavailable(missing ?? 'Not configured.');
      }
      try {
        const response = await fetchImpl(`${trimEndpoint(endpoint)}/api/tags`, {
          method: 'GET',
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!response.ok) {
          return {
            id: 'local',
            label: 'Local model',
            state: 'unreachable',
            reachable: false,
            external: false,
            detail: `${endpoint} answered ${String(response.status)}.`,
          };
        }
        return {
          id: 'local',
          label: 'Local model',
          state: 'ready',
          reachable: true,
          external: false,
          detail: `${endpoint} answered a probe. Model ${model}.`,
        };
      } catch (cause) {
        return {
          id: 'local',
          label: 'Local model',
          state: 'unreachable',
          reachable: false,
          external: false,
          detail: cause instanceof Error ? cause.message : `${endpoint} did not answer.`,
        };
      }
    },

    complete: async (request: AgentRequest): Promise<AgentResult> => {
      if (missing !== null || endpoint === undefined || fetchImpl === undefined) {
        return {
          ok: false,
          generated: false,
          reason: 'no_provider',
          message: missing ?? 'The local provider is not configured.',
          provider: 'local',
        };
      }

      let payload: unknown;
      try {
        const response = await fetchImpl(`${trimEndpoint(endpoint)}/api/chat`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ model, stream: false, messages: request.messages }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!response.ok) {
          return {
            ok: false,
            generated: false,
            reason: 'provider_error',
            message: `The local runtime answered ${String(response.status)}.`,
            provider: 'local',
          };
        }
        payload = await response.json();
      } catch (cause) {
        return {
          ok: false,
          generated: false,
          reason: 'provider_error',
          message: cause instanceof Error ? cause.message : 'The local runtime did not answer.',
          provider: 'local',
        };
      }

      const parsed = chatResponseSchema.safeParse(payload);
      if (!parsed.success) {
        return {
          ok: false,
          generated: false,
          reason: 'provider_error',
          message: 'The local runtime answered in a shape this adapter does not recognise.',
          provider: 'local',
        };
      }

      return {
        ok: true,
        generated: true,
        provider: 'local',
        text: parsed.data.message.content,
        // Overwritten by the kernel, which owns the policy.
        requiresApproval: true,
      };
    },
  };
}
