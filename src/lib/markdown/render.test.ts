import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHUNKED_RENDER_THRESHOLD, insertChunks, renderDocument, splitIntoChunks } from './render';

vi.mock('@/lib/platform/system', () => ({
  toAssetUrl: (path: string) => `mdasset://localhost/${path}`,
  copyText: () => Promise.resolve(),
}));

const ctx = { docPath: '/d/doc.md', loadRemoteImages: true };

let frames: FrameRequestCallback[] = [];

function flushFrame(): void {
  const pending = frames;
  frames = [];
  for (const cb of pending) cb(performance.now());
}

beforeEach(() => {
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.push(cb);
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    frames.splice(id - 1, 1, () => undefined);
  });
  // Deterministic time: every insertion exceeds the frame budget.
  let now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => (now += 50));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function paragraphs(count: number, size: number): Node[] {
  return Array.from({ length: count }, () => {
    const p = document.createElement('p');
    p.textContent = 'a'.repeat(size);
    return p;
  });
}

describe('splitIntoChunks', () => {
  it('groups nodes by text size', () => {
    const chunks = splitIntoChunks(paragraphs(10, 30), 100);
    expect(chunks.map((c) => c.length)).toEqual([4, 4, 2]);
  });

  it('caps the number of nodes per chunk', () => {
    const chunks = splitIntoChunks(paragraphs(1000, 0), 100);
    expect(chunks.map((c) => c.length)).toEqual([400, 400, 200]);
  });
});

describe('insertChunks', () => {
  it('inserts the first chunk synchronously and the rest across frames', () => {
    const target = document.createElement('div');
    const onProgress = vi.fn();
    const onComplete = vi.fn();
    const onInsert = vi.fn();
    const chunks = splitIntoChunks(paragraphs(6, 10), 20);
    insertChunks(target, chunks, ctx, { onProgress, onComplete, onInsert });

    expect(target.querySelectorAll('.md-chunk')).toHaveLength(1);
    expect(onProgress).toHaveBeenLastCalledWith(1 / 3);
    expect(onComplete).not.toHaveBeenCalled();

    flushFrame();
    expect(target.querySelectorAll('.md-chunk')).toHaveLength(2);
    flushFrame();
    expect(target.querySelectorAll('.md-chunk')).toHaveLength(3);
    expect(target.querySelectorAll('p')).toHaveLength(6);
    expect(onProgress).toHaveBeenLastCalledWith(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onInsert).toHaveBeenCalledTimes(3);
    expect(frames).toHaveLength(0);
  });

  it('enhances each chunk before insertion', () => {
    const target = document.createElement('div');
    const pre = document.createElement('pre');
    pre.innerHTML = '<code class="language-js">x\n</code>';
    insertChunks(target, [[pre]], ctx);
    expect(target.querySelector('.md-chunk > .md-code-block')).not.toBeNull();
  });

  it('stops when cancelled', () => {
    const target = document.createElement('div');
    const onComplete = vi.fn();
    const task = insertChunks(target, splitIntoChunks(paragraphs(6, 10), 20), ctx, {
      onComplete,
    });
    task.cancel();
    flushFrame();
    flushFrame();
    expect(target.querySelectorAll('.md-chunk')).toHaveLength(1);
    expect(onComplete).not.toHaveBeenCalled();
  });
});

describe('renderDocument', () => {
  it('renders small documents synchronously', () => {
    const target = document.createElement('div');
    target.innerHTML = '<p>old</p>';
    const onComplete = vi.fn();
    const task = renderDocument(target, '<h1 id="t">Title</h1><p>Body</p>', ctx, { onComplete });
    expect(task.chunked).toBe(false);
    expect(target.innerHTML).not.toContain('old');
    expect(target.querySelector('h1')?.id).toBe('t');
    expect(target.querySelector('.md-chunk')).toBeNull();
    expect(target.dataset.chunked).toBeUndefined();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('renders large documents in chunks', () => {
    const target = document.createElement('div');
    const count = Math.ceil(CHUNKED_RENDER_THRESHOLD / 10_000) + 1;
    const html = `<p>${'word '.repeat(2000)}</p>\n`.repeat(count);
    const onComplete = vi.fn();
    const task = renderDocument(target, html, ctx, { onComplete });
    expect(task.chunked).toBe(true);
    expect(target.dataset.chunked).toBe('true');
    while (frames.length > 0) flushFrame();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(target.querySelectorAll('.md-chunk').length).toBeGreaterThan(1);
    expect(target.querySelectorAll('p')).toHaveLength(count);
  });
});
