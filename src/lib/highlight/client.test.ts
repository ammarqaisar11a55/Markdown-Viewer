import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enhanceCodeBlock } from '@/lib/markdown/codeBlocks';
import { applyHighlight, highlightCode, setHighlightWorkerFactory } from './client';
import { createCodeHighlighter } from './controller';
import type { HighlightResult, WorkerRequest, WorkerResponse } from './protocol';

vi.mock('@/lib/platform/system', () => ({ copyText: () => Promise.resolve() }));
vi.mock('@/lib/platform/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const RESULT: HighlightResult = {
  base: { '--shiki-light': '#24292e', '--shiki-dark': '#e1e4e8' },
  styles: [{ '--shiki-light': '#d73a49', '--shiki-dark': '#f97583' }],
  lines: [
    [
      ['const', 0],
      [' x = 1;', -1],
    ],
    [['return', 0]],
  ],
};

class FakeWorker extends EventTarget {
  static instances: FakeWorker[] = [];
  posted: WorkerRequest[] = [];
  terminated = false;
  auto = true;

  constructor() {
    super();
    FakeWorker.instances.push(this);
  }

  postMessage(message: WorkerRequest): void {
    this.posted.push(message);
    if (this.auto && message.type === 'highlight') {
      queueMicrotask(() => this.respond({ type: 'result', id: message.id, ...RESULT }));
    }
  }

  respond(message: WorkerResponse): void {
    this.dispatchEvent(new MessageEvent('message', { data: message }));
  }

  terminate(): void {
    this.terminated = true;
  }
}

type ObserverCallback = (entries: Partial<IntersectionObserverEntry>[]) => void;
const observers: { callback: ObserverCallback; targets: Element[] }[] = [];

beforeEach(() => {
  FakeWorker.instances = [];
  observers.length = 0;
  setHighlightWorkerFactory(() => new FakeWorker() as unknown as Worker);
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      targets: Element[] = [];
      constructor(callback: ObserverCallback) {
        observers.push({ callback, targets: this.targets });
      }
      observe(el: Element) {
        this.targets.push(el);
      }
      unobserve(el: Element) {
        this.targets.splice(this.targets.indexOf(el), 1);
      }
      disconnect() {
        this.targets.length = 0;
      }
    },
  );
});

afterEach(() => {
  setHighlightWorkerFactory(null);
  vi.unstubAllGlobals();
});

describe('highlightCode', () => {
  it('uses one shared worker and matches responses by id', async () => {
    const [a, b] = await Promise.all([
      highlightCode('const x = 1;', 'typescript'),
      highlightCode('return', 'javascript'),
    ]);
    expect(a).toEqual(RESULT);
    expect(b).toEqual(RESULT);
    expect(FakeWorker.instances).toHaveLength(1);
    const ids = FakeWorker.instances[0]!.posted.map((m) => m.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('resolves null and cancels when aborted', async () => {
    const controller = new AbortController();
    const promise = highlightCode('x', 'rust', controller.signal);
    const worker = FakeWorker.instances[0]!;
    worker.auto = false;
    controller.abort();
    await expect(promise).resolves.toBeNull();
    expect(worker.posted.at(-1)).toMatchObject({ type: 'cancel' });
  });

  it('resolves null on worker errors', async () => {
    const promise = highlightCode('x', 'go');
    const worker = FakeWorker.instances[0]!;
    worker.auto = false;
    const request = worker.posted[0]!;
    worker.respond({ type: 'error', id: request.id, message: 'boom' });
    await expect(promise).resolves.toBeNull();
  });
});

describe('applyHighlight', () => {
  it('builds line and token spans with styles set through the CSSOM', () => {
    const code = document.createElement('code');
    applyHighlight(code, RESULT);
    const lines = code.querySelectorAll('.line');
    expect(lines).toHaveLength(2);
    expect(code.textContent).toBe('const x = 1;\nreturn');
    const token = code.querySelector<HTMLElement>('.shiki-token')!;
    expect(token.textContent).toBe('const');
    expect(token.style.getPropertyValue('--shiki-light')).toBe('#d73a49');
    expect(token.style.getPropertyValue('--shiki-dark')).toBe('#f97583');
    expect(token.getAttribute('style')).not.toBeNull();
    expect(code.style.getPropertyValue('--shiki-dark')).toBe('#e1e4e8');
    expect(code).toHaveClass('shiki');
  });
});

describe('createCodeHighlighter', () => {
  function block(lang: string | null): HTMLElement {
    const host = document.createElement('div');
    const pre = document.createElement('pre');
    const code = document.createElement('code');
    if (lang !== null) code.className = `language-${lang}`;
    code.textContent = 'const x = 1;\nreturn\n';
    pre.append(code);
    host.append(pre);
    document.body.replaceChildren(host);
    enhanceCodeBlock(pre);
    return host;
  }

  it('highlights known languages when they approach the viewport', async () => {
    const host = block('ts');
    const onApplied = vi.fn();
    const highlighter = createCodeHighlighter({ root: document.body, onApplied });
    highlighter.observe(host);
    const target = host.querySelector<HTMLElement>('.md-code-block')!;
    expect(observers[0]!.targets).toEqual([target]);

    observers[0]!.callback([{ target, isIntersecting: true }]);
    const request = FakeWorker.instances[0]!.posted[0]!;
    expect(request).toMatchObject({
      type: 'highlight',
      lang: 'typescript',
      code: 'const x = 1;\nreturn',
    });
    await vi.waitFor(() => expect(onApplied).toHaveBeenCalledWith(target));
    expect(target.dataset.highlight).toBe('done');
    expect(target.querySelector('.shiki-token')).not.toBeNull();
    highlighter.dispose();
  });

  it('skips unknown languages and blocks without a language', () => {
    const host = block('klingon');
    host.append(block(null).firstChild!);
    const highlighter = createCodeHighlighter({ root: document.body });
    highlighter.observe(host);
    for (const target of observers[0]!.targets.slice()) {
      observers[0]!.callback([{ target, isIntersecting: true }]);
    }
    expect(FakeWorker.instances).toHaveLength(0);
    highlighter.dispose();
  });

  it('does not apply results after dispose', async () => {
    const host = block('js');
    const onApplied = vi.fn();
    const highlighter = createCodeHighlighter({ root: document.body, onApplied });
    highlighter.observe(host);
    const target = host.querySelector<HTMLElement>('.md-code-block')!;
    observers[0]!.callback([{ target, isIntersecting: true }]);
    highlighter.dispose();
    await Promise.resolve();
    await Promise.resolve();
    expect(onApplied).not.toHaveBeenCalled();
    expect(target.querySelector('.shiki-token')).toBeNull();
    expect(FakeWorker.instances[0]!.posted.at(-1)).toMatchObject({ type: 'cancel' });
  });
});
