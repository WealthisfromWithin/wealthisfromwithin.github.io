import type { Integration, IntegrationState } from './entities';

/**
 * The connected-probe invariant (`docs/reviews/WAVE_6_GPT_REVIEW.md` L1,
 * `docs/reviews/WAVE_7_GPT_REVIEW.md` H1).
 *
 * `connected` is defined on this surface as "credentials verified by a health
 * probe", so a row claiming it must carry the timestamp of the probe that
 * verified it. Before Wave 7 nothing could write that state, which made the
 * invariant a convention; `/sync` can now record a probe, so it is enforced
 * here — once, at the point every surface reads state — rather than in each
 * selector that would otherwise have to remember.
 *
 * It lives in the domain rather than beside the registry surface because
 * readiness and action gating are domain decisions: `automationReadiness` has
 * to ask the same question `/integrations` asks, and a helper the domain cannot
 * import is a helper the domain will quietly work around. `src/integrations/state`
 * re-exports these, so the registry surface still reads as one module.
 *
 * Enforcement is a downgrade, not a throw. A row that says connected without
 * evidence is a row whose credentials are unverified, which is exactly what
 * `awaiting_credentials` means, and refusing to read the store would hide the
 * problem behind an error boundary instead of showing it.
 */
export function hasVerifiedProbe(integration: Integration): boolean {
  const at = integration.lastProbedAt;
  return at !== undefined && !Number.isNaN(Date.parse(at));
}

/** True when a row claims Connected with no probe behind the claim. */
export function isUnverifiedConnectedClaim(integration: Integration): boolean {
  return integration.state === 'connected' && !hasVerifiedProbe(integration);
}

/**
 * The state every surface must render, filter, count, sort, and gate by.
 * Identical to the stored state except for an unverified Connected claim, which
 * reads as Awaiting Credentials.
 *
 * This is the only place in `src/` allowed to read `integration.state`
 * directly; `src/integrations/invariant.test.ts` fails the build if another
 * module does.
 */
export function effectiveIntegrationState(integration: Integration): IntegrationState {
  return isUnverifiedConnectedClaim(integration) ? 'awaiting_credentials' : integration.state;
}

/**
 * Whether a connector may be used: rendered as green, counted as verified, or
 * named by a rule that is about to run. Anything that gates an action asks this
 * rather than comparing state itself.
 */
export function isUsable(integration: Integration): boolean {
  return effectiveIntegrationState(integration) === 'connected';
}
