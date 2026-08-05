import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSovereign } from '@/app/context';
import {
  INTEGRATION_STATES,
  integrationCategoryLabel,
  integrationStateMeta,
} from '@/integrations/state';
import { relativeTime } from '@/lib/clock';
import { cn } from '@/lib/cn';
import { DemoBadge, SectionLabel, StatePill } from '@/ui/primitives';
import { buildHealthReport } from './health';

const statusTone = {
  operational: 'text-sentinel',
  degraded: 'text-gold',
  offline: 'text-faint',
} as const;

export function HealthPage() {
  const { dataset, ready } = useSovereign();
  const now = useMemo(() => new Date(), []);
  const report = useMemo(() => buildHealthReport(dataset), [dataset]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <header className="mb-5">
        <SectionLabel>Substrate</SectionLabel>
        <h1 className="mt-1 font-display text-2xl text-ivory">Health Monitor</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Everything on this page is derived from the Integration Registry. There is no probe, no
          ping, and no uptime number, so there is no green light to give.
        </p>

        <dl className="mt-4 flex flex-wrap items-baseline gap-x-8 gap-y-2 border-y border-line py-3">
          <div className="min-w-0">
            <dt className="label-caps text-faint">Substrate</dt>
            <dd className={cn('font-mono text-lg', statusTone[report.substrate.status])}>
              {report.substrate.status}
            </dd>
          </div>
          {INTEGRATION_STATES.map((state) => (
            <div key={state}>
              <dt className="label-caps text-faint">{integrationStateMeta[state].label}</dt>
              <dd className="font-mono text-lg text-ivory tabular-nums">{report.counts[state]}</dd>
            </div>
          ))}
          <div>
            <dt className="label-caps text-faint">Connectors</dt>
            <dd className="font-mono text-lg text-ivory tabular-nums">{report.total}</dd>
          </div>
        </dl>

        <p className="mt-2 font-mono text-xs text-muted">{report.substrate.statement}</p>
        <p className="mt-1 text-xs text-faint">{report.probe.statement}</p>
      </header>

      {!ready ? (
        <p className="text-sm text-faint italic">Opening the local store…</p>
      ) : (
        <div className="grid grid-cols-1 gap-x-10 gap-y-7 lg:grid-cols-2">
          <section aria-labelledby="health-substrate" className="min-w-0">
            <header className="mb-1.5 flex items-baseline gap-2 border-b border-line pb-1.5">
              <h2 id="health-substrate" className="font-display text-sm text-ivory">
                Substrate dependencies
              </h2>
              <span className="ml-auto font-mono text-[0.65rem] text-faint tabular-nums">
                {report.substrateMembers.length}
              </span>
            </header>
            <p className="mb-1 text-xs text-faint">
              The systems this surface depends on to do anything beyond render.
            </p>
            {report.substrateMembers.length === 0 ? (
              <p className="py-2 text-sm text-faint italic">
                No integration is marked as a substrate dependency.
              </p>
            ) : (
              <ul>
                {report.substrateMembers.map((integration) => (
                  <li
                    key={integration.id}
                    className="flex items-start gap-3 border-b border-line/60 py-2 last:border-b-0"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-ivory">{integration.name}</span>
                      <span className="mt-0.5 block text-xs leading-5 text-muted">
                        {integration.rationale}
                      </span>
                    </span>
                    <StatePill
                      tone={integrationStateMeta[integration.state].tone}
                      title={integrationStateMeta[integration.state].description}
                    >
                      {integrationStateMeta[integration.state].label}
                    </StatePill>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="health-categories" className="min-w-0">
            <header className="mb-1.5 flex items-baseline gap-2 border-b border-line pb-1.5">
              <h2 id="health-categories" className="font-display text-sm text-ivory">
                Registry by category
              </h2>
              <span className="ml-auto font-mono text-[0.65rem] text-faint tabular-nums">
                {report.categories.length}
              </span>
            </header>
            <p className="mb-1 text-xs text-faint">
              Counted from the registry. Connected stays at zero until a probe exists.
            </p>
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  <th className="label-caps pb-1.5 text-faint">Category</th>
                  <th className="label-caps pb-1.5 text-right text-faint">Conn.</th>
                  <th className="label-caps pb-1.5 text-right text-faint">Await</th>
                  <th className="label-caps pb-1.5 text-right text-faint">Off</th>
                </tr>
              </thead>
              <tbody>
                {report.categories.map((row) => (
                  <tr key={row.category} className="border-b border-line/60 last:border-b-0">
                    <td className="py-1.5 text-sm text-muted">
                      {integrationCategoryLabel[row.category]}
                    </td>
                    <td
                      className={cn(
                        'py-1.5 text-right font-mono text-xs tabular-nums',
                        row.counts.connected > 0 ? 'text-sentinel' : 'text-faint',
                      )}
                    >
                      {row.counts.connected}
                    </td>
                    <td className="py-1.5 text-right font-mono text-xs text-gold tabular-nums">
                      {row.counts.awaiting_credentials}
                    </td>
                    <td className="py-1.5 text-right font-mono text-xs text-faint tabular-nums">
                      {row.counts.disabled}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Link
              to="/integrations?state=awaiting_credentials"
              className="label-caps mt-3 inline-block border border-line px-2.5 py-1 text-muted transition-colors hover:border-gold/40 hover:text-ivory"
            >
              Open registry
            </Link>
          </section>

          <section aria-labelledby="health-blocked" className="min-w-0">
            <header className="mb-1.5 flex items-baseline gap-2 border-b border-line pb-1.5">
              <h2 id="health-blocked" className="font-display text-sm text-ivory">
                What cannot run
              </h2>
              <span className="ml-auto font-mono text-[0.65rem] text-faint tabular-nums">
                {report.blockedCapabilities.length}
              </span>
            </header>
            <p className="mb-1 text-xs text-faint">
              Capabilities the registry says are unavailable because credentials are missing.
            </p>
            {report.blockedCapabilities.length === 0 ? (
              <p className="py-2 text-sm text-faint italic">
                No capability is blocked on credentials.
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                {report.blockedCapabilities.map((entry) => (
                  <li
                    key={`${entry.integrationId}:${entry.capability}`}
                    className="flex items-baseline gap-2 border-b border-line/50 py-1"
                  >
                    <span className="truncate text-xs text-muted">{entry.capability}</span>
                    <span className="ml-auto shrink-0 font-mono text-[0.65rem] text-faint">
                      {entry.integrationName}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="health-events" className="min-w-0">
            <header className="mb-1.5 flex items-baseline gap-2 border-b border-line pb-1.5">
              <h2 id="health-events" className="font-display text-sm text-ivory">
                Recorded events
              </h2>
              <span className="ml-auto font-mono text-[0.65rem] text-faint tabular-nums">
                {report.events.length}
              </span>
            </header>
            <p className="mb-1 text-xs text-faint">
              The local activity log, newest first. Approval decisions land here. This is not
              telemetry — no system reports into it.
            </p>
            {report.events.length === 0 ? (
              <p className="py-2 text-sm text-faint italic">No events recorded.</p>
            ) : (
              <ul>
                {report.events.map((event) => (
                  <li
                    key={event.id}
                    className="flex items-start gap-3 border-b border-line/60 py-1.5 last:border-b-0"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-baseline gap-2">
                        <span className="min-w-0 flex-1 text-sm text-muted">{event.title}</span>
                        {event.source === 'demo' ? <DemoBadge /> : null}
                      </span>
                      {event.detail ? (
                        <span className="mt-0.5 block text-xs leading-5 text-faint">
                          {event.detail}
                        </span>
                      ) : null}
                    </span>
                    <span className="w-24 shrink-0 text-right font-mono text-[0.65rem] text-faint">
                      {relativeTime(event.at, now)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
