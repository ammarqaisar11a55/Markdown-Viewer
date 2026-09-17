import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  registerViewer,
  scrollToHeading,
  setActiveHeading,
  setPendingAnchor,
  setRenderProgress,
  setViewerHeadings,
  takePendingAnchor,
  useViewer,
} from './viewerStore';

function setupContainer(): { container: HTMLElement; heading: HTMLElement } {
  const container = document.createElement('div');
  container.innerHTML =
    '<div id="root">app element</div><h2 id="intro">Intro</h2><h2 id="1-setup">Setup</h2>';
  document.body.replaceChildren(container);
  container.getBoundingClientRect = () => ({ top: 100 }) as DOMRect;
  container.scrollTo = vi.fn();
  const heading = container.querySelector<HTMLElement>('[id="1-setup"]')!;
  heading.getBoundingClientRect = () => ({ top: 700 }) as DOMRect;
  return { container, heading };
}

beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query }));
  registerViewer(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  registerViewer(null);
});

describe('viewerStore', () => {
  it('registers and clears the viewer', () => {
    const { container } = setupContainer();
    registerViewer(container);
    setViewerHeadings([{ id: 'intro', level: 2, text: 'Intro' }]);
    expect(useViewer.getState().container).toBe(container);
    registerViewer(null);
    setViewerHeadings([]);
    expect(useViewer.getState()).toMatchObject({ container: null, headings: [] });
  });

  it('scrolls to a heading smoothly, marks it active and focuses it', () => {
    const { container, heading } = setupContainer();
    container.scrollTop = 50;
    registerViewer(container);
    setViewerHeadings([
      { id: 'intro', level: 2, text: 'Intro' },
      { id: '1-setup', level: 2, text: 'Setup' },
    ]);

    scrollToHeading('1-setup');

    expect(container.scrollTo).toHaveBeenCalledWith({ top: 650, behavior: 'smooth' });
    expect(useViewer.getState().activeHeadingId).toBe('1-setup');
    expect(heading).toHaveAttribute('tabindex', '-1');
    expect(document.activeElement).toBe(heading);
  });

  it('uses instant scrolling when reduced motion is preferred', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: true, media: query }));
    const { container } = setupContainer();
    registerViewer(container);
    scrollToHeading('1-setup');
    expect(container.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }));
  });

  it('ignores unknown ids', () => {
    const { container } = setupContainer();
    registerViewer(container);
    scrollToHeading('missing');
    expect(container.scrollTo).not.toHaveBeenCalled();
    expect(useViewer.getState().activeHeadingId).toBeNull();
  });

  it('locks scroll-driven active heading updates briefly after a jump', () => {
    const { container } = setupContainer();
    registerViewer(container);
    setViewerHeadings([
      { id: 'intro', level: 2, text: 'Intro' },
      { id: '1-setup', level: 2, text: 'Setup' },
    ]);
    scrollToHeading('1-setup');
    setActiveHeading('intro', true);
    expect(useViewer.getState().activeHeadingId).toBe('1-setup');
    setActiveHeading('intro');
    expect(useViewer.getState().activeHeadingId).toBe('intro');
  });

  it('clamps render progress', () => {
    setRenderProgress(3);
    expect(useViewer.getState().renderProgress).toBe(1);
    setRenderProgress(-1);
    expect(useViewer.getState().renderProgress).toBe(0);
    setRenderProgress(1);
  });

  it('hands out a pending anchor once', () => {
    setPendingAnchor('usage');
    expect(takePendingAnchor()).toBe('usage');
    expect(takePendingAnchor()).toBeNull();
  });
});
