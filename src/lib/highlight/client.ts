// Main-thread side of syntax highlighting: a single shared worker with
// request/response matching by id, and DOM application of the results.

import { logger } from '@/lib/platform/logger';
import type { SupportedLanguage } from './languages';
import type { HighlightResult, WorkerRequest, WorkerResponse } from './protocol';

export type WorkerFactory = () => Worker;

interface Pending {
  resolve: (result: HighlightResult | null) => void;
}

const defaultFactory: WorkerFactory = () =>
  new Worker(new URL('./highlight.worker.ts', import.meta.url), {
    type: 'module',
    name: 'highlighter',
  });

let factory: WorkerFactory = defaultFactory;
let worker: Worker | null = null;
let broken = false;
let nextId = 1;
const pending = new Map<number, Pending>();

function failAll(): void {
  for (const entry of pending.values()) entry.resolve(null);
  pending.clear();
}

function getWorker(): Worker | null {
  if (broken) return null;
  if (worker !== null) return worker;
  try {
    const created = factory();
    created.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      const entry = pending.get(message.id);
      if (entry === undefined) return;
      pending.delete(message.id);
      if (message.type === 'error') {
        logger.warn('Syntax highlighting failed for a code block', message.message);
        entry.resolve(null);
        return;
      }
      const { base, styles, lines } = message;
      entry.resolve({ base, styles, lines });
    });
    created.addEventListener('error', (event) => {
      logger.error('Syntax highlighting worker crashed', event.message);
      broken = true;
      created.terminate();
      worker = null;
      failAll();
    });
    worker = created;
    return created;
  } catch (error) {
    logger.error('Unable to start the syntax highlighting worker', error);
    broken = true;
    return null;
  }
}

/**
 * Highlights `code` in the worker. Resolves `null` when highlighting is not
 * possible or the request was aborted.
 */
export function highlightCode(
  code: string,
  lang: SupportedLanguage,
  signal?: AbortSignal,
): Promise<HighlightResult | null> {
  if (signal?.aborted === true) return Promise.resolve(null);
  const target = getWorker();
  if (target === null) return Promise.resolve(null);

  const id = nextId++;
  return new Promise((resolve) => {
    const onAbort = () => {
      if (!pending.delete(id)) return;
      target.postMessage({ type: 'cancel', id } satisfies WorkerRequest);
      resolve(null);
    };
    pending.set(id, {
      resolve: (result) => {
        signal?.removeEventListener('abort', onAbort);
        resolve(result);
      },
    });
    signal?.addEventListener('abort', onAbort, { once: true });
    target.postMessage({ type: 'highlight', id, code, lang } satisfies WorkerRequest);
  });
}

/** Replaces the worker factory (tests) and resets the client state. */
export function setHighlightWorkerFactory(next: WorkerFactory | null): void {
  worker?.terminate();
  worker = null;
  broken = false;
  failAll();
  factory = next ?? defaultFactory;
}

function applyStyle(el: HTMLElement, style: Record<string, string> | undefined): void {
  if (style === undefined) return;
  for (const [key, value] of Object.entries(style)) el.style.setProperty(key, value);
}

/**
 * Renders highlight tokens into `code` (one `span.line` per line, one
 * `span.shiki-token` per colored token). Styles go through the CSSOM because
 * the CSP forbids `style` attributes.
 */
export function applyHighlight(code: HTMLElement, result: HighlightResult): void {
  const doc = code.ownerDocument;
  const fragment = doc.createDocumentFragment();
  result.lines.forEach((tokens, index) => {
    if (index > 0) fragment.append('\n');
    const line = doc.createElement('span');
    line.className = 'line';
    for (const [content, styleIndex] of tokens) {
      if (styleIndex < 0) {
        line.append(content);
        continue;
      }
      const span = doc.createElement('span');
      span.className = 'shiki-token';
      span.textContent = content;
      applyStyle(span, result.styles[styleIndex]);
      line.append(span);
    }
    fragment.append(line);
  });
  applyStyle(code, result.base);
  code.classList.add('shiki');
  code.replaceChildren(fragment);
}
