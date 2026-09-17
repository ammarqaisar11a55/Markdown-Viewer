// Paints search matches with the CSS Custom Highlight API, falling back to the
// document selection for the current match where the API is unavailable.

export const MATCH_HIGHLIGHT = 'search-match';
export const CURRENT_HIGHLIGHT = 'search-current';

export function supportsCustomHighlights(): boolean {
  return typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined';
}

export interface SearchPainter {
  paint(ranges: readonly Range[], current: Range | null): void;
  clear(): void;
}

export function createSearchPainter(): SearchPainter {
  if (supportsCustomHighlights()) {
    return {
      paint(ranges, current) {
        const all = new Highlight(...ranges);
        all.priority = 0;
        CSS.highlights.set(MATCH_HIGHLIGHT, all);
        if (current === null) {
          CSS.highlights.delete(CURRENT_HIGHLIGHT);
        } else {
          const active = new Highlight(current);
          active.priority = 1;
          CSS.highlights.set(CURRENT_HIGHLIGHT, active);
        }
      },
      clear() {
        CSS.highlights.delete(MATCH_HIGHLIGHT);
        CSS.highlights.delete(CURRENT_HIGHLIGHT);
      },
    };
  }

  let selected: Range | null = null;
  return {
    paint(_ranges, current) {
      const selection = window.getSelection();
      if (selection === null) return;
      selection.removeAllRanges();
      selected = current;
      if (current !== null) selection.addRange(current);
    },
    clear() {
      const selection = window.getSelection();
      if (selection !== null && selected !== null && selection.rangeCount > 0) {
        if (selection.getRangeAt(0) === selected) selection.removeAllRanges();
      }
      selected = null;
    },
  };
}

function centerRange(range: Range, container: HTMLElement): void {
  const rect = range.getBoundingClientRect();
  if (rect.height === 0 && rect.width === 0) return;
  const box = container.getBoundingClientRect();
  const offset = rect.top - box.top - (box.height - rect.height) / 2;
  if (Math.abs(offset) > 1) container.scrollTop += offset;

  const scroller = range.startContainer.parentElement?.closest<HTMLElement>(
    '.md-code, .md-table-wrap',
  );
  if (scroller === null || scroller === undefined) return;
  const inner = scroller.getBoundingClientRect();
  if (rect.left < inner.left || rect.right > inner.right) {
    scroller.scrollLeft += rect.left - inner.left - inner.width / 2;
  }
}

/**
 * Scrolls `container` (only) so that `range` is vertically centered. Chunks
 * with `content-visibility: auto` may change size once they render, so the
 * position is refined on the next frame.
 */
export function scrollRangeIntoView(range: Range, container: HTMLElement): void {
  centerRange(range, container);
  if ((range.startContainer.parentElement?.closest('[data-chunked]') ?? null) !== null) {
    requestAnimationFrame(() => {
      if (range.startContainer.isConnected) centerRange(range, container);
    });
  }
}
