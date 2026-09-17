import { languageLabel } from '@/lib/highlight/languages';
import { logger } from '@/lib/platform/logger';
import { copyText } from '@/lib/platform/system';
import { createElement, createIcon } from './dom';

/** Blocks above either limit are never highlighted (and not split into lines). */
export const MAX_HIGHLIGHT_CHARS = 200_000;
export const MAX_HIGHLIGHT_LINES = 5_000;
const COPIED_RESET_MS = 1600;

export interface CodeBlockInfo {
  /** Original, unmodified code text. */
  code: string;
  /** Language from the info string, or `null`. */
  lang: string | null;
  /** Whether the block is small enough to be highlighted. */
  highlightable: boolean;
}

const blockInfo = new WeakMap<HTMLElement, CodeBlockInfo>();

/** Info about an enhanced code block (the `.md-code-block` element). */
export function getCodeBlockInfo(block: HTMLElement): CodeBlockInfo | undefined {
  return blockInfo.get(block);
}

function languageOf(code: HTMLElement): string | null {
  for (const cls of code.classList) {
    if (cls.startsWith('language-')) {
      const lang = cls.slice('language-'.length);
      if (lang !== '') return lang;
    }
  }
  return null;
}

/** Splits code into lines, ignoring the single trailing newline. */
export function splitLines(code: string): string[] {
  const lines = code.split('\n');
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/** Replaces `code`'s children with one `<span class="line">` per line. */
export function fillLines(code: HTMLElement, lines: string[]): void {
  const doc = code.ownerDocument;
  const fragment = doc.createDocumentFragment();
  lines.forEach((line, index) => {
    if (index > 0) fragment.append('\n');
    fragment.append(createElement(doc, 'span', 'line', line));
  });
  code.replaceChildren(fragment);
}

function createCopyButton(doc: Document, getText: () => string): HTMLButtonElement {
  const button = createElement(doc, 'button', 'md-code-copy');
  button.type = 'button';
  button.setAttribute('aria-label', 'Copy code');
  button.title = 'Copy code';
  button.dataset.searchIgnore = '';
  const label = createElement(doc, 'span', 'md-code-copy-label', 'Copy');
  const status = createElement(doc, 'span', 'md-sr-only');
  status.setAttribute('aria-live', 'polite');
  button.append(
    createIcon(doc, 'copy', 'md-icon md-icon-copy'),
    createIcon(doc, 'check', 'md-icon md-icon-check'),
  );
  button.append(label, status);

  let timer: ReturnType<typeof setTimeout> | undefined;
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    copyText(getText()).then(
      () => {
        clearTimeout(timer);
        button.dataset.copied = 'true';
        label.textContent = 'Copied';
        status.textContent = 'Code copied to clipboard';
        timer = setTimeout(() => {
          delete button.dataset.copied;
          label.textContent = 'Copy';
          status.textContent = '';
        }, COPIED_RESET_MS);
      },
      (error: unknown) => {
        logger.error('Failed to copy code block', error);
        status.textContent = 'Could not copy code';
      },
    );
  });
  return button;
}

/**
 * Wraps a `<pre><code>` block in a container with a language label and a copy
 * button, and splits its text into line spans (for line numbers).
 */
export function enhanceCodeBlock(pre: HTMLPreElement): HTMLElement {
  const doc = pre.ownerDocument;
  const code = pre.querySelector(':scope > code') ?? pre;
  const text = code.textContent;
  const lang = code instanceof HTMLElement && code !== pre ? languageOf(code) : null;
  const lines = splitLines(text);
  const highlightable = text.length <= MAX_HIGHLIGHT_CHARS && lines.length <= MAX_HIGHLIGHT_LINES;

  const block = createElement(doc, 'div', 'md-code-block');
  const label = languageLabel(lang);
  if (lang !== null) block.dataset.lang = lang;

  const header = createElement(
    doc,
    'div',
    label === null ? 'md-code-header md-code-header-floating' : 'md-code-header',
  );
  header.dataset.searchIgnore = '';
  if (label !== null) header.append(createElement(doc, 'span', 'md-code-lang', label));
  header.append(createCopyButton(doc, () => text));

  pre.replaceWith(block);
  pre.classList.add('md-code');
  if (highlightable && code instanceof HTMLElement) fillLines(code, lines);
  else pre.classList.add('md-code-plain');
  pre.style.setProperty('--md-line-digits', String(Math.max(2, String(lines.length).length)));
  pre.tabIndex = 0;
  if (label !== null) pre.setAttribute('aria-label', `${label} code`);
  block.append(header, pre);

  blockInfo.set(block, { code: text, lang, highlightable });
  return block;
}
