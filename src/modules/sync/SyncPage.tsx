import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSovereign } from '@/app/context';
import { countDemoRows } from '@/data/dataset';
import { recordIntegrationProbe } from '@/data/mutations';
import { effectiveIntegrationState, integrationStateMeta } from '@/integrations/state';
import { cn } from '@/lib/cn';
import { DemoBadge, EmptyLine, Panel, SectionLabel, StatePill } from '@/ui/primitives';
import {
  COMMAND_API_INTEGRATION_ID,
  HEALTH_PATH,
  probeCommandApi,
  readSyncEnv,
  resolveApiBaseUrl,
  syncCapabilities,
  syncStateTone,
  syncStatus,
  type ProbeRecord,
} from './sync';

/**
 * The Command API Sync surface.
 *
 * It is deliberately small. Three states, one button, one recorded result, and
 * a list of the things it cannot do. The page never says "synced", never shows
 * a record count it pulled, and makes no request until the operator asks — and
 * then only when the build was configured with a base URL it accepted.
 */
export function SyncPage() {
  const { dataset, ready } = useSovereign();
  const config = useMemo(() => resolveApiBaseUrl(readSyncEnv()), []);
  const [probe, setProbe] = useState<ProbeRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const status = syncStatus(config, probe);
  const capabilities = syncCapabilities();
  const row = dataset.integrations.find(
    (integration) => integration.id === COMMAND_API_INTEGRATION_ID,
  );
  const registryState = row ? effectiveIntegrationState(row) : undefined;
  const demoRows = countDemoRows(dataset);

  function runProbe() {
    setBusy(true);
    setMessage(null);
    void probeCommandApi(config)
      .then(async (result) => {
        setProbe(result);
        const written = await recordIntegrationProbe(COMMAND_API_INTEGRATION_ID, {
          verified: result.verified,
          at: result.at,
          detail: result.detail,
        });
        setMessage(
          written.ok
            ? `Probe recorded against the registry row. It now reads ${
                integrationStateMeta[written.state ?? 'awaiting_credentials'].label
              }.`
            : (written.reason ?? 'The probe result was not recorded.'),
        );
      })
      .catch((cause: unknown) => {
        setMessage(cause instanceof Error ? cause.message : 'The probe failed to run.');
      })
      .finally(() => {
        setBusy(false);
      });
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <header className="mb-5">
        <SectionLabel>Substrate</SectionLabel>
        <h1 className="mt-1 font-display text-2xl text-ivory">Command API Sync</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          The adapter between this surface and a Command API. It can do exactly one thing today: ask
          a configured origin whether <span className="font-mono text-xs">{HEALTH_PATH}</span>{' '}
          answers, and record the answer with the time it was asked. It moves no record in either
          direction, and there is no code path here that could report a sync that did not happen.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3 border-y border-line py-3">
          <StatePill tone={syncStateTone[status.state]}>{status.label}</StatePill>
          {status.host ? (
            <span className="font-mono text-[0.65rem] text-faint">{status.host}</span>
          ) : null}
          <span className="font-mono text-[0.65rem] text-faint">
            {status.lastProbedAt === undefined
              ? 'never probed'
              : `probed ${status.lastProbedAt.slice(0, 19).replace('T', ' ')}Z`}
          </span>
        </div>
        <p
          className={cn(
            'mt-2 max-w-3xl text-sm',
            status.state === 'connected'
              ? 'text-sentinel'
              : status.state === 'awaiting_credentials'
                ? 'text-gold'
                : 'text-muted',
          )}
        >
          {status.statement}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Health probe">
          <p className="text-xs leading-5 text-muted">
            {status.canProbe
              ? `A single GET to ${HEALTH_PATH}, with credentials omitted and no headers attached. A 2xx proves the origin answered — nothing about authorisation, and nothing about data.`
              : 'There is nothing to probe. This build shipped without a Command API base URL, so the button below stays off and no request is made from this page.'}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!status.canProbe || busy}
              onClick={runProbe}
              className={cn(
                'label-caps border px-2.5 py-1 transition-colors disabled:opacity-40',
                status.canProbe
                  ? 'border-gold/50 text-gold hover:border-gold hover:text-ivory'
                  : 'border-line text-faint',
              )}
            >
              {busy ? 'Probing…' : `Probe ${HEALTH_PATH}`}
            </button>
            {!status.canProbe ? (
              <span className="text-xs text-faint">
                Set <span className="font-mono">VITE_API_BASE_URL</span> at build time to enable it.
              </span>
            ) : null}
          </div>
          {message ? <p className="mt-2 text-xs text-muted">{message}</p> : null}
          {probe ? (
            <p className="mt-2 font-mono text-[0.65rem] text-faint">
              {probe.verified ? 'verified' : 'not verified'} · {probe.at}
              {probe.status === undefined ? '' : ` · HTTP ${String(probe.status)}`}
            </p>
          ) : null}
        </Panel>

        <Panel title="Registry row">
          {!ready ? (
            <EmptyLine>Opening the local store…</EmptyLine>
          ) : !row ? (
            <EmptyLine>The ContentDone API row is not in the local registry.</EmptyLine>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-ivory">{row.name}</span>
                {row.source === 'demo' ? <DemoBadge /> : null}
                <StatePill
                  tone={integrationStateMeta[registryState ?? 'awaiting_credentials'].tone}
                  title={integrationStateMeta[registryState ?? 'awaiting_credentials'].description}
                >
                  {integrationStateMeta[registryState ?? 'awaiting_credentials'].label}
                </StatePill>
              </div>
              <p className="mt-1.5 text-xs leading-5 text-muted">
                A probe result is written here, so the registry, the Health Monitor, and this page
                cannot disagree. Connected requires the timestamp of the probe that verified it: a
                row claiming it without one is read as Awaiting Credentials everywhere.
              </p>
              <p className="mt-1.5 font-mono text-[0.65rem] text-faint">
                {row.lastProbedAt === undefined
                  ? 'never probed'
                  : `probed ${row.lastProbedAt.slice(0, 10)}`}
              </p>
              <Link
                to="/integrations"
                className="label-caps mt-3 inline-block border border-line px-2.5 py-1 text-muted transition-colors hover:border-gold/40 hover:text-ivory"
              >
                Open registry
              </Link>
            </>
          )}
        </Panel>

        <Panel title="What this adapter does" className="lg:col-span-2">
          <ul className="space-y-2">
            {capabilities.map((capability) => (
              <li
                key={capability.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line/60 pb-2 last:border-b-0 last:pb-0"
              >
                <span className="text-sm text-ivory">{capability.label}</span>
                <StatePill tone={capability.implemented ? 'sentinel' : 'muted'}>
                  {capability.implemented ? 'Implemented' : 'Not implemented'}
                </StatePill>
                <span className="w-full text-xs leading-5 text-muted">{capability.detail}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Where the data actually is">
          <p className="text-xs leading-5 text-muted">
            Every record on every surface lives in this browser's IndexedDB, and{' '}
            <span className="font-mono tabular-nums">{ready ? demoRows : '—'}</span> of those rows
            are the badged demo seed. Clearing site data is a complete delete; there is no server
            copy to restore from and no export beyond the store controls in{' '}
            <Link to="/settings" className="text-gold hover:text-ivory">
              Settings
            </Link>
            .
          </p>
        </Panel>

        <Panel title="Why there is no sign-in">
          <p className="text-xs leading-5 text-muted">
            A static bundle cannot hold a secret: every <span className="font-mono">VITE_</span>{' '}
            variable is inlined into JavaScript anybody can read. So there is no account, no token,
            and no credential field anywhere in this deployment — and no private data is synced into
            it. Authentication and the credential vault belong to the Command API, and until it
            exists this surface stays demo-local by construction rather than by policy.
          </p>
        </Panel>
      </div>
    </div>
  );
}
