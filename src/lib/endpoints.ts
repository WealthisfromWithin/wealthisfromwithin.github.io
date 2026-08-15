/**
 * The two URL acceptance rules this bundle has, in one place.
 *
 * Two adapters decide whether a build-time URL may be called at all: the
 * Command API adapter (`src/modules/sync/sync.ts`) and the local model adapter
 * (`src/agents/providers/local.ts`). The Content Security Policy
 * (`src/lib/csp.ts`) then has to name exactly the origins those adapters would
 * call and no others — a `connect-src` entry for an origin an adapter refuses is
 * an exfiltration destination granted for nothing
 * (`docs/reviews/WAVE_7_GPT_REVIEW.md` H2).
 *
 * Keeping three copies of "is this URL acceptable" in sync by inspection is how
 * that gap appeared, so the decision lives here and each caller keeps only its
 * own wording. This module imports nothing: `vite.config.ts` loads it at build
 * time to write the policy, and the adapters load it in the browser.
 */

/**
 * The hosts a request cannot leave the machine to reach. `URL` normalises what
 * it is given — case, an IPv6 address written out in full, a trailing dot — so
 * these are compared against `hostname` after parsing rather than against the
 * raw string. LAN and private addresses are deliberately absent: they are other
 * machines, and an adapter that reached them while reporting `external: false`
 * would be making the same claim this check exists to stop.
 */
export const LOOPBACK_HOSTS: readonly string[] = ['localhost', '127.0.0.1', '[::1]'];

export function isLoopbackHostname(hostname: string): boolean {
  return LOOPBACK_HOSTS.includes(hostname);
}

/** Why a configured URL was refused. Each caller turns this into its own copy. */
export type EndpointRefusal =
  | 'missing'
  | 'unparsable'
  | 'scheme'
  | 'userinfo'
  | 'query_or_fragment'
  | 'not_loopback';

export interface AcceptedEndpoint {
  readonly ok: true;
  /** Scheme, host, and port. The only part the CSP may ever name. */
  readonly origin: string;
  /** Origin plus path, with no query, fragment, or trailing slash. */
  readonly base: string;
  /** Host and port. Printed in the UI; the full URL never is. */
  readonly host: string;
  /** Kept for a caller that needs to explain the value it accepted. */
  readonly protocol: string;
}

export interface RefusedEndpoint {
  readonly ok: false;
  readonly reason: EndpointRefusal;
  /** Present whenever the value parsed, so a refusal can name what it saw. */
  readonly host?: string;
  readonly protocol?: string;
}

export type EndpointCheck = AcceptedEndpoint | RefusedEndpoint;

function accept(url: URL): AcceptedEndpoint {
  return {
    ok: true,
    origin: url.origin,
    base: `${url.origin}${url.pathname}`.replace(/\/+$/, ''),
    host: url.host,
    protocol: url.protocol,
  };
}

function parse(raw: string | undefined): URL | EndpointRefusal {
  const value = raw?.trim();
  if (value === undefined || value.length === 0) return 'missing';
  try {
    return new URL(value);
  } catch {
    return 'unparsable';
  }
}

/**
 * The Command API base URL rule. Four refusals, each a way a base URL can carry
 * a secret or downgrade the connection:
 *
 * - **Unparsable** — nothing to call.
 * - **Not `https:`** — a plaintext API on a public origin leaks whatever it
 *   answers. Loopback `http:` is allowed, because that is the operator's own
 *   machine and the same exception the local model adapter makes.
 * - **Userinfo** — `https://user:token@host` is a credential in the bundle.
 * - **Query or fragment** — `?api_key=…` is the other way a credential arrives,
 *   and a base URL has no legitimate need for either.
 */
export function acceptApiBaseUrl(raw: string | undefined): EndpointCheck {
  const parsed = parse(raw);
  if (typeof parsed === 'string') return { ok: false, reason: parsed };
  const url = parsed;

  if (url.username.length > 0 || url.password.length > 0) {
    return { ok: false, reason: 'userinfo', host: url.host, protocol: url.protocol };
  }
  if (url.search.length > 0 || url.hash.length > 0) {
    return { ok: false, reason: 'query_or_fragment', host: url.host, protocol: url.protocol };
  }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLoopbackHostname(url.hostname))) {
    return { ok: false, reason: 'scheme', host: url.host, protocol: url.protocol };
  }

  return accept(url);
}

/**
 * The local model endpoint rule: an HTTP address on this machine. A non-loopback
 * host is refused rather than probed, because the adapter reports
 * `external: false` and that claim has to be earned before any request exists.
 */
export function acceptLoopbackEndpoint(raw: string | undefined): EndpointCheck {
  const parsed = parse(raw);
  if (typeof parsed === 'string') return { ok: false, reason: parsed };
  const url = parsed;

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'scheme', host: url.host, protocol: url.protocol };
  }
  if (!isLoopbackHostname(url.hostname)) {
    return { ok: false, reason: 'not_loopback', host: url.host, protocol: url.protocol };
  }

  return accept(url);
}
