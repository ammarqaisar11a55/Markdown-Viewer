import { create } from 'zustand';
import { findElementById, prefersReducedMotion, scrollToTarget } from '@/lib/markdown/dom';
import type { Heading } from '@/types';

export interface ViewerState {
  /** The active document's scroll container. */
  container: HTMLElement | null;
  headings: Heading[];
  activeHeadingId: string | null;
  /** Progress of the current render (0..1); 1 when idle. */
  renderProgress: number;
  /** Increments whenever the rendered DOM changed (render finished, blocks highlighted). */
  contentVersion: number;
}

const initialState: ViewerState = {
  container: null,
  headings: [],
  activeHeadingId: null,
  renderProgress: 1,
  contentVersion: 0,
};

export const useViewer = create<ViewerState>()(() => initialState);

/** Active-heading updates from scrolling are ignored briefly after a jump. */
const JUMP_LOCK_MS = 800;
let jumpLockUntil = 0;

interface PendingAnchor {
  id: string;
  expires: number;
}
let pendingAnchor: PendingAnchor | null = null;
const PENDING_ANCHOR_TTL_MS = 15_000;

/** Sets the active scroll container (`null` when the viewer unmounts). */
export function registerViewer(container: HTMLElement | null): void {
  useViewer.setState(
    container === null
      ? { container: null, activeHeadingId: null, renderProgress: 1 }
      : { container, activeHeadingId: null },
  );
}

export function setViewerHeadings(headings: Heading[]): void {
  useViewer.setState({ headings });
}

export function setRenderProgress(progress: number): void {
  const value = Math.min(1, Math.max(0, progress));
  if (useViewer.getState().renderProgress !== value) useViewer.setState({ renderProgress: value });
}

export function bumpContentVersion(): void {
  useViewer.setState((state) => ({ contentVersion: state.contentVersion + 1 }));
}

/** Sets the highlighted outline entry. `fromScroll` updates respect the jump lock. */
export function setActiveHeading(id: string | null, fromScroll = false): void {
  if (fromScroll && Date.now() < jumpLockUntil) return;
  if (useViewer.getState().activeHeadingId !== id) useViewer.setState({ activeHeadingId: id });
}

/** Scrolls the viewer to the element with `id` (a heading, footnote, …). Returns false if not found. */
export function scrollToElement(id: string, options: { focus?: boolean } = {}): boolean {
  const { container, headings } = useViewer.getState();
  if (container === null) return false;
  const target = findElementById(container, id);
  if (target === null) return false;

  const chunked = target.closest('[data-chunked]') !== null;
  const behavior: ScrollBehavior = prefersReducedMotion() || chunked ? 'auto' : 'smooth';
  scrollToTarget(container, target, behavior);
  if (chunked) {
    // Chunks above may have been laid out with estimated sizes; re-align once
    // the chunks around the target have rendered.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (target.isConnected) scrollToTarget(container, target, 'auto');
      }),
    );
  }

  if (headings.some((heading) => heading.id === id)) {
    jumpLockUntil = Date.now() + JUMP_LOCK_MS;
    useViewer.setState({ activeHeadingId: id });
  }
  if (options.focus !== false) {
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }
  return true;
}

/** Scrolls to a heading from the outline and moves focus to it. */
export function scrollToHeading(id: string): void {
  scrollToElement(id);
}

/** Remembers an anchor to scroll to once the next document finishes rendering. */
export function setPendingAnchor(id: string | null): void {
  pendingAnchor = id === null ? null : { id, expires: Date.now() + PENDING_ANCHOR_TTL_MS };
}

/** Returns and clears the pending anchor, if still fresh. */
export function takePendingAnchor(): string | null {
  const anchor = pendingAnchor;
  pendingAnchor = null;
  if (anchor === null || Date.now() > anchor.expires) return null;
  return anchor.id;
}

export function hasPendingAnchor(): boolean {
  return pendingAnchor !== null;
}
