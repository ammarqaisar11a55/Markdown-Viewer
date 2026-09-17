import { useEffect } from 'react';
import { findElementById } from '@/lib/markdown/dom';
import { setActiveHeading } from '@/stores/viewerStore';
import type { Heading } from '@/types';

/** Top band of the viewport (as a fraction of its height) where a heading counts as "current". */
const ACTIVE_BAND = 0.3;

/** After scrolling settles, re-check in case a jump skipped over headings. */
const SETTLE_MS = 120;

/**
 * Tracks which heading is currently being read, using an IntersectionObserver
 * over the heading elements rather than measuring headings on every scroll.
 *
 * The active heading is the first heading inside the top band of the
 * viewport, or else the last heading that has scrolled above it.
 *
 * Intersection changes cover normal scrolling. Long jumps can skip headings
 * without any intersection change, so once scrolling settles the last heading
 * above the band is found by binary search (O(log n) layout reads).
 *
 * `contentVersion` must change whenever the rendered DOM is replaced.
 */
export function useActiveHeading(
  container: HTMLElement | null,
  headings: readonly Heading[],
  contentVersion: number,
): void {
  useEffect(() => {
    if (
      container === null ||
      headings.length === 0 ||
      typeof IntersectionObserver === 'undefined'
    ) {
      return undefined;
    }

    const elements: HTMLElement[] = [];
    const order = new Map<Element, number>();
    for (const heading of headings) {
      const el = findElementById(container, heading.id);
      if (el === null || order.has(el)) continue;
      order.set(el, elements.length);
      elements.push(el);
    }
    if (elements.length === 0) return undefined;

    const visible = new Set<number>();

    const lastAboveBand = (): number => {
      const bandTop = container.getBoundingClientRect().top + 1;
      let low = 0;
      let high = elements.length - 1;
      let found = -1;
      while (low <= high) {
        const mid = (low + high) >> 1;
        const top = elements[mid]?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY;
        if (top <= bandTop) {
          found = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }
      return found;
    };

    const update = () => {
      const active = visible.size > 0 ? Math.min(...visible) : lastAboveBand();
      setActiveHeading(active === -1 ? null : (elements[active]?.id ?? null), true);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = order.get(entry.target);
          if (index === undefined) continue;
          if (entry.isIntersecting) visible.add(index);
          else visible.delete(index);
        }
        update();
      },
      {
        root: container,
        rootMargin: `0px 0px -${Math.round((1 - ACTIVE_BAND) * 100)}% 0px`,
        threshold: 0,
      },
    );

    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      clearTimeout(settleTimer);
      settleTimer = setTimeout(update, SETTLE_MS);
    };
    container.addEventListener('scroll', onScroll, { passive: true });

    for (const el of elements) observer.observe(el);
    return () => {
      observer.disconnect();
      container.removeEventListener('scroll', onScroll);
      clearTimeout(settleTimer);
    };
  }, [container, headings, contentVersion]);
}
