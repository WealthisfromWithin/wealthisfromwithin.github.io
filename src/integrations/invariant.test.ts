import { describe, expect, it } from 'vitest';

/**
 * The connected-probe invariant, enforced against the source rather than
 * against one more selector (`docs/reviews/WAVE_7_GPT_REVIEW.md` H1).
 *
 * Wave 6 added the downgrade and Wave 7 was supposed to make every consumer use
 * it, but the review found modules still reading `integration.state` — one of
 * which could mark an automation runnable from a row with no probe behind it.
 * Fixing those fixes today; this test is what stops the next one, because a
 * reviewer cannot be relied on to notice a `.state` that reads perfectly
 * naturally.
 *
 * The check is deliberately narrow: it matches the identifier registry rows are
 * always given, so it cannot police a row aliased to another name. What it does
 * guarantee is that the obvious way to write the bug fails the build, and that
 * the exemption list stays visible and short.
 */

/** The one module allowed to read the stored field: it defines the downgrade. */
const INVARIANT_MODULE = '/src/domain/integrations.ts';

/**
 * Writers, not readers. Seeding puts a state *into* a row, and a downgrade
 * applied on the way in would hide the very claim the read-time check exists to
 * expose.
 */
const WRITERS: readonly string[] = ['/src/data/seed.ts'];

const RAW_STATE_READ = /\bintegration\s*(?:\?\.|\.)\s*state\b/;

const sources: Record<string, string> = import.meta.glob<string>('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Prose about the field is documentation, not a bypass. */
function code(body: string): string[] {
  return body
    .split('\n')
    .filter((line) => {
      const trimmed = line.trimStart();
      return !trimmed.startsWith('*') && !trimmed.startsWith('//') && !trimmed.startsWith('/*');
    });
}

function modules(): [string, string][] {
  return Object.entries(sources).filter(([path]) => !/\.test\.tsx?$/.test(path));
}

describe('the connected-probe invariant has no way around it', () => {
  it('finds the source tree it is meant to police', () => {
    const paths = modules().map(([path]) => path);

    expect(paths.length).toBeGreaterThan(50);
    expect(paths).toContain(INVARIANT_MODULE);
    expect(sources[INVARIANT_MODULE]).toMatch(RAW_STATE_READ);
  });

  it('leaves no module reading integration.state except the one that defines it', () => {
    const offenders = modules()
      .filter(([path]) => path !== INVARIANT_MODULE && !WRITERS.includes(path))
      .filter(([, body]) => code(body).some((line) => RAW_STATE_READ.test(line)))
      .map(([path]) => path);

    expect(offenders).toEqual([]);
  });
});
