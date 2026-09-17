// Highlights code blocks lazily as they approach the viewport.

import { getCodeBlockInfo, splitLines } from '@/lib/markdown/codeBlocks';
import { applyHighlight, highlightCode } from './client';
import { resolveLanguage } from './languages';

export interface CodeHighlighter {
  /** Starts watching every code block inside `root`. */
  observe(root: ParentNode): void;
  /** Stops observing and aborts pending work. */
  dispose(): void;
}

export interface CodeHighlighterOptions {
  /** Scroll container used as the IntersectionObserver root. */
  root: HTMLElement;
  /** Called after a block's DOM was replaced with highlighted markup. */
  onApplied?: (block: HTMLElement) => void;
  rootMargin?: string;
}

export function createCodeHighlighter({
  root,
  onApplied,
  rootMargin = '600px 0px',
}: CodeHighlighterOptions): CodeHighlighter {
  const controller = new AbortController();

  const highlight = (block: HTMLElement) => {
    const info = getCodeBlockInfo(block);
    const lang = resolveLanguage(info?.lang);
    const code = block.querySelector<HTMLElement>('pre > code');
    if (info === undefined || lang === null || code === null || !info.highlightable) return;
    block.dataset.highlight = 'pending';
    const text = splitLines(info.code).join('\n');
    void highlightCode(text, lang, controller.signal).then((result) => {
      if (controller.signal.aborted || !block.isConnected) return;
      if (result === null) {
        delete block.dataset.highlight;
        return;
      }
      applyHighlight(code, result);
      block.dataset.highlight = 'done';
      onApplied?.(block);
    });
  };

  const observer =
    typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue;
              observer?.unobserve(entry.target);
              highlight(entry.target as HTMLElement);
            }
          },
          { root, rootMargin },
        );

  return {
    observe(scope) {
      if (controller.signal.aborted) return;
      const blocks = scope.querySelectorAll<HTMLElement>('.md-code-block[data-lang]');
      for (const block of blocks) {
        if (block.dataset.highlight !== undefined) continue;
        if (observer === null) highlight(block);
        else observer.observe(block);
      }
    },
    dispose() {
      controller.abort();
      observer?.disconnect();
    },
  };
}
