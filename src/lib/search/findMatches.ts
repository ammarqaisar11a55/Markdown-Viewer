export const DEFAULT_MATCH_LIMIT = 10_000;

export interface FindOptions {
  caseSensitive?: boolean;
  /** Maximum number of matches to collect. */
  limit?: number;
}

export interface FindResult {
  ranges: Range[];
  /** True when the limit stopped the search early. */
  limitReached: boolean;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const SKIPPED_TAGS = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT']);

/**
 * Finds all occurrences of `query` in the text nodes under `root`. Matches do
 * not span node boundaries. Elements marked `data-search-ignore` (UI chrome
 * such as copy buttons) are skipped with their subtrees.
 */
export function findMatches(root: Node, query: string, options: FindOptions = {}): FindResult {
  const { caseSensitive = false, limit = DEFAULT_MATCH_LIMIT } = options;
  const ranges: Range[] = [];
  if (query === '' || limit <= 0) return { ranges, limitReached: false };

  const doc = root.ownerDocument ?? (root as Document);
  const pattern = new RegExp(escapeRegExp(query), caseSensitive ? 'gu' : 'giu');
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
      const el = node as Element;
      if (SKIPPED_TAGS.has(el.tagName) || el.hasAttribute('data-search-ignore'))
        return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_SKIP;
    },
  });

  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const text = node.nodeValue ?? '';
    if (text.length < query.length) continue;
    pattern.lastIndex = 0;
    for (let match = pattern.exec(text); match !== null; match = pattern.exec(text)) {
      if (ranges.length >= limit) return { ranges, limitReached: true };
      const range = doc.createRange();
      range.setStart(node, match.index);
      range.setEnd(node, match.index + match[0].length);
      ranges.push(range);
      if (match[0].length === 0) pattern.lastIndex += 1;
    }
  }
  return { ranges, limitReached: false };
}

/**
 * Index of the first range (in document order) whose top edge is at or below
 * the top of `viewport`; falls back to 0 when every match is above it.
 */
export function firstRangeInView(ranges: readonly Range[], viewport: Element): number {
  const top = viewport.getBoundingClientRect().top;
  let low = 0;
  let high = ranges.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    const range = ranges[mid];
    if (range !== undefined && range.getBoundingClientRect().top < top) low = mid + 1;
    else high = mid;
  }
  return low < ranges.length ? low : 0;
}
