/**
 * The Command API adapter.
 *
 * This bundle is a static site on GitHub Pages. It cannot hold a secret, it has
 * no session, and there is no Command API deployed for it to talk to. What it
 * *can* do is one honest thing: when a build is configured with
 * `VITE_API_BASE_URL`, ask that origin's `/health` endpoint whether it is there,
 * and record the answer with the time it was asked.
 *
 * Everything else a sync module would do — pulling a remote read-model, writing
 * local changes through, resolving conflicts, authenticating an operator — is
 * declared here as not implemented, with the reason. The module exists so the
 * boundary is visible and testable, not so the operation can pretend it has a
 * backend.
 *
 * Three rules hold this together:
 *
 * 1. **No probe, no request.** With no base URL configured, nothing is fetched.
 *    Not on mount, not on a timer, not at all.
 * 2. **No credential travels.** The probe is a plain GET with `credentials:
 *    'omit'` and no headers, so no cookie, token, or key can ride along — there
 *    is none in this bundle to ride.
 * 3. **No sync success is ever reported.** A reachable `/health` proves an
 *    origin answered. It does not mean a record moved, and this module has no
 *    code path that claims one did.
 */

import { acceptApiBaseUrl } from '@/lib/endpoints';

export interface SyncEnv {
  /** Origin of the Command API, e.g. `https://api.example.com`. Public by definition. */
  VITE_API_BASE_URL?: string;
}

export function readSyncEnv(env: SyncEnv = import.meta.env): string | undefined {
  return env.VITE_API_BASE_URL;
}

/**
 * How the adapter was configured. `absent` is the shipped default and is not a
 * fault; `refused` is a build that configured something this adapter will not
 * call, and it is reported as loudly as a failed probe.
 */
export type SyncConfig =
  | { readonly kind: 'absent'; readonly detail: string }
  | { readonly kind: 'refused'; readonly detail: string }
  | {
      readonly kind: 'configured';
      /** Origin plus path, with no query, fragment, or trailing slash. */
      readonly base: string;
      /** Host only. Printed in the UI; the full URL never is. */
      readonly host: string;
      readonly detail: string;
    };

const ABSENT =
  'No Command API is configured for this build. VITE_API_BASE_URL is unset, so this surface makes no network request at all and every record you see came from this browser.';

/**
 * Turns `VITE_API_BASE_URL` into the adapter's own vocabulary. Whether the value
 * is acceptable is decided by `acceptApiBaseUrl`, which the Content Security
 * Policy builder also asks, so a URL this adapter refuses can never appear in
 * `connect-src` (`docs/reviews/WAVE_7_GPT_REVIEW.md` H2). Only the wording of
 * each refusal belongs here.
 */
export function resolveApiBaseUrl(raw: string | undefined): SyncConfig {
  const check = acceptApiBaseUrl(raw);

  if (check.ok) {
    return {
      kind: 'configured',
      base: check.base,
      host: check.host,
      detail: `A Command API base URL is configured for ${check.host}. Nothing is requested from it until you run the health probe, and a probe only proves the origin answered.`,
    };
  }

  switch (check.reason) {
    case 'missing':
      return { kind: 'absent', detail: ABSENT };
    case 'unparsable':
      return {
        kind: 'refused',
        detail:
          'VITE_API_BASE_URL is not a URL this adapter can parse, so there is nothing to probe. Set it to an origin such as https://api.example.com.',
      };
    case 'userinfo':
      return {
        kind: 'refused',
        detail:
          'VITE_API_BASE_URL carries credentials in the URL. A VITE_ variable is inlined into a public bundle, so that credential would be published. It was refused and nothing was sent to it.',
      };
    case 'query_or_fragment':
      return {
        kind: 'refused',
        detail:
          'VITE_API_BASE_URL carries a query string or fragment. A base URL needs neither, and both are common places for an API key to hide, so it was refused and nothing was sent to it.',
      };
    default:
      return {
        kind: 'refused',
        detail: `VITE_API_BASE_URL uses ${(check.protocol ?? '').replace(/:$/, '')} for ${check.host ?? 'that host'}. Only https is called, except on this machine's loopback address, so nothing was sent to it.`,
      };
  }
}

/* ── Probe ──────────────────────────────────────────────────────────────── */

export type ProbeFailure = 'not_configured' | 'no_fetch' | 'status' | 'unreachable';

/**
 * One recorded probe. `at` is always present — including on failure — because
 * "we asked and it did not answer" is a measurement, and the registry writer
 * refuses a result that cannot say when it was taken.
 */
export interface ProbeRecord {
  /** True only when the endpoint answered with a 2xx. */
  readonly verified: boolean;
  readonly at: string;
  readonly status?: number;
  readonly failure?: ProbeFailure;
  readonly detail: string;
}

export interface ProbeOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  now?: Date;
}

const DEFAULT_TIMEOUT_MS = 8_000;

/** The one path this adapter knows, matching ContentDone's `GET /health`. */
export const HEALTH_PATH = '/health';

export async function probeCommandApi(
  config: SyncConfig,
  options: ProbeOptions = {},
): Promise<ProbeRecord> {
  const now = options.now ?? new Date();
  const at = now.toISOString();

  if (config.kind !== 'configured') {
    return { verified: false, at, failure: 'not_configured', detail: config.detail };
  }

  const fetchImpl = options.fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined);
  if (fetchImpl === undefined) {
    return {
      verified: false,
      at,
      failure: 'no_fetch',
      detail: 'This runtime has no fetch implementation, so no probe could be attempted.',
    };
  }

  const url = `${config.base}${HEALTH_PATH}`;
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      // No credentials, no custom headers: nothing in this bundle is
      // authorised, and a header would only add a preflight to a request that
      // is meant to prove reachability and nothing more.
      credentials: 'omit',
      mode: 'cors',
      cache: 'no-store',
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });

    if (!response.ok) {
      return {
        verified: false,
        at,
        status: response.status,
        failure: 'status',
        detail: `${config.host} answered ${String(response.status)} for ${HEALTH_PATH}. The origin is reachable; it did not report itself healthy.`,
      };
    }

    return {
      verified: true,
      at,
      status: response.status,
      detail: `${config.host} answered ${String(response.status)} for ${HEALTH_PATH}. That is reachability, not authorisation and not a sync.`,
    };
  } catch (cause) {
    return {
      verified: false,
      at,
      failure: 'unreachable',
      detail:
        cause instanceof Error
          ? `${config.host} could not be reached: ${cause.message}`
          : `${config.host} did not answer.`,
    };
  }
}

/* ── State ──────────────────────────────────────────────────────────────── */

export type SyncState = 'connected' | 'disabled' | 'awaiting_credentials';

export interface SyncStatus {
  state: SyncState;
  label: string;
  /** One sentence the surface prints verbatim. Derived, so it cannot drift. */
  statement: string;
  /** True only when a probe could legally be attempted. */
  canProbe: boolean;
  lastProbedAt?: string;
  host?: string;
}

export const syncStateLabel: Record<SyncState, string> = {
  connected: 'Connected',
  disabled: 'Disabled',
  awaiting_credentials: 'Awaiting Credentials',
};

export const syncStateTone: Record<SyncState, 'sentinel' | 'muted' | 'gold'> = {
  connected: 'sentinel',
  disabled: 'muted',
  awaiting_credentials: 'gold',
};

/**
 * The adapter's state, in the registry's own vocabulary.
 *
 * The invariant that matters is the same one the registry enforces: `connected`
 * requires a probe that succeeded *and* the timestamp of when it ran. A
 * configured base URL alone is Awaiting Credentials, a failed probe is Awaiting
 * Credentials, and no configuration at all is Disabled — an adapter that was
 * never switched on, not one that is broken.
 */
export function syncStatus(config: SyncConfig, probe: ProbeRecord | null): SyncStatus {
  if (config.kind !== 'configured') {
    return {
      state: 'disabled',
      label: syncStateLabel.disabled,
      statement: config.detail,
      canProbe: false,
    };
  }

  const verified = probe !== null && probe.verified && !Number.isNaN(Date.parse(probe.at));

  if (verified) {
    return {
      state: 'connected',
      label: syncStateLabel.connected,
      statement: `${probe.detail} No record has been synchronised, because no sync path is implemented.`,
      canProbe: true,
      lastProbedAt: probe.at,
      host: config.host,
    };
  }

  return {
    state: 'awaiting_credentials',
    label: syncStateLabel.awaiting_credentials,
    statement:
      probe === null
        ? config.detail
        : `${probe.detail} Until a probe succeeds, this adapter stays Awaiting Credentials.`,
    canProbe: true,
    lastProbedAt: probe?.at,
    host: config.host,
  };
}

/* ── Capabilities ───────────────────────────────────────────────────────── */

export interface SyncCapability {
  id: string;
  label: string;
  implemented: boolean;
  /** What the surface does today, or what would have to exist first. */
  detail: string;
}

/**
 * What this module does and does not do, as data rather than prose, so the page
 * cannot claim a capability the code does not have. Exactly one row is
 * implemented.
 */
export function syncCapabilities(): SyncCapability[] {
  return [
    {
      id: 'health-probe',
      label: 'Health probe',
      implemented: true,
      detail:
        'A GET to /health on the configured base URL, run when you ask for it. The result and its timestamp are written to the ContentDone API row in the registry.',
    },
    {
      id: 'read-model',
      label: 'Remote read-model',
      implemented: false,
      detail:
        'Pulling records from the Command API needs an API that serves them and a session that authorises the read. Neither exists, so no remote record has ever entered this store.',
    },
    {
      id: 'write-through',
      label: 'Write-through',
      implemented: false,
      detail:
        'Every mutation in this surface writes to IndexedDB and stops there. Nothing queues, retries, or waits to be flushed, so there is no pending-sync state to misread.',
    },
    {
      id: 'conflict',
      label: 'Conflict resolution',
      implemented: false,
      detail:
        'With one writer and one store there are no conflicts to resolve. A second writer would need record versions and a merge policy before sync could be safe.',
    },
    {
      id: 'auth',
      label: 'Operator session',
      implemented: false,
      detail:
        'There is no sign-in, no account, and no token store. A static bundle cannot keep a secret, so authentication belongs to the Command API and its absence is why private data stays out of this deployment.',
    },
    {
      id: 'credentials',
      label: 'Credential vault',
      implemented: false,
      detail:
        'Connector credentials live on the Command API. This bundle holds none, offers no field to type one into, and would publish anything it did hold.',
    },
  ];
}

/** The registry row this adapter reports its probe against. */
export const COMMAND_API_INTEGRATION_ID = 'contentdone';
