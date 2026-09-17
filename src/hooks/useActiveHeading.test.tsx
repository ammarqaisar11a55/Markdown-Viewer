import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setActiveHeading, useViewer } from '@/stores/viewerStore';
import type { Heading } from '@/types';
import { useActiveHeading } from './useActiveHeading';

type Callback = (entries: Partial<IntersectionObserverEntry>[]) => void;
let observer: { callback: Callback; targets: Element[]; options: IntersectionObserverInit } | null;

const HEADINGS: Heading[] = [
  { id: 'a', level: 1, text: 'A' },
  { id: 'b', level: 2, text: 'B' },
  { id: 'c', level: 2, text: 'C' },
];

function setup(): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = '<h1 id="a">A</h1><p>x</p><h2 id="b">B</h2><h2 id="c">C</h2>';
  document.body.replaceChildren(container);
  container.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
  return container;
}

function setTops(container: HTMLElement, tops: Record<string, number>): void {
  for (const [id, top] of Object.entries(tops)) {
    container.querySelector(`#${id}`)!.getBoundingClientRect = () => ({ top }) as DOMRect;
  }
}

beforeEach(() => {
  observer = null;
  setActiveHeading(null);
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: Callback, options: IntersectionObserverInit) {
        observer = { callback, targets: [], options };
      }
      observe(el: Element) {
        observer!.targets.push(el);
      }
      disconnect() {
        observer!.targets.length = 0;
      }
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('useActiveHeading', () => {
  it('observes headings within the container', () => {
    const container = setup();
    const { unmount } = renderHook(() => useActiveHeading(container, HEADINGS, 0));
    expect(observer!.targets.map((el) => el.id)).toEqual(['a', 'b', 'c']);
    expect(observer!.options.root).toBe(container);
    unmount();
    expect(observer!.targets).toHaveLength(0);
  });

  it('activates the first heading inside the reading band', () => {
    const container = setup();
    setTops(container, { a: -500, b: 100, c: 900 });
    renderHook(() => useActiveHeading(container, HEADINGS, 0));
    const [a, b, c] = observer!.targets as [Element, Element, Element];
    act(() => {
      observer!.callback([
        { target: a, isIntersecting: false },
        { target: b, isIntersecting: true },
        { target: c, isIntersecting: true },
      ]);
    });
    expect(useViewer.getState().activeHeadingId).toBe('b');
  });

  it('falls back to the last heading above the band', () => {
    const container = setup();
    setTops(container, { a: -900, b: -300, c: 800 });
    renderHook(() => useActiveHeading(container, HEADINGS, 0));
    const b = observer!.targets[1]!;
    act(() => {
      observer!.callback([{ target: b, isIntersecting: false }]);
    });
    expect(useViewer.getState().activeHeadingId).toBe('b');
  });

  it('re-checks after scrolling settles', () => {
    vi.useFakeTimers();
    const container = setup();
    setTops(container, { a: 50, b: 400, c: 900 });
    renderHook(() => useActiveHeading(container, HEADINGS, 0));
    setTops(container, { a: -3000, b: -2000, c: -10 });
    act(() => {
      container.dispatchEvent(new Event('scroll'));
      vi.advanceTimersByTime(200);
    });
    expect(useViewer.getState().activeHeadingId).toBe('c');
  });
});
