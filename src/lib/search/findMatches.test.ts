import { describe, expect, it } from 'vitest';
import { findMatches, firstRangeInView } from './findMatches';
import { formatMatchCount } from './format';

function root(html: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el;
}

describe('findMatches', () => {
  it('finds case-insensitive matches by default', () => {
    const { ranges, limitReached } = findMatches(root('<p>Hello hello HELLO</p>'), 'hello');
    expect(ranges.map((r) => r.toString())).toEqual(['Hello', 'hello', 'HELLO']);
    expect(limitReached).toBe(false);
  });

  it('respects case sensitivity', () => {
    const { ranges } = findMatches(root('<p>Hello hello HELLO</p>'), 'hello', {
      caseSensitive: true,
    });
    expect(ranges).toHaveLength(1);
    expect(ranges[0]!.startOffset).toBe(6);
  });

  it('finds multiple matches per node and across nodes', () => {
    const { ranges } = findMatches(root('<p>abab <em>ab</em></p><ul><li>xab</li></ul>'), 'ab');
    expect(ranges).toHaveLength(4);
    expect(ranges.map((r) => r.startOffset)).toEqual([0, 2, 0, 1]);
  });

  it('treats the query literally', () => {
    const { ranges } = findMatches(root('<p>a.b a+b (x)</p>'), '(x)');
    expect(ranges).toHaveLength(1);
    expect(findMatches(root('<p>axb</p>'), 'a.b').ranges).toHaveLength(0);
  });

  it('stops at the limit', () => {
    const result = findMatches(root(`<p>${'x '.repeat(50)}</p>`), 'x', { limit: 10 });
    expect(result.ranges).toHaveLength(10);
    expect(result.limitReached).toBe(true);
  });

  it('returns nothing for no matches or an empty query', () => {
    expect(findMatches(root('<p>abc</p>'), 'zzz').ranges).toEqual([]);
    expect(findMatches(root('<p>abc</p>'), '').ranges).toEqual([]);
  });

  it('skips UI chrome marked data-search-ignore', () => {
    const { ranges } = findMatches(
      root('<div><div data-search-ignore><button>Copy</button></div><pre>copy</pre></div>'),
      'copy',
    );
    expect(ranges).toHaveLength(1);
    expect(ranges[0]!.startContainer.parentElement?.tagName).toBe('PRE');
  });
});

describe('formatMatchCount', () => {
  it('formats counts', () => {
    expect(formatMatchCount(-1, 0, false)).toBe('No results');
    expect(formatMatchCount(2, 42, false)).toBe('3 of 42');
    expect(formatMatchCount(0, 10_000, true)).toBe('1 of 10,000+');
  });
});

describe('firstRangeInView', () => {
  const rect = (top: number) => ({ top }) as DOMRect;
  const ranges = (tops: number[]) =>
    tops.map((top) => ({ getBoundingClientRect: () => rect(top) }) as unknown as Range);
  const viewport = (top: number) =>
    ({ getBoundingClientRect: () => rect(top) }) as unknown as Element;

  it('returns the first match at or below the viewport top', () => {
    expect(firstRangeInView(ranges([-500, -20, 0, 40, 900]), viewport(0))).toBe(2);
    expect(firstRangeInView(ranges([10, 20]), viewport(0))).toBe(0);
  });

  it('wraps to the first match when all matches are above the viewport', () => {
    expect(firstRangeInView(ranges([-300, -100]), viewport(0))).toBe(0);
    expect(firstRangeInView([], viewport(0))).toBe(0);
  });
});
