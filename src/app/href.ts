import { INTEGRATION_STATES } from '@/integrations/state';
import { APPROVAL_FILTERS } from '@/modules/approvals/queue';
import { INBOX_SEVERITY_FILTERS, INBOX_STATUS_FILTERS } from '@/modules/inbox/notifications';
import { enabledModules } from './modules';

/**
 * The only query parameters an enabled route is allowed to carry, and the
 * only values each one may take. Anything else on an otherwise-enabled path
 * is treated as unsafe rather than silently passed through.
 */
const ALLOWED_QUERY_PARAMS: Record<string, Record<string, readonly string[]>> = {
  '/inbox': {
    status: INBOX_STATUS_FILTERS,
    severity: INBOX_SEVERITY_FILTERS,
  },
  '/approvals': {
    status: APPROVAL_FILTERS,
  },
  '/integrations': {
    state: [...INTEGRATION_STATES, 'all'],
  },
};

function enabledPaths(): Set<string> {
  return new Set(enabledModules().map((module) => module.path));
}

/**
 * True when `href` is exactly an enabled internal route, optionally followed
 * by a known-safe query string for that route (ARCHITECTURE_AUDIT §5.3;
 * `docs/reviews/WAVE_2_GPT_REVIEW.md` M1). Everything else — external URLs,
 * protocol-relative URLs, `javascript:`/`data:`/other schemes, malformed
 * strings, and planned-module paths — is unsafe.
 */
export function isSafeInternalHref(href: string): boolean {
  if (typeof href !== 'string') return false;
  const trimmed = href.trim();
  if (trimmed.length === 0) return false;

  // A single leading slash only. Rejects protocol-relative ("//host"),
  // backslash tricks some browsers normalize to "//" ("/\host"), and every
  // absolute URL ("https:", "javascript:", "mailto:", ...).
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed, 'https://internal.invalid');
  } catch {
    return false;
  }

  // The base origin must survive parsing untouched; a route that manages to
  // smuggle a different host or scheme through is not internal.
  if (parsed.origin !== 'https://internal.invalid') return false;

  if (!enabledPaths().has(parsed.pathname)) return false;

  const allowedParams = ALLOWED_QUERY_PARAMS[parsed.pathname];
  for (const [key, value] of parsed.searchParams) {
    const allowedValues = allowedParams?.[key];
    if (!allowedValues || !allowedValues.includes(value)) return false;
  }

  return true;
}

/**
 * Returns `href` unchanged when it is a safe enabled internal route, and
 * `fallback` otherwise. Every notification/record href must pass through
 * this before it reaches a `Link`/`navigate` call.
 */
export function normalizeInternalHref(href: string | undefined | null, fallback: string): string {
  if (href === undefined || href === null) return fallback;
  return isSafeInternalHref(href) ? href : fallback;
}
