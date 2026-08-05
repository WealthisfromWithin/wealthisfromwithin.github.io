export interface FuzzyMatch {
  score: number;
  /** Indices in the haystack that matched, for highlighting. */
  indices: number[];
}

const EXACT_PREFIX_BONUS = 40;
const WORD_START_BONUS = 8;
const CONSECUTIVE_BONUS = 10;
/** Charged once per break in a run, so matches smeared across a sentence lose. */
const BREAK_PENALTY = 6;
const DISTANCE_PENALTY = 1;
const MAX_DISTANCE_CHARGED = 12;

/**
 * Subsequence matcher tuned for command palettes: every query character must
 * appear in order. Word starts and runs score higher, distance costs a little.
 * Returns null when the query is not a subsequence of the haystack.
 */
export function fuzzyMatch(query: string, haystack: string): FuzzyMatch | null {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return { score: 0, indices: [] };

  const target = haystack.toLowerCase();
  if (needle.length > target.length) return null;

  const indices: number[] = [];
  let score = 0;
  let cursor = 0;
  let previousIndex = -1;
  let position = 0;

  for (const char of needle) {
    const found = target.indexOf(char, cursor);
    if (found === -1) return null;

    if (position > 0 && found === previousIndex + 1) {
      score += CONSECUTIVE_BONUS;
    } else {
      if (position > 0) score -= BREAK_PENALTY;
      score -= Math.min(found - cursor, MAX_DISTANCE_CHARGED) * DISTANCE_PENALTY;
    }

    const previousChar = found > 0 ? target[found - 1] : undefined;
    if (found === 0 || previousChar === ' ' || previousChar === '-' || previousChar === '/') {
      score += WORD_START_BONUS;
    }

    indices.push(found);
    previousIndex = found;
    cursor = found + 1;
    position += 1;
  }

  if (target.startsWith(needle)) score += EXACT_PREFIX_BONUS;
  // Shorter haystacks with the same evidence are more likely to be the intent.
  score -= target.length * 0.05;

  return { score, indices };
}

export interface RankedResult<T> {
  item: T;
  score: number;
}

export interface RankOptions {
  limit?: number;
  /**
   * Score floor. A subsequence match can be technically true but useless
   * ("aldridge" scattered through an unrelated sentence); a floor keeps that
   * noise out of the palette.
   */
  minScore?: number;
}

export function rankByFuzzy<T>(
  query: string,
  items: readonly T[],
  fields: (item: T) => string[],
  options: RankOptions = {},
): RankedResult<T>[] {
  const { limit = 20, minScore = Number.NEGATIVE_INFINITY } = options;
  const ranked: RankedResult<T>[] = [];

  for (const item of items) {
    let best: number | null = null;
    let weight = 0;
    for (const field of fields(item)) {
      const match = fuzzyMatch(query, field);
      if (match) {
        // Earlier fields are more authoritative (title beats keywords).
        const adjusted = match.score - weight * 8;
        if (best === null || adjusted > best) best = adjusted;
      }
      weight += 1;
    }
    if (best !== null && best >= minScore) ranked.push({ item, score: best });
  }

  return ranked.sort((a, b) => b.score - a.score).slice(0, limit);
}
