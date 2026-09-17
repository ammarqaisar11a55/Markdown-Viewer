// Inserts a document into the viewer: synchronously for ordinary documents,
// and in `content-visibility` chunks spread over animation frames for large
// ones so the window stays responsive.

import { createElement } from './dom';
import { enhanceTree, parseHtml, prepareFragment, type RenderContext } from './prepare';

/** HTML size above which a document is inserted in chunks. */
export const CHUNKED_RENDER_THRESHOLD = 300_000;
/** Approximate text length per chunk. */
export const CHUNK_TARGET_CHARS = 40_000;
const MAX_NODES_PER_CHUNK = 400;
const FRAME_BUDGET_MS = 10;

export interface RenderCallbacks {
  /** Called for every inserted subtree (the whole content, or each chunk). */
  onInsert?: (root: HTMLElement) => void;
  /** Progress of a chunked render, 0..1. */
  onProgress?: (progress: number) => void;
  /** Called once when everything has been inserted. Not called if cancelled. */
  onComplete?: () => void;
}

export interface RenderTask {
  readonly chunked: boolean;
  cancel(): void;
}

/** Groups top-level nodes into chunks of roughly `targetChars` of text. */
export function splitIntoChunks(
  nodes: readonly Node[],
  targetChars = CHUNK_TARGET_CHARS,
): Node[][] {
  const chunks: Node[][] = [];
  let current: Node[] = [];
  let size = 0;
  for (const node of nodes) {
    current.push(node);
    size += node.textContent?.length ?? 0;
    if (size >= targetChars || current.length >= MAX_NODES_PER_CHUNK) {
      chunks.push(current);
      current = [];
      size = 0;
    }
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/**
 * Appends pre-split chunks to `target`, one `div.md-chunk` each. The first
 * chunk is inserted synchronously; the rest across animation frames within a
 * small time budget per frame.
 */
export function insertChunks(
  target: HTMLElement,
  chunks: readonly Node[][],
  ctx: RenderContext,
  callbacks: RenderCallbacks = {},
): RenderTask {
  const doc = target.ownerDocument;
  let index = 0;
  let frame: number | null = null;
  let cancelled = false;

  const insertNext = () => {
    const nodes = chunks[index];
    index += 1;
    if (nodes === undefined) return;
    const chunk = createElement(doc, 'div', 'md-chunk');
    chunk.append(...nodes);
    enhanceTree(chunk, ctx);
    target.append(chunk);
    callbacks.onInsert?.(chunk);
  };

  const step = () => {
    frame = null;
    if (cancelled) return;
    const start = performance.now();
    do {
      insertNext();
    } while (index < chunks.length && performance.now() - start < FRAME_BUDGET_MS);
    callbacks.onProgress?.(index / chunks.length);
    if (index < chunks.length) {
      frame = requestAnimationFrame(step);
    } else {
      callbacks.onComplete?.();
    }
  };

  if (chunks.length === 0) {
    callbacks.onProgress?.(1);
    callbacks.onComplete?.();
  } else {
    insertNext();
    callbacks.onProgress?.(index / chunks.length);
    if (index < chunks.length) frame = requestAnimationFrame(step);
    else callbacks.onComplete?.();
  }

  return {
    chunked: true,
    cancel() {
      cancelled = true;
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
    },
  };
}

/**
 * Replaces `target`'s content with the rendered document. Chunked renders mark
 * `target` with `data-chunked` (layout of off-screen chunks is estimated).
 */
export function renderDocument(
  target: HTMLElement,
  html: string,
  ctx: RenderContext,
  callbacks: RenderCallbacks = {},
): RenderTask {
  if (html.length <= CHUNKED_RENDER_THRESHOLD) {
    delete target.dataset.chunked;
    target.replaceChildren(prepareFragment(html, ctx, target.ownerDocument));
    callbacks.onInsert?.(target);
    callbacks.onProgress?.(1);
    callbacks.onComplete?.();
    return { chunked: false, cancel: () => undefined };
  }
  target.dataset.chunked = 'true';
  target.replaceChildren();
  const fragment = parseHtml(html, target.ownerDocument);
  const chunks = splitIntoChunks(Array.from(fragment.childNodes));
  return insertChunks(target, chunks, ctx, callbacks);
}
