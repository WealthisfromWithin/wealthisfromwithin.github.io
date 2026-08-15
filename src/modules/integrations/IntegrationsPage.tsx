import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSovereign } from '@/app/context';
import type { Integration, IntegrationState } from '@/domain';
import {
  categoryFilterLabel,
  countByState,
  deriveSubstrateHealth,
  effectiveIntegrationState,
  INTEGRATION_CATEGORY_FILTERS,
  INTEGRATION_STATES,
  integrationCategoryLabel,
  integrationStateMeta,
  stateFilterLabel,
  type IntegrationCategoryFilter,
} from '@/integrations/state';
import { cn } from '@/lib/cn';
import { SectionLabel, StatePill } from '@/ui/primitives';
import { IntegrationTabs } from './IntegrationTabs';

type Filter = IntegrationState | 'all';

function isFilter(value: string | null): value is Filter {
  return (
    value === 'all' ||
    value === 'connected' ||
    value === 'disabled' ||
    value === 'awaiting_credentials'
  );
}

function parseCategory(value: string | null): IntegrationCategoryFilter {
  return INTEGRATION_CATEGORY_FILTERS.find((option) => option === value) ?? 'all';
}

function IntegrationRow({ integration }: { integration: Integration }) {
  const meta = integrationStateMeta[effectiveIntegrationState(integration)];

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
        <span className="mt-0.5 block">
          {integration.lastProbedAt === undefined
            ? 'never probed'
            : `probed ${integration.lastProbedAt.slice(0, 10)}`}
        </span>
      </td>
    </tr>
  );
}

export function IntegrationsPage() {
  const { dataset, ready } = useSovereign();
  const [searchParams, setSearchParams] = useSearchParams();

  const rawFilter = searchParams.get('state');
  const filter: Filter = isFilter(rawFilter) ? rawFilter : 'all';
  const category = parseCategory(searchParams.get('category'));

  const counts = useMemo(() => countByState(dataset.integrations), [dataset.integrations]);
  const health = deriveSubstrateHealth(dataset.integrations);

  const rows = useMemo(
    () =>
      [...dataset.integrations]
        .filter(
          (integration) => filter === 'all' || effectiveIntegrationState(integration) === filter,
        )
        .filter((integration) => category === 'all' || integration.category === category)
        .sort((a, b) => {
          const left = effectiveIntegrationState(a);
          const right = effectiveIntegrationState(b);
          if (left !== right) {
            return INTEGRATION_STATES.indexOf(left) - INTEGRATION_STATES.indexOf(right);
          }
          return a.name.localeCompare(b.name);
        }),
    [dataset.integrations, filter, category],
  );

  const filters: Filter[] = ['all', ...INTEGRATION_STATES];

  /** Both filters live in the URL, so a filtered registry is a shareable link. */
  function params(next: { state?: Filter; category?: IntegrationCategoryFilter }): URLSearchParams {
    const search = new URLSearchParams();
    const state = next.state ?? filter;
    const nextCategory = next.category ?? category;
    if (state !== 'all') search.set('state', state);
    if (nextCategory !== 'all') search.set('category', nextCategory);
    return search;
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <header className="mb-5">
        <SectionLabel>Registry</SectionLabel>
        <h1 className="mt-1 font-display text-2xl text-ivory">Integrations</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Every connector is exactly one of Connected, Disabled, or Awaiting Credentials. Connected
          requires the timestamp of the probe that verified it: a row claiming it without one is
          read as Awaiting Credentials here and everywhere else. The only probe this bundle can run
          is the Command API health check on{' '}
          <Link to="/sync" className="text-gold hover:text-ivory">
            Sync
          </Link>
          .
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
              <Link to="/health" className="hover:text-ivory">
                {health.statement}
              </Link>
            </dd>
          </div>
        </dl>
      </header>

      <IntegrationTabs />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {filters.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setSearchParams(params({ state: value }));
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

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {INTEGRATION_CATEGORY_FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setSearchParams(params({ category: value }));
            }}
            className={cn(
              'label-caps border px-2 py-0.5 transition-colors',
              category === value
                ? 'border-gold/50 text-gold'
                : 'border-line text-faint hover:border-gold/40 hover:text-muted',
            )}
          >
            {categoryFilterLabel(value)}
          </button>
        ))}
      </div>

      {!ready ? (
        <p className="text-sm text-faint italic">Opening the local store…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-faint italic">
          No connector matches {stateFilterLabel(filter).toLowerCase()} in{' '}
          {categoryFilterLabel(category).toLowerCase()}.
        </p>
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
