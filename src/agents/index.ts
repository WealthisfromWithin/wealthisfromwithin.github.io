import { createKernel, type AgentKernel } from './kernel';
import { createDefaultProviders } from './providers';

/**
 * The public kernel API. UI imports this module and nothing beneath it: the
 * adapters under `./providers` are off limits to `src/app`, `src/modules`, and
 * `src/ui` (eslint enforces the boundary), so a component can never learn which
 * vendor answered — or, as is the case today, which one refused.
 */

export const agentKernel: AgentKernel = createKernel(createDefaultProviders());

export * from './kernel';
