/**
 * Agent Kernel boundary (ARCHITECTURE_AUDIT §5.6).
 *
 * The UI never imports a provider SDK. Every generation request goes through
 * this interface so provider choice, policy, and approval gates stay in one
 * place. Wave 1 ships the interface and an unavailable stub only — there are no
 * live model calls from the Command Surface.
 */

export type ProviderId = 'claude' | 'openai' | 'gemini' | 'openrouter' | 'local' | (string & {});

export interface CompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AgentPolicy {
  /** WITHIN constitution default: customer-facing output requires a human gate. */
  requiresApproval: boolean;
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

export type AgentResult =
  | { ok: true; provider: ProviderId; text: string; requiresApproval: boolean }
  | { ok: false; reason: 'no_provider' | 'policy_blocked' | 'provider_error'; message: string };

export interface ProviderHealth {
  id: ProviderId;
  reachable: boolean;
  detail: string;
}

export interface LLMProvider {
  id: ProviderId;
  complete(request: AgentRequest): Promise<AgentResult>;
  health(): Promise<ProviderHealth>;
}

export interface AgentKernel {
  run(request: AgentRequest): Promise<AgentResult>;
  providers(): ProviderId[];
  health(): Promise<ProviderHealth[]>;
}

/**
 * Honest stub. It refuses rather than fabricating output, matching the
 * ContentDone "skip when unconfigured" pattern.
 */
export function createStubKernel(): AgentKernel {
  return {
    providers: () => [],
    health: () => Promise.resolve([]),
    run: (request) =>
      Promise.resolve({
        ok: false,
        reason: 'no_provider',
        message: `No model provider is configured for intent "${request.intent}". Configure credentials in Settings; every provider is currently Awaiting Credentials.`,
      }),
  };
}

export const agentKernel: AgentKernel = createStubKernel();
