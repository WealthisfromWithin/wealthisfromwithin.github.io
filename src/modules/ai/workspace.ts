import type { ProviderHealth, ProviderHealthState } from '@/agents';
import type { SovereignDataset } from '@/data/dataset';
import type { AgentMessage, AgentSession, Integration, Prompt } from '@/domain';

/* ── Sessions ───────────────────────────────────────────────────────────── */

export interface SessionThread {
  session: AgentSession;
  messages: AgentMessage[];
  prompt: Prompt | undefined;
  turns: number;
  /** Turns a provider actually produced. Zero whenever nothing is configured. */
  generated: number;
  refused: number;
}

export function selectSessions(dataset: SovereignDataset): AgentSession[] {
  return [...dataset.agentSessions].sort(
    (a, b) => Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt),
  );
}

export function sessionMessages(dataset: SovereignDataset, sessionId: string): AgentMessage[] {
  return dataset.agentMessages
    .filter((message) => message.sessionId === sessionId)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id));
}

export function sessionThread(
  dataset: SovereignDataset,
  session: AgentSession,
): SessionThread {
  const messages = sessionMessages(dataset, session.id);
  return {
    session,
    messages,
    prompt: dataset.prompts.find((prompt) => prompt.id === session.promptId),
    turns: messages.filter((message) => message.role === 'user').length,
    generated: messages.filter((message) => message.generated).length,
    refused: messages.filter((message) => message.outcome === 'refused').length,
  };
}

export function findSession(
  dataset: SovereignDataset,
  id: string | undefined,
): AgentSession | undefined {
  if (id === undefined) return undefined;
  return dataset.agentSessions.find((session) => session.id === id);
}

export interface WorkspaceCounts {
  sessions: number;
  turns: number;
  generated: number;
  refused: number;
}

export function workspaceCounts(dataset: SovereignDataset): WorkspaceCounts {
  return {
    sessions: dataset.agentSessions.length,
    turns: dataset.agentMessages.filter((message) => message.role === 'user').length,
    generated: dataset.agentMessages.filter((message) => message.generated).length,
    refused: dataset.agentMessages.filter((message) => message.outcome === 'refused').length,
  };
}

/** Sessions whose last exchange the kernel could not run. The Brief reads this. */
export function sessionsAwaitingProvider(dataset: SovereignDataset): AgentSession[] {
  return dataset.agentSessions
    .filter((session) => session.unansweredCount > 0 && session.closedAt === undefined)
    .sort((a, b) => Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt));
}

/* ── Provider status ────────────────────────────────────────────────────── */

export const providerStateLabel: Record<ProviderHealthState, string> = {
  ready: 'Ready',
  unconfigured: 'Not configured',
  awaiting_credentials: 'Awaiting credentials',
  unreachable: 'Unreachable',
  disabled: 'Disabled',
};

export function providerStateTone(
  state: ProviderHealthState,
): 'critical' | 'warning' | 'info' | 'neutral' | 'muted' | 'sentinel' | 'gold' {
  switch (state) {
    case 'ready':
      return 'sentinel';
    case 'awaiting_credentials':
      return 'gold';
    case 'unreachable':
      return 'critical';
    default:
      return 'muted';
  }
}

export interface ProviderStatusRow {
  health: ProviderHealth;
  /** The registry row an operator would configure, when the two line up. */
  integration: Integration | undefined;
}

/** Which integration row backs which adapter. Both surfaces then tell one story. */
const PROVIDER_INTEGRATION: Record<string, string> = {
  local: 'local-ai',
  claude: 'anthropic',
  openai: 'openai',
  gemini: 'gemini',
  openrouter: 'openrouter',
};

export function providerStatusRows(
  health: readonly ProviderHealth[],
  integrations: readonly Integration[],
): ProviderStatusRow[] {
  return health.map((entry) => ({
    health: entry,
    integration: integrations.find(
      (integration) => integration.id === PROVIDER_INTEGRATION[entry.id],
    ),
  }));
}

/** True when at least one adapter could run a turn right now. */
export function anyProviderReady(health: readonly ProviderHealth[]): boolean {
  return health.some((entry) => entry.state === 'ready');
}

/**
 * One sentence about the whole roster, for the surface to print before an
 * operator types anything. It never says "ready" unless an adapter is.
 */
export function providerSummary(health: readonly ProviderHealth[]): string {
  if (health.length === 0) return 'No provider adapter is registered.';
  const ready = health.filter((entry) => entry.state === 'ready');
  if (ready.length > 0) {
    return `${String(ready.length)} of ${String(health.length)} adapters can run a turn: ${ready
      .map((entry) => entry.label)
      .join(', ')}.`;
  }
  const awaiting = health.filter((entry) => entry.state === 'awaiting_credentials').length;
  return `No adapter can run a turn. ${String(awaiting)} awaiting credentials, ${String(
    health.length - awaiting,
  )} unconfigured or unreachable.`;
}
