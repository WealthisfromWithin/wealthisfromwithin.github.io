/**
 * The Content Security Policy for the built surface.
 *
 * GitHub Pages serves static files and lets nobody set a response header, so a
 * `<meta http-equiv>` in the built `index.html` is the only delivery this
 * deployment has. That has two consequences this module is explicit about:
 *
 * - **`frame-ancestors` is ignored in a meta tag.** It is emitted only for the
 *   header form, which is what a reverse proxy or a future Command API host
 *   would send. Clickjacking protection on Pages is therefore *absent*, not
 *   partial, and `docs/OPERATIONS.md` says so rather than implying the meta tag
 *   covers it.
 * - **The policy is fixed at build time.** Connect sources are derived from the
 *   same `VITE_*` variables the adapters read, so a build that configures a
 *   Command API can reach it and a build that does not cannot — the policy and
 *   the code agree because they read the same input.
 *
 * `style-src` keeps `'unsafe-inline'` for one reason: `index.html` carries an
 * inline `<style>` that paints the obsidian background before the stylesheet
 * arrives. Hashing it would move a silent white-flash regression into whoever
 * next edits that block, and inline *style* is a materially smaller risk than
 * inline script, which is not allowed at all.
 */

export interface CspOptions {
  /**
   * Extra origins the app is allowed to `fetch`. Anything not listed here — and
   * not same-origin — is blocked by the browser, which is the point: an
   * exfiltration path added by a compromised dependency has nowhere to send to.
   */
  connectSources?: readonly string[];
  /** `meta` omits the directives a meta tag cannot carry. */
  delivery?: 'meta' | 'header';
}

/** Directives that browsers ignore when the policy arrives in a meta tag. */
const HEADER_ONLY = new Set(['frame-ancestors']);

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

export function buildContentSecurityPolicy(options: CspOptions = {}): string {
  const delivery = options.delivery ?? 'meta';
  const connect = unique(["'self'", ...(options.connectSources ?? [])]);

  const directives: [string, string][] = [
    ['default-src', "'self'"],
    ['base-uri', "'self'"],
    // No provider SDKs, no CDN, no analytics beacon: everything executable is
    // built from this repository and served from this origin.
    ['script-src', "'self'"],
    ['style-src', "'self' 'unsafe-inline'"],
    // `data:` covers the inline SVG favicon in index.html.
    ['img-src', "'self' data:"],
    ['font-src', "'self'"],
    ['connect-src', connect.join(' ')],
    ['manifest-src', "'self'"],
    ['worker-src', "'self'"],
    ['object-src', "'none'"],
    ['frame-src', "'none'"],
    ['frame-ancestors', "'none'"],
    // Nothing in this surface posts a form anywhere.
    ['form-action', "'none'"],
  ];

  return directives
    .filter(([name]) => delivery === 'header' || !HEADER_ONLY.has(name))
    .map(([name, value]) => `${name} ${value}`)
    .join('; ');
}

/**
 * The origin of a URL, or nothing when it is not a URL worth allowing. Only the
 * origin is returned: a policy naming a path would be a policy that looks
 * narrower than it is, since CSP matches path prefixes loosely.
 */
export function originOf(raw: string | undefined): string | undefined {
  const value = raw?.trim();
  if (value === undefined || value.length === 0) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

/**
 * The connect sources a build actually needs, read from the variables the
 * adapters read: the Command API base URL and the local model endpoint. A build
 * with neither gets `'self'` alone, which is what the public deployment ships.
 */
export function connectSourcesFromEnv(env: Record<string, string | undefined>): string[] {
  return unique([originOf(env.VITE_API_BASE_URL), originOf(env.VITE_LOCAL_AI_URL)].filter(
    (value): value is string => value !== undefined,
  ));
}
