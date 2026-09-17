// Mounts a document into the viewer: render (sync or chunked), lazy syntax
// highlighting, and scroll restoration once everything is in place.

import { createCodeHighlighter, type CodeHighlighter } from '@/lib/highlight/controller';
import {
  bumpContentVersion,
  scrollToElement,
  setRenderProgress,
  takePendingAnchor,
} from '@/stores/viewerStore';
import type { RenderContext } from './prepare';
import { renderDocument } from './render';

const HIGHLIGHT_SETTLE_MS = 150;

export interface MountOptions {
  /** The scroll container. */
  container: HTMLElement;
  /** The element receiving the document (`.markdown-body`). */
  content: HTMLElement;
  html: string;
  context: RenderContext;
  highlight: boolean;
  /** Scroll position to restore once rendering completes. */
  scrollTop: number;
  /** Return false to skip restoring (the user already scrolled). */
  shouldRestoreScroll: () => boolean;
  /** Called after the render completed and scroll was restored. */
  onComplete: () => void;
}

/** Renders the document and returns a disposer that cancels all pending work. */
export function mountDocument(options: MountOptions): () => void {
  const { container, content } = options;
  let highlighter: CodeHighlighter | null = null;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;

  if (options.highlight) {
    highlighter = createCodeHighlighter({
      root: container,
      onApplied: () => {
        // Highlighting replaces text nodes; let dependents (search) refresh once.
        clearTimeout(settleTimer);
        settleTimer = setTimeout(bumpContentVersion, HIGHLIGHT_SETTLE_MS);
      },
    });
  }

  const task = renderDocument(content, options.html, options.context, {
    onInsert: (root) => highlighter?.observe(root),
    onProgress: setRenderProgress,
    onComplete: () => {
      const anchor = takePendingAnchor();
      const jumped = anchor !== null && scrollToElement(anchor, { focus: false });
      if (!jumped && options.shouldRestoreScroll()) container.scrollTop = options.scrollTop;
      options.onComplete();
      bumpContentVersion();
    },
  });

  return () => {
    task.cancel();
    highlighter?.dispose();
    clearTimeout(settleTimer);
    setRenderProgress(1);
  };
}
