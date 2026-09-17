// Fuzzy matching for Quick Open. Each whitespace-separated term must match
// the text as a case-insensitive subsequence; matches in the file name, at
// word boundaries and in consecutive runs score higher.

export interface FuzzyMatch {
  score: number;
  /** Sorted, unique indices of matched characters in the text. */
  indices: number[];
}

export interface FuzzyResult<T> extends FuzzyMatch {
  item: T;
}

const SCORE_MATCH = 1;
const BONUS_CONSECUTIVE = 5;
const BONUS_BOUNDARY = 8;
const BONUS_BASENAME = 4;
const BONUS_CASE = 1;
const BONUS_CONTIGUOUS_BASENAME = 10;
const PENALTY_LENGTH = 0.01;
const SEPARATORS = new Set(['/', '\\', '_', '-', '.', ' ']);

function isBoundary(text: string, index: number): boolean {
  if (index === 0) return true;
  const prev = text.charAt(index - 1);
  if (SEPARATORS.has(prev)) return true;
  const current = text.charAt(index);
  return prev === prev.toLowerCase() && current !== current.toLowerCase();
}

function basenameStart(text: string): number {
  return Math.max(text.lastIndexOf('/'), text.lastIndexOf('\\')) + 1;
}

function scoreTerm(
  term: string,
  text: string,
  lowerText: string,
  nameStart: number,
): FuzzyMatch | null {
  const lowerTerm = term.toLowerCase();
  const m = lowerTerm.length;
  const n = lowerText.length;
  if (m > n) return null;

  // best[j][i]: best score with term[j] matched at text[i] (or -Infinity).
  const best: Float64Array[] = [];
  const from: Int32Array[] = [];
  for (let j = 0; j < m; j += 1) {
    const row = new Float64Array(n).fill(Number.NEGATIVE_INFINITY);
    const back = new Int32Array(n).fill(-1);
    const prevRow = j > 0 ? best[j - 1] : undefined;
    let prefixBest = Number.NEGATIVE_INFINITY;
    let prefixIndex = -1;
    for (let i = j; i < n; i += 1) {
      if (prevRow !== undefined && i >= 2) {
        const candidate = prevRow[i - 2] ?? Number.NEGATIVE_INFINITY;
        if (candidate > prefixBest) {
          prefixBest = candidate;
          prefixIndex = i - 2;
        }
      }
      if (lowerText.charAt(i) !== lowerTerm.charAt(j)) continue;
      let charScore = SCORE_MATCH;
      if (isBoundary(text, i)) charScore += BONUS_BOUNDARY;
      if (i >= nameStart) charScore += BONUS_BASENAME;
      if (text.charAt(i) === term.charAt(j)) charScore += BONUS_CASE;

      if (prevRow === undefined) {
        row[i] = charScore;
        continue;
      }
      const consecutive =
        i >= 1 ? (prevRow[i - 1] ?? Number.NEGATIVE_INFINITY) : Number.NEGATIVE_INFINITY;
      const viaConsecutive = consecutive + BONUS_CONSECUTIVE;
      if (viaConsecutive >= prefixBest && consecutive > Number.NEGATIVE_INFINITY) {
        row[i] = charScore + viaConsecutive;
        back[i] = i - 1;
      } else if (prefixBest > Number.NEGATIVE_INFINITY) {
        row[i] = charScore + prefixBest;
        back[i] = prefixIndex;
      }
    }
    best.push(row);
    from.push(back);
  }

  const lastRow = best[m - 1];
  if (lastRow === undefined) return null;
  let endIndex = -1;
  let score = Number.NEGATIVE_INFINITY;
  lastRow.forEach((value, index) => {
    if (value > score) {
      score = value;
      endIndex = index;
    }
  });
  if (endIndex === -1) return null;

  const indices: number[] = [];
  let cursor = endIndex;
  for (let j = m - 1; j >= 0 && cursor >= 0; j -= 1) {
    indices.push(cursor);
    cursor = from[j]?.[cursor] ?? -1;
  }
  indices.reverse();

  if (lowerText.includes(lowerTerm, nameStart)) score += BONUS_CONTIGUOUS_BASENAME;
  return { score, indices };
}

export function fuzzyScore(query: string, text: string): FuzzyMatch | null {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return { score: 0, indices: [] };
  const lowerText = text.toLowerCase();
  const nameStart = basenameStart(text);
  let score = 0;
  const indices = new Set<number>();
  for (const term of terms) {
    const match = scoreTerm(term, text, lowerText, nameStart);
    if (match === null) return null;
    score += match.score;
    match.indices.forEach((index) => indices.add(index));
  }
  score -= text.length * PENALTY_LENGTH;
  return { score, indices: [...indices].sort((a, b) => a - b) };
}

export function fuzzyFilter<T>(
  query: string,
  items: readonly T[],
  getText: (item: T) => string,
  limit?: number,
): FuzzyResult<T>[] {
  const max = limit ?? Number.POSITIVE_INFINITY;
  if (query.trim() === '') {
    return items.slice(0, max).map((item) => ({ item, score: 0, indices: [] }));
  }
  const results: (FuzzyResult<T> & { order: number })[] = [];
  items.forEach((item, order) => {
    const match = fuzzyScore(query, getText(item));
    if (match !== null) results.push({ item, order, ...match });
  });
  results.sort((a, b) => b.score - a.score || a.order - b.order);
  return results.slice(0, max).map(({ item, score, indices }) => ({ item, score, indices }));
}
