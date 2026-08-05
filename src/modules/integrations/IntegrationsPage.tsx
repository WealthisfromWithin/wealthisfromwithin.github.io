import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSovereign } from '@/app/context';
import type { Integration, IntegrationState } from '@/domain';
import {
  countByState,
  deriveSubstrateHealth,
  INTEGRATION_STATES,
  integrationCategoryLabel,
  integrationStateMeta,
  stateFilterLabel,
} from '@/integrations/state';
import { cn } from '@/lib/cn';
import { SectionLabel, StatePill } from '@/ui/primitives';

type Filter = IntegrationState | 'all';

function isFilter(value: string | null): value is Filter {
  return (
    value === 'all' ||
    value === 'connected' ||
    value === 'disabled' ||
    value === 'awaiting_credentials'
  );
}

function IntegrationRow({ integration }: { integration: Integration }) {
  const meta = integrationStateMeta[integration.state];

  return (
    <tr className="border-b border-line/60 align-top last:border-b-0">
      <td className="py-2.5 pr-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-ivory">{integration.name}</span>
          {integration.substrate ? (
            <span className="label-caps text-faint" title="Substrate dependency">
              substrate
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-xs leading-5 text-muted">{integration.rationale}</p>
      </td>
      <td className="py-2.5 pr-4 whitespace-nowrap">
        <StatePill tone={meta.tone} title={meta.description}>
          {meta.label}
        </StatePill>
      </td>
      <td className="py-2.5 pr-4 text-xs text-faint">
        {integrationCategoryLabel[integration.category]}
      </td>
      <td className="py-2.5 font-mono text-[0.65rem] text-faint">
        {integration.capabilities.length > 0 ? integration.capabilities.join(' · ') : '—'}
      </td>
    </tr>
  );
}

export function IntegrationsPage() {
  const { dataset, ready } = useSovereign();
  const [searchParams, setSearchParams] = useSearchParams();

  const rawFilter = searchParams.get('state');
  const filter: Filter = isFilter(rawFilter) ? rawFilter : 'all';

  const counts = useMemo(() => countByState(dataset.integrations), [dataset.integrations]);
  const health = deriveSubstrateHealth(dataset.integrations);

  const rows = useMemo(
    () =>
      [...dataset.integrations]
        .filter((integration) => filter === 'all' || integration.state === filter)
        .sort((a, b) => {
          if (a.state !== b.state) {
            return INTEGRATION_STATES.indexOf(a.state) - INTEGRATION_STATES.indexOf(b.state);
          }
          return a.name.localeCompare(b.name);
        }),
    [dataset.integrations, filter],
  );

  const filters: Filter[] = ['all', ...INTEGRATION_STATES];

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <header className="mb-5">
        <SectionLabel>Registry</SectionLabel>
        <h1 className="mt-1 font-display text-2xl text-ivory">Integrations</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Every connector is exactly one of Connected, Disabled, or Awaiting Credentials. Nothing is
          marked Connected without a verified health probe, and no probe exists yet on this surface.
        </p>

        <dl className="mt-4 flex flex-wrap items-baseline gap-x-8 gap-y-2 border-y border-line py-3">
          {INTEGRATION_STATES.map((state) => (
            <div key={state}>
              <dt className="label-caps text-faint">{integrationStateMeta[state].label}</dt>
              <dd className="font-mono text-lg text-ivory tabular-nums">{counts[state]}</dd>
            </div>
          ))}
          <div className="min-w-0">
            <dt className="label-caps text-faint">Substrate</dt>
            <dd
              className={cn(
                'font-mono text-xs',
                health.status === 'operational' ? 'text-sentinel' : 'text-faint',
              )}
            >
              {health.statement}
            </dd>
          </div>
        </dl>
      </header>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {filters.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setSearchParams(value === 'all' ? {} : { state: value });
            }}
            className={cn(
              'label-caps border px-2.5 py-1 transition-colors',
              filter === value
                ? 'border-gold/60 bg-gold-faint text-ivory'
                : 'border-line text-faint hover:border-gold/40 hover:text-muted',
            )}
          >
            {stateFilterLabel(value)}
          </button>
        ))}
        <p className="ml-auto text-xs text-faint">
          Credentials are configured on the Command API, never in this bundle.{' '}
          <Link to="/settings" className="text-gold hover:text-ivory">
            Settings
          </Link>
        </p>
      </div>

      {!ready ? (
        <p className="text-sm text-faint italic">Opening the local store…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-faint italic">No integrations in this state.</p>
      ) : (
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              <th className="label-caps pb-2 text-faint">Integration</th>
              <th className="label-caps pb-2 text-faint">State</th>
              <th className="label-caps pb-2 text-faint">Category</th>
              <th className="label-caps pb-2 text-faint">Capabilities</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((integration) => (
              <IntegrationRow key={integration.id} integration={integration} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
