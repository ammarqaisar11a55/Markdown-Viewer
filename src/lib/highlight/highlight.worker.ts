// Syntax highlighting worker: Shiki core + JavaScript regex engine, with
// grammars loaded on demand. One highlighter instance is cached for the
// lifetime of the worker.

import { createHighlighterCore, type HighlighterCore } from '@shikijs/core';
import { createJavaScriptRegexEngine } from '@shikijs/engine-javascript';
import { GRAMMARS } from './grammars';
import type { SupportedLanguage } from './languages';
import type { HighlightRequest, WorkerRequest, WorkerResponse } from './protocol';
import { compactTokens } from './tokens';

interface WorkerScope {
  postMessage(message: WorkerResponse): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<WorkerRequest>) => void): void;
}

const scope = self as unknown as WorkerScope;

let highlighterPromise: Promise<HighlighterCore> | null = null;
const languageLoads = new Map<SupportedLanguage, Promise<void>>();
const inFlight = new Set<number>();
const cancelled = new Set<number>();

function getHighlighter(): Promise<HighlighterCore> {
  highlighterPromise ??= createHighlighterCore({
    engine: createJavaScriptRegexEngine({ forgiving: true }),
    themes: [import('@shikijs/themes/github-light'), import('@shikijs/themes/github-dark')],
    langs: [],
    warnings: false,
  });
  return highlighterPromise;
}

async function ensureLanguage(
  highlighter: HighlighterCore,
  lang: SupportedLanguage,
): Promise<void> {
  let load = languageLoads.get(lang);
  if (load === undefined) {
    load = highlighter.loadLanguage(GRAMMARS[lang]());
    languageLoads.set(lang, load);
    load.catch(() => languageLoads.delete(lang));
  }
  await load;
}

function post(message: WorkerResponse): void {
  scope.postMessage(message);
}

async function highlight(request: HighlightRequest): Promise<void> {
  inFlight.add(request.id);
  try {
    const highlighter = await getHighlighter();
    await ensureLanguage(highlighter, request.lang);
    if (cancelled.has(request.id)) return;
    const tokens = highlighter.codeToTokens(request.code, {
      lang: request.lang,
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
    });
    post({ type: 'result', id: request.id, ...compactTokens(tokens) });
  } catch (error) {
    if (cancelled.has(request.id)) return;
    post({
      type: 'error',
      id: request.id,
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    inFlight.delete(request.id);
    cancelled.delete(request.id);
  }
}

scope.addEventListener('message', (event) => {
  const message = event.data;
  if (message.type === 'cancel') {
    if (inFlight.has(message.id)) cancelled.add(message.id);
    return;
  }
  void highlight(message);
});
