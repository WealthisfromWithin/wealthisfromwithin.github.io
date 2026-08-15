/**
 * Agent Kernel boundary (ARCHITECTURE_AUDIT §5.6).
 *
 * The UI never imports a provider SDK. Every generation request goes through
 * this interface so provider choice, policy, and approval gates stay in one
 * place. The kernel's own contribution is refusal: it selects a provider,
 * applies the WITHIN policy, and reports honestly when nothing can run. It
 * never produces text of its own, so there is no path by which the surface can
 * show a completion that no provider generated.
 */

export type ProviderId = 'claude' | 'openai' | 'gemini' | 'openrouter' | 'local' | (string & {});

export interface CompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AgentPolicy {
  /** WITHIN constitution default: customer-facing output requires a human gate. */
  requiresApproval: boolean;
  /**
   * Whether a turn may leave the browser for a third-party API. Off by default:
   * a static bundle holds no credentials, and a call it cannot authenticate is
   * a call it should not attempt.
   */
  allowExternalCalls: boolean;
}

export const defaultPolicy: AgentPolicy = {
  requiresApproval: true,
  allowExternalCalls: false,
};

export interface AgentRequest {
  intent: string;
  messages: CompletionMessage[];
  providerPreference?: ProviderId[];
  policy?: Partial<AgentPolicy>;
}

/**
 * Why a turn did not run.
 *
 * - `no_provider` — nothing is registered, or nothing is configured.
 * - `awaiting_credentials` — an adapter exists and has no credentials to use.
 * - `policy_blocked` — the policy forbade the only providers that could run it.
 * - `provider_error` — a configured provider was reached and failed.
 */
export type AgentRefusalReason =
  | 'no_provider'
  | 'awaiting_credentials'
  | 'policy_blocked'
  | 'provider_error';

export type AgentResult =
  | {
      ok: true;
      /** Always true on this branch: text on a successful result came from a provider. */
      generated: true;
      provider: ProviderId;
      text: string;
      requiresApproval: boolean;
    }
  | {
      ok: false;
      /** Always false: a refusal never carries fabricated text. */
      generated: false;
      reason: AgentRefusalReason;
      message: string;
      provider?: ProviderId;
    };

/**
 * What a provider can honestly say about itself without being called.
 * `ready` is only legal after the adapter has something to run with.
 */
export type ProviderHealthState =
  | 'ready'
  | 'unconfigured'
  | 'awaiting_credentials'
  | 'unreachable'
  | 'disabled';

export interface ProviderHealth {
  id: ProviderId;
  label: string;
  state: ProviderHealthState;
  /** Kept from Wave 1. True only for `ready`; nothing else is reachable. */
  reachable: boolean;
  /** True when completing would leave the browser for a third-party API. */
  external: boolean;
  detail: string;
}

export interface ProviderDescriptor {
  id: ProviderId;
  label: string;
  /**
   * True when completing leaves this machine. The kernel treats it as the whole
   * truth about an adapter — `allowExternalCalls` is checked against nothing
   * else — so an adapter may only declare `false` if it has proven every
   * request it can make stays on the loopback interface, whatever its
   * configuration says. See `createLocalProvider`, which refuses a
   * non-loopback endpoint rather than lowering the claim to `true`.
   */
  external: boolean;
}

export interface LLMProvider extends ProviderDescriptor {
  complete(request: AgentRequest): Promise<AgentResult>;
  health(): Promise<ProviderHealth>;
}

export interface AgentKernel {
  run(request: AgentRequest): Promise<AgentResult>;
  providers(): ProviderId[];
  /** Registered adapters without probing any of them. */
  roster(): ProviderDescriptor[];
  health(): Promise<ProviderHealth[]>;
}

/** Preference order first, then registration order, with no provider listed twice. */
function orderProviders(
  providers: readonly LLMProvider[],
  preference: readonly ProviderId[] | undefined,
): LLMProvider[] {
  if (!preference || preference.length === 0) return [...providers];
  const preferred = preference
    .map((id) => providers.find((provider) => provider.id === id))
    .filter((provider): provider is LLMProvider => provider !== undefined);
  return [...preferred, ...providers.filter((provider) => !preferred.includes(provider))];
}

/** Later reasons only replace earlier ones when they explain more. */
const reasonRank: Record<AgentRefusalReason, number> = {
  provider_error: 0,
  awaiting_credentials: 1,
  policy_blocked: 2,
  no_provider: 3,
};

function refusal(
  reason: AgentRefusalReason,
  message: string,
  provider?: ProviderId,
): Extract<AgentResult, { ok: false }> {
  return { ok: false, generated: false, reason, message, provider };
}

/**
 * Builds a kernel over the adapters it is given. An empty registry is the
 * honest default: it refuses rather than fabricating output, matching the
 * ContentDone "skip when unconfigured" pattern.
 */
export function createKernel(providers: readonly LLMProvider[] = []): AgentKernel {
  const registered = [...providers];

  return {
    providers: () => registered.map((provider) => provider.id),
    roster: () =>
      registered.map(({ id, label, external }) => ({ id, label, external })),
    health: () => Promise.all(registered.map((provider) => provider.health())),
    run: async (request) => {
      const policy: AgentPolicy = { ...defaultPolicy, ...request.policy };
      const candidates = orderProviders(registered, request.providerPreference);

      if (candidates.length === 0) {
        return refusal(
          'no_provider',
          `No model provider is registered for intent "${request.intent}". Every provider is Awaiting Credentials in the integration registry.`,
        );
      }

      const refusals: Extract<AgentResult, { ok: false }>[] = [];

      for (const provider of candidates) {
        if (provider.external && !policy.allowExternalCalls) {
          refusals.push(
            refusal(
              'policy_blocked',
              `${provider.label} is an external provider and this policy does not allow external calls.`,
              provider.id,
            ),
          );
          continue;
        }

        let result: AgentResult;
        try {
          result = await provider.complete(request);
        } catch (cause) {
          refusals.push(
            refusal(
              'provider_error',
              cause instanceof Error ? cause.message : `${provider.label} failed.`,
              provider.id,
            ),
          );
          continue;
        }

        // The kernel owns the approval flag: a provider does not get to decide
        // that its output skips the human gate.
        if (result.ok) return { ...result, requiresApproval: policy.requiresApproval };
        refusals.push({ ...result, provider: result.provider ?? provider.id });
      }

      // The most explanatory refusal wins: "awaiting credentials" tells the
      // operator more than the error of a provider they never configured.
      return (
        [...refusals].sort((a, b) => reasonRank[b.reason] - reasonRank[a.reason])[0] ??
        refusal('no_provider', `No provider could run intent "${request.intent}".`)
      );
    },
  };
}

/** Honest stub: a kernel with nothing behind it. */
export function createStubKernel(): AgentKernel {
  return createKernel([]);
}
