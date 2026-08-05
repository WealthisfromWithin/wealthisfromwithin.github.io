/**
 * The seed version, alone in its own module.
 *
 * Every boot compares this string against what the store was seeded with, but
 * only a boot that actually needs to reseed has any use for the 80 KB of demo
 * fixtures in `seed.ts`. Keeping the version separate is what lets
 * `repositories.ts` import the fixtures dynamically (TD-16): the check is
 * always cheap, and the payload arrives only when it is about to be written.
 */
export const SEED_VERSION = 'wave6.0';
