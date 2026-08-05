import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSovereign } from '@/app/context';
import { enabledModules, plannedModules } from '@/app/modules';
import { db } from '@/data/db';
import { countDemoRows, countRows } from '@/data/dataset';
import { clearDemoData, resetLocalStore, seedDemoData } from '@/data/repositories';
import { SEED_VERSION } from '@/data/seedVersion';
import { useDemoOptOut } from '@/data/useDataset';
import { agentKernel } from '@/agents';
import { countByState } from '@/integrations/state';
import { readSyncEnv, resolveApiBaseUrl, syncStatus } from '@/modules/sync/sync';
import { Panel, SectionLabel, StatePill } from '@/ui/primitives';

type Busy = 'reseed' | 'clear' | 'reset' | null;

function StoreControls() {
  const { dataset, ready } = useSovereign();
  const optedOut = useDemoOptOut();
  const [busy, setBusy] = useState<Busy>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(action: Busy, work: () => Promise<void>, done: string) {
    setBusy(action);
    setMessage(null);
    try {
      await work();
      setMessage(done);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Operation failed.');
    } finally {
      setBusy(null);
    }
  }

  const demoRows = countDemoRows(dataset);

  return (
    <Panel title="Local store">
      <dl className="mb-3 flex flex-wrap gap-x-8 gap-y-2">
        <div>
          <dt className="label-caps text-faint">Engine</dt>
          <dd className="font-mono text-xs text-muted">IndexedDB · Dexie</dd>
        </div>
        <div>
          <dt className="label-caps text-faint">Seed version</dt>
          <dd className="font-mono text-xs text-muted">{SEED_VERSION}</dd>
        </div>
        <div>
          <dt className="label-caps text-faint">Demo rows</dt>
          <dd className="font-mono text-xs text-muted tabular-nums">
            {ready ? demoRows : '—'}
          </dd>
        </div>
        <div>
          <dt className="label-caps text-faint">Demo seed</dt>
          <dd className="font-mono text-xs text-muted">{optedOut ? 'Off (opted out)' : 'On'}</dd>
        </div>
      </dl>

      <p className="mb-3 text-xs text-muted">
        {optedOut
          ? 'Demo rows are removed and stay removed across reloads. Refresh demo data or reset the store to bring them back.'
          : 'Removing demo rows is durable: the seeder will not restore them on reload until you refresh demo data or reset the store.'}
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => {
            void run('reseed', () => seedDemoData(db, new Date()), 'Demo data refreshed.');
          }}
          className="label-caps border border-line px-2.5 py-1 text-muted transition-colors hover:border-gold/40 hover:text-ivory disabled:opacity-40"
        >
          Refresh demo data
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => {
            void run(
              'clear',
              () => clearDemoData(db),
              'Demo rows removed. They stay removed across reloads.',
            );
          }}
          className="label-caps border border-line px-2.5 py-1 text-muted transition-colors hover:border-gold/40 hover:text-ivory disabled:opacity-40"
        >
          Remove demo rows
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => {
            void run(
              'reset',
              async () => {
                await resetLocalStore(db);
                await seedDemoData(db, new Date());
              },
              'Local store rebuilt.',
            );
          }}
          className="label-caps border border-alert/40 px-2.5 py-1 text-alert/90 transition-colors hover:border-alert hover:text-alert disabled:opacity-40"
        >
          Reset store
        </button>
      </div>

      {message ? <p className="mt-2 text-xs text-muted">{message}</p> : null}
    </Panel>
  );
}

/**
 * Which mode this deployment is running in, and what that means for the data.
 *
 * "Demo mode" has meant two different things across the waves — badged seed rows
 * and no backend — and conflating them is how an operator ends up believing
 * their own records are somewhere else. So this panel separates them: the seed
 * is a switch the operator controls, and demo-*local* is a property of the
 * deployment that no switch in this bundle can change.
 */
function ModePanel() {
  const { dataset, ready } = useSovereign();
  const optedOut = useDemoOptOut();
  const config = useMemo(() => resolveApiBaseUrl(readSyncEnv()), []);
  const status = syncStatus(config, null);
  const demoRows = countDemoRows(dataset);
  const totalRows = countRows(dataset);
  const operatorRows = totalRows - demoRows;

  return (
    <Panel title="Mode" className="lg:col-span-2">
      <div className="flex flex-wrap items-center gap-3">
        <StatePill tone={config.kind === 'configured' ? 'gold' : 'muted'}>
          {config.kind === 'configured' ? 'Local-first · API configured' : 'Demo-local'}
        </StatePill>
        <StatePill tone={optedOut ? 'muted' : 'gold'}>
          {optedOut ? 'Demo seed off' : 'Demo seed on'}
        </StatePill>
        <span className="font-mono text-[0.65rem] text-faint tabular-nums">
          {ready ? `${String(demoRows)} demo · ${String(operatorRows)} yours` : '—'}
        </span>
      </div>

      <dl className="mt-3 space-y-2 text-xs leading-5">
        <div>
          <dt className="label-caps text-faint">Where records live</dt>
          <dd className="text-muted">
            This browser's IndexedDB, and nowhere else. There is no account, no sign-in, and no
            server copy — clearing site data deletes the operation's records permanently.
          </dd>
        </div>
        <div>
          <dt className="label-caps text-faint">What the demo seed is</dt>
          <dd className="text-muted">
            {optedOut
              ? 'Off. You removed the seeded rows, and the seeder leaves them removed across reloads. Everything in the store is now yours.'
              : 'On. Seeded rows carry a Demo badge on every surface that shows them, and every count that includes one says so. They are illustrative, not operational truth.'}
          </dd>
        </div>
        <div>
          <dt className="label-caps text-faint">What the Command API would change</dt>
          <dd className="text-muted">
            {config.kind === 'configured'
              ? `This build points at ${status.host ?? 'a configured origin'}, but pointing is all it does: no read-model is pulled and no write is sent. The Sync surface can probe its health and record the result, and that is the entire integration.`
              : 'Nothing here is waiting on a login. Sync, multi-device use, and private connector credentials all need a Command API that does not exist yet, and this deployment is honest about running without one rather than showing a sign-in that leads nowhere.'}
          </dd>
        </div>
      </dl>

      <Link
        to="/sync"
        className="label-caps mt-3 inline-block border border-line px-2.5 py-1 text-muted transition-colors hover:border-gold/40 hover:text-ivory"
      >
        Open Command API Sync
      </Link>
    </Panel>
  );
}

function CredentialsPanel() {
  const { dataset } = useSovereign();
  const counts = countByState(dataset.integrations);

  return (
    <Panel title="Credentials">
      <p className="text-sm text-muted">
        This surface is a static bundle on GitHub Pages. It holds no secrets and can hold none —
        anything shipped here is public. Credentials belong to the Command API, which does not exist
        yet. Connected means a recorded probe verified the row, and the only probe this bundle can
        run is the health check on{' '}
        <Link to="/sync" className="text-gold hover:text-ivory">
          Sync
        </Link>
        .
      </p>
      <ul className="mt-3 space-y-1.5 text-xs text-faint">
        <li>
          <span className="font-mono text-muted tabular-nums">{counts.awaiting_credentials}</span>{' '}
          integrations await credentials
        </li>
        <li>
          <span className="font-mono text-muted tabular-nums">{counts.disabled}</span> intentionally
          disabled
        </li>
        <li>
          <span className="font-mono text-muted tabular-nums">{counts.connected}</span> verified
          connections
        </li>
      </ul>
      <Link
        to="/integrations"
        className="label-caps mt-3 inline-block border border-line px-2.5 py-1 text-muted transition-colors hover:border-gold/40 hover:text-ivory"
      >
        Open registry
      </Link>
    </Panel>
  );
}

function KernelPanel() {
  const roster = agentKernel.roster();
  const local = roster.filter((provider) => !provider.external).length;

  return (
    <Panel title="Agent kernel">
      <div className="flex items-center gap-3">
        <StatePill tone="muted">
          {`${String(roster.length)} adapters · ${String(local)} local`}
        </StatePill>
        <p className="text-xs text-muted">
          Every model call routes through one kernel. Adapters refuse rather than fabricate: the
          hosted ones hold no credentials, and the local one needs an endpoint on this machine.
        </p>
      </div>
      <Link
        to="/ai"
        className="label-caps mt-3 inline-block border border-line px-2.5 py-1 text-muted transition-colors hover:border-gold/40 hover:text-ivory"
      >
        Open the AI workspace
      </Link>
    </Panel>
  );
}

function RoadmapPanel() {
  const planned = plannedModules();

  if (planned.length === 0) {
    return (
      <Panel title={`Modules · ${String(enabledModules().length)} routed, 0 planned`}>
        <p className="text-xs leading-5 text-muted">
          Every module in the registry is built and reachable. The roadmap list is empty because
          Command API Sync — the last entry — shipped in Wave 7, not because unbuilt work was
          removed from it: a module cannot appear in navigation before it exists, and it cannot sit
          in this registry forever without becoming a route.
        </p>
        <p className="mt-2 text-xs leading-5 text-faint">
          What comes next is in{' '}
          <span className="font-mono">docs/reports/ROADMAP_90_DAY.md</span>, and it is mostly not
          modules: an API to sync with, a session to sync as, and probes that can verify a
          connector.
        </p>
      </Panel>
    );
  }

  return (
    <Panel title={`Not built yet · ${String(planned.length)} modules`}>
      <p className="mb-3 text-xs text-muted">
        These have no route and never appear in navigation. They are listed here so the roadmap is
        legible without pretending the software exists.
      </p>
      <ul className="grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2">
        {planned.map((module) => (
          <li key={module.id} className="flex items-baseline gap-2 border-b border-line/50 py-1">
            <span className="font-mono text-[0.65rem] text-gold tabular-nums">W{module.wave}</span>
            <span className="text-sm text-muted">{module.label}</span>
            <span className="ml-auto truncate text-[0.65rem] text-faint">{module.summary}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function SettingsPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <header className="mb-5">
        <SectionLabel>Surface</SectionLabel>
        <h1 className="mt-1 font-display text-2xl text-ivory">Settings</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Local-first controls for the command surface. Nothing on this page leaves the browser.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ModePanel />
        <StoreControls />
        <CredentialsPanel />
        <KernelPanel />
        <div className="lg:col-span-2">
          <RoadmapPanel />
        </div>
      </div>
    </div>
  );
}
