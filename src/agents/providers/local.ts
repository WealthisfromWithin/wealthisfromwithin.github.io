import { z } from 'zod';
import { acceptLoopbackEndpoint, LOOPBACK_HOSTS } from '@/lib/endpoints';
import type { AgentRequest, AgentResult, LLMProvider, ProviderHealth } from '../kernel';

/**
 * The local provider: an Ollama-shaped endpoint on the operator's own machine.
 *
 * It is the only adapter that can ever succeed from this bundle, because it is
 * the only one that needs no secret — the endpoint is a loopback URL, not a
 * credential. With no endpoint configured it refuses with `no_provider` and
 * says which variable would configure it. It never returns text it did not
 * receive from the endpoint.
 *
 * That "loopback URL" is a claim the adapter has to earn. It reports
 * `external: false`, which is what tells the kernel a turn may run under
 * `allowExternalCalls: false`; if a build-time variable could aim the same
 * adapter at any host, the policy would be decided by an environment file
 * rather than by the kernel. So the endpoint is parsed and checked against the
 * loopback hosts **before** any request is built, and a non-loopback URL is
 * refused rather than probed: nothing is sent to it, not even a health probe.
 */

export interface LocalProviderConfig {
  /**
   * Base URL of the local runtime, e.g. `http://localhost:11434`. Only
   * loopback hosts are accepted; anything else is refused without a request.
   */
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

const NOT_CONFIGURED =
  'No local model endpoint is configured. Set VITE_LOCAL_AI_URL to a runtime on this machine.';

const NO_FETCH = 'This runtime has no fetch implementation, so the local endpoint cannot be reached.';

/** Either a base URL proven to be on this machine, or the reason it was refused. */
export type LocalEndpointCheck =
  | { readonly ok: true; readonly base: string }
  | { readonly ok: false; readonly detail: string };

/**
 * Turns the configured endpoint into this adapter's vocabulary. Whether the
 * value is acceptable is decided by `acceptLoopbackEndpoint`, which the Content
 * Security Policy builder also asks, so an endpoint this adapter refuses can
 * never appear in `connect-src` (`docs/reviews/WAVE_7_GPT_REVIEW.md` H2). The
 * returned base is rebuilt from the parsed URL — origin and path, no query,
 * fragment, or userinfo — so the paths this adapter appends are appended to
 * something it has already understood.
 */
export function resolveLocalEndpoint(raw: string | undefined): LocalEndpointCheck {
  const check = acceptLoopbackEndpoint(raw);
  if (check.ok) return { ok: true, base: check.base };

  switch (check.reason) {
    case 'missing':
      return { ok: false, detail: NOT_CONFIGURED };
    case 'unparsable':
      return {
        ok: false,
        detail:
          'VITE_LOCAL_AI_URL is not a URL this adapter can parse, so there is no local runtime to call. Set it to something like http://localhost:11434.',
      };
    case 'scheme':
      return {
        ok: false,
        detail: `VITE_LOCAL_AI_URL uses the ${(check.protocol ?? '').replace(/:$/, '')} scheme, which this adapter does not call. Set it to an http:// address on this machine, such as http://localhost:11434.`,
      };
    default:
      // The host is reported back, never the whole URL: a misconfigured value can
      // carry credentials in its userinfo, and this string is printed in the UI.
      return {
        ok: false,
        detail: `VITE_LOCAL_AI_URL points at ${check.host ?? 'another machine'}, which is not this machine. The local adapter only calls loopback hosts (${LOOPBACK_HOSTS.join(', ')}), so nothing was sent there — not even a probe — and no local runtime is available.`,
      };
  }
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
  const resolved = resolveLocalEndpoint(config.endpoint);
  const model = config.model ?? DEFAULT_MODEL;
  const fetchImpl = config.fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined);
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const endpoint = resolved.ok ? resolved.base : undefined;
  const missing = !resolved.ok ? resolved.detail : fetchImpl === undefined ? NO_FETCH : null;

  return {
    id: 'local',
    label: 'Local model',
    external: false,

    health: async () => {
      if (missing !== null || endpoint === undefined || fetchImpl === undefined) {
        return unavailable(missing ?? 'Not configured.');
      }
      try {
        const response = await fetchImpl(`${endpoint}/api/tags`, {
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
        const response = await fetchImpl(`${endpoint}/api/chat`, {
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
