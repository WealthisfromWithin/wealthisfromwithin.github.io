import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSovereign } from '@/app/context';
import { mcpServers, mcpSummary, mcpTransportLabel } from '@/integrations/mcp';
import { integrationStateMeta } from '@/integrations/state';
import { DemoBadge, EmptyLine, Panel, SectionLabel, StatePill } from '@/ui/primitives';
import { IntegrationTabs } from './IntegrationTabs';

/**
 * The MCP panel. It reports state and declared intent, and nothing else: no
 * transport is opened from this bundle, so a tool list, a latency, or a "healthy"
 * badge would be invention. The three legal states are the registry's own.
 */
export function McpPage() {
  const { dataset, ready } = useSovereign();

  const rows = useMemo(() => mcpServers(dataset.integrations), [dataset.integrations]);
  const summary = useMemo(() => mcpSummary(dataset.integrations), [dataset.integrations]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <header className="mb-5">
        <SectionLabel>Registry</SectionLabel>
        <h1 className="mt-1 font-display text-2xl text-ivory">MCP Servers</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Model Context Protocol servers the operation depends on or has considered. Each row is
          exactly one of Connected, Disabled, or Awaiting Credentials, read from the same registry
          as every other connector. This bundle ships no MCP client: nothing here is pinged, no tool
          list is fetched, and Connected would require a verified probe that does not exist yet.
        </p>

        <dl className="mt-4 flex flex-wrap items-baseline gap-x-8 gap-y-2 border-y border-line py-3">
          <div>
            <dt className="label-caps text-faint">Declared</dt>
            <dd className="font-mono text-lg text-ivory tabular-nums">{summary.total}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Connected</dt>
            <dd className="font-mono text-lg text-sentinel tabular-nums">{summary.connected}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Awaiting credentials</dt>
            <dd className="font-mono text-lg text-gold tabular-nums">{summary.awaiting}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Disabled</dt>
            <dd className="font-mono text-lg text-muted tabular-nums">{summary.disabled}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Run by this operation</dt>
            <dd className="font-mono text-lg text-muted tabular-nums">{summary.firstParty}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-faint">{summary.statement}</p>
      </header>

      <IntegrationTabs />

      {!ready ? (
        <p className="text-sm text-faint italic">Opening the local store…</p>
      ) : rows.length === 0 ? (
        <EmptyLine>No MCP server is declared in the registry.</EmptyLine>
      ) : (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {rows.map((row) => (
            <li key={row.integration.id} className="border border-line bg-surface/50 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-ivory">{row.integration.name}</span>
                {row.integration.source === 'demo' ? <DemoBadge /> : null}
                <StatePill tone={row.tone} title={integrationStateMeta[row.state].description}>
                  {row.stateLabel}
                </StatePill>
                {row.integration.substrate ? (
                  <span className="label-caps text-faint" title="Substrate dependency">
                    substrate
                  </span>
                ) : null}
                <span className="label-caps ml-auto text-faint">
                  {row.profile?.ownership === 'vendor' ? 'vendor' : 'first party'}
                </span>
              </div>

              <p className="mt-1 text-xs leading-5 text-muted">
                {row.profile?.purpose ?? row.integration.rationale}
              </p>
              <p className="mt-1 text-xs leading-5 text-faint">{row.profile?.gap ?? row.statement}</p>

              <p className="mt-1.5 font-mono text-[0.65rem] text-faint">
                {mcpTransportLabel[row.profile?.transport ?? 'unknown']}
                {row.integration.capabilities.length > 0
                  ? ` · ${row.integration.capabilities.join(' · ')}`
                  : ''}
                {row.integration.lastProbedAt === undefined ? ' · never probed' : ''}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="What this panel will not do">
          <ul className="space-y-1.5 text-xs leading-5 text-muted">
            <li>
              Show Connected without a verified probe. The state comes from the registry, and the
              registry has never probed anything from this surface.
            </li>
            <li>
              Enumerate tools, resources, or prompts. Those come from a live handshake, and no
              handshake happens here.
            </li>
            <li>
              Hold a credential. Nothing secret belongs in a static bundle, so tokens and endpoints
              are configured on the Command API instead —{' '}
              <Link to="/settings" className="text-gold hover:text-ivory">
                Settings
              </Link>{' '}
              says where.
            </li>
          </ul>
        </Panel>
        <Panel title="What would have to change">
          <ul className="space-y-1.5 text-xs leading-5 text-muted">
            <li>
              A server has to exist and be reachable. Three of the rows above are the operation's own
              servers, and none of them is built yet.
            </li>
            <li>
              A probe has to run somewhere that can hold a credential — the Command API of Wave 7 —
              and write its result back into the registry.
            </li>
            <li>
              Only then does a state change to Connected, and only for the server that answered.{' '}
              <Link to="/health" className="text-gold hover:text-ivory">
                Health Monitor
              </Link>{' '}
              reads the same rows.
            </li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
