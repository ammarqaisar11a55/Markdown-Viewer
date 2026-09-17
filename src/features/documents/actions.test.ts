import { useDocuments, getActiveTab } from '@/stores/documentsStore';
import { useRecent } from '@/stores/recentStore';
import { updateSettings } from '@/stores/settingsStore';
import { useToasts } from '@/stores/toastStore';
import { useFolder } from '@/stores/folderStore';
import {
  deferred,
  flushPromises,
  throwFsError,
  makeDoc,
  mockBackend,
  resetAppState,
} from '@/test/state';
import { setTauriRuntime } from '@/test/tauri';
import type { DirectoryTree, OpenedDocument } from '@/types';
import {
  activateNextTab,
  activatePreviousTab,
  activateTab,
  closeAllTabs,
  closeOtherTabs,
  closeTab,
  dismissExternalChange,
  handleFileChanged,
  openDocument,
  openPaths,
  reloadDocument,
  reopenClosedTab,
  rerenderAllDocuments,
  setTabScroll,
} from './actions';

const tabs = () => useDocuments.getState().tabs;
const toasts = () => useToasts.getState().toasts;

function fileBackend(files: Record<string, OpenedDocument | Error>) {
  return mockBackend({
    open_document: ({ path }) => {
      const entry = files[path as string];
      if (entry === undefined) throwFsError('notFound', `ENOENT ${String(path)}`);
      if (entry instanceof Error) throwFsError('io', entry.message);
      return entry;
    },
    check_files: ({ paths }) => (paths as string[]).map((p) => p in files),
  });
}

beforeEach(resetAppState);

describe('openDocument', () => {
  it('opens a tab that becomes ready and is added to recent', async () => {
    fileBackend({ '/d/a.md': makeDoc('/d/a.md') });
    const promise = openDocument('/d/a.md');
    expect(tabs()[0]).toMatchObject({ status: 'loading', name: 'a.md' });
    expect(useDocuments.getState().activeId).toBe(tabs()[0]!.id);
    await promise;
    expect(tabs()[0]).toMatchObject({ status: 'ready', revision: 1, error: null });
    expect(tabs()[0]!.doc?.html).toContain('a.md');
    expect(useRecent.getState().items.map((i) => i.path)).toEqual(['/d/a.md']);
  });

  it('passes the renderHtml setting to the backend', async () => {
    const backend = fileBackend({ '/d/a.md': makeDoc('/d/a.md') });
    updateSettings({ renderHtml: false });
    await openDocument('/d/a.md');
    expect(backend.callsOf('open_document')[0]?.args).toEqual({
      path: '/d/a.md',
      options: { allowHtml: false },
    });
  });

  it('activates an existing tab instead of opening the same path twice', async () => {
    const backend = fileBackend({ '/d/a.md': makeDoc('/d/a.md'), '/d/b.md': makeDoc('/d/b.md') });
    await openDocument('/d/a.md');
    await openDocument('/d/b.md');
    await openDocument('/d/./a.md');
    expect(tabs()).toHaveLength(2);
    expect(getActiveTab()?.path).toBe('/d/a.md');
    expect(backend.callsOf('open_document')).toHaveLength(2);
  });

  it('merges tabs whose paths canonicalize to an open document', async () => {
    fileBackend({ '/d/a.md': makeDoc('/d/a.md'), '/d/link.md': makeDoc('/d/a.md') });
    await openDocument('/d/a.md');
    await openDocument('/d/link.md');
    expect(tabs()).toHaveLength(1);
    expect(getActiveTab()?.path).toBe('/d/a.md');
  });

  it('replaces the active tab when openInNewTab is off', async () => {
    fileBackend({ '/d/a.md': makeDoc('/d/a.md'), '/d/b.md': makeDoc('/d/b.md') });
    updateSettings({ openInNewTab: false });
    await openDocument('/d/a.md');
    await openDocument('/d/b.md');
    expect(tabs().map((t) => t.path)).toEqual(['/d/b.md']);
    expect(useDocuments.getState().closedPaths).toEqual(['/d/a.md']);
    await openDocument('/d/a.md', { newTab: true });
    expect(tabs()).toHaveLength(2);
  });

  it('can open without activating', async () => {
    fileBackend({ '/d/a.md': makeDoc('/d/a.md'), '/d/b.md': makeDoc('/d/b.md') });
    await openDocument('/d/a.md');
    await openDocument('/d/b.md', { activate: false, scrollTop: 40 });
    expect(getActiveTab()?.path).toBe('/d/a.md');
    expect(tabs()[1]?.scrollTop).toBe(40);
  });

  it('shows a friendly error on failure', async () => {
    fileBackend({});
    await openDocument('/gone.md');
    expect(tabs()[0]).toMatchObject({
      status: 'error',
      doc: null,
      error: { kind: 'notFound', title: 'Unable to open this file.' },
    });
    expect(toasts()).toEqual([
      expect.objectContaining({
        variant: 'error',
        title: 'Unable to open this file.',
        description: 'The file may have been moved or deleted.',
      }),
    ]);
    expect(useRecent.getState().items).toEqual([]);
  });

  it('watches opened files and unwatches closed ones', async () => {
    setTauriRuntime(true);
    const backend = fileBackend({ '/d/a.md': makeDoc('/d/a.md') });
    await openDocument('/d/a.md');
    expect(backend.callsOf('watch_file').map((c) => c.args)).toEqual([{ path: '/d/a.md' }]);
    closeTab(tabs()[0]!.id);
    expect(backend.callsOf('unwatch_file').map((c) => c.args)).toEqual([{ path: '/d/a.md' }]);
  });

  it('ignores the result when the tab was closed while loading', async () => {
    const pending = deferred<OpenedDocument>();
    mockBackend({ open_document: () => pending.promise });
    const promise = openDocument('/d/a.md');
    closeTab(tabs()[0]!.id);
    pending.resolve(makeDoc('/d/a.md'));
    await promise;
    expect(tabs()).toEqual([]);
    expect(useRecent.getState().items).toEqual([]);
  });
});

describe('tab management', () => {
  async function openThree() {
    fileBackend({
      '/a.md': makeDoc('/a.md'),
      '/b.md': makeDoc('/b.md'),
      '/c.md': makeDoc('/c.md'),
    });
    await openDocument('/a.md');
    await openDocument('/b.md');
    await openDocument('/c.md');
    return tabs().map((t) => t.id) as [string, string, string];
  }

  it('closing the active tab activates the neighbor', async () => {
    const [a, b, c] = await openThree();
    activateTab(b);
    closeTab(b);
    expect(useDocuments.getState().activeId).toBe(c);
    closeTab(c);
    expect(useDocuments.getState().activeId).toBe(a);
    closeTab(a);
    expect(useDocuments.getState().activeId).toBeNull();
    expect(useDocuments.getState().closedPaths).toEqual(['/b.md', '/c.md', '/a.md']);
  });

  it('closes other tabs and all tabs', async () => {
    const [, b] = await openThree();
    closeOtherTabs(b);
    expect(tabs().map((t) => t.id)).toEqual([b]);
    expect(useDocuments.getState().activeId).toBe(b);
    closeAllTabs();
    expect(tabs()).toEqual([]);
    expect(useDocuments.getState().activeId).toBeNull();
    expect(useDocuments.getState().closedPaths).toEqual(['/a.md', '/c.md', '/b.md']);
  });

  it('reopens closed tabs most recent first', async () => {
    const [a, b] = await openThree();
    closeTab(a);
    closeTab(b);
    await reopenClosedTab();
    expect(getActiveTab()?.path).toBe('/b.md');
    await reopenClosedTab();
    expect(tabs().map((t) => t.path)).toEqual(['/c.md', '/b.md', '/a.md']);
    await reopenClosedTab();
    expect(tabs()).toHaveLength(3);
  });

  it('caps the closed stack at 20', async () => {
    const files = Object.fromEntries(
      Array.from({ length: 25 }, (_, i) => [`/f${i}.md`, makeDoc(`/f${i}.md`)]),
    );
    fileBackend(files);
    await Promise.all(Object.keys(files).map((p) => openDocument(p)));
    closeAllTabs();
    const { closedPaths } = useDocuments.getState();
    expect(closedPaths).toHaveLength(20);
    expect(closedPaths.at(-1)).toBe('/f24.md');
  });

  it('cycles next/previous with wrap-around', async () => {
    const [a, b, c] = await openThree();
    expect(useDocuments.getState().activeId).toBe(c);
    activateNextTab();
    expect(useDocuments.getState().activeId).toBe(a);
    activatePreviousTab();
    expect(useDocuments.getState().activeId).toBe(c);
    activatePreviousTab();
    expect(useDocuments.getState().activeId).toBe(b);
  });

  it('records scroll positions', async () => {
    const [a] = await openThree();
    setTabScroll(a, 120);
    expect(tabs()[0]?.scrollTop).toBe(120);
  });
});

describe('reloadDocument', () => {
  it('preserves scroll and bumps the revision', async () => {
    fileBackend({ '/a.md': makeDoc('/a.md') });
    await openDocument('/a.md');
    const id = tabs()[0]!.id;
    setTabScroll(id, 300);
    await reloadDocument(id);
    expect(tabs()[0]).toMatchObject({ scrollTop: 300, revision: 2, status: 'ready' });
    await reloadDocument(id, { preserveScroll: false });
    expect(tabs()[0]).toMatchObject({ scrollTop: 0, revision: 3 });
  });

  it('keeps the old document when reloading fails', async () => {
    const files: Record<string, OpenedDocument | Error> = { '/a.md': makeDoc('/a.md') };
    fileBackend(files);
    await openDocument('/a.md');
    files['/a.md'] = new Error('disk');
    await reloadDocument(tabs()[0]!.id);
    expect(tabs()[0]).toMatchObject({ status: 'ready', revision: 1, error: null });
    expect(tabs()[0]!.doc).not.toBeNull();
    expect(toasts().at(-1)).toMatchObject({ variant: 'error', title: 'Unable to read this file.' });
  });

  it('retries an errored tab', async () => {
    const files: Record<string, OpenedDocument | Error> = {};
    fileBackend(files);
    await openDocument('/a.md');
    files['/a.md'] = makeDoc('/a.md');
    const promise = reloadDocument(tabs()[0]!.id);
    expect(tabs()[0]?.status).toBe('loading');
    await promise;
    expect(tabs()[0]).toMatchObject({ status: 'ready', error: null, revision: 1 });
  });

  it('ignores a stale result when reloaded again', async () => {
    const first = deferred<OpenedDocument>();
    const second = deferred<OpenedDocument>();
    let call = 0;
    mockBackend({
      open_document: () => {
        call += 1;
        if (call === 1) return makeDoc('/a.md');
        return call === 2 ? first.promise : second.promise;
      },
    });
    await openDocument('/a.md');
    const id = tabs()[0]!.id;
    const r1 = reloadDocument(id);
    const r2 = reloadDocument(id);
    second.resolve(makeDoc('/a.md', { html: '<p>new</p>' }));
    await r2;
    first.resolve(makeDoc('/a.md', { html: '<p>old</p>' }));
    await r1;
    expect(tabs()[0]?.doc?.html).toBe('<p>new</p>');
    expect(tabs()[0]?.revision).toBe(2);
  });

  it('re-renders all documents', async () => {
    const backend = fileBackend({ '/a.md': makeDoc('/a.md'), '/b.md': makeDoc('/b.md') });
    await openDocument('/a.md');
    await openDocument('/b.md');
    await rerenderAllDocuments();
    expect(backend.callsOf('open_document')).toHaveLength(4);
    expect(tabs().map((t) => t.revision)).toEqual([2, 2]);
  });
});

describe('file changes', () => {
  async function openA() {
    const files: Record<string, OpenedDocument | Error> = { '/a.md': makeDoc('/a.md') };
    const backend = fileBackend(files);
    await openDocument('/a.md');
    return { files, backend, id: tabs()[0]!.id };
  }

  it('flags modifications and offers Reload / Ignore when autoReload is off', async () => {
    const { backend, id } = await openA();
    await handleFileChanged({ path: '/a.md', kind: 'modified', modifiedMs: 2 });
    expect(tabs()[0]?.externalChange).toBe('modified');
    const notice = toasts().find((t) => t.title === 'File changed externally.');
    expect(notice?.durationMs).toBeNull();
    expect(notice?.actions.map((a) => a.label)).toEqual(['Reload', 'Ignore']);
    expect(backend.callsOf('open_document')).toHaveLength(1);

    notice?.actions[0]?.onClick();
    await flushPromises();
    expect(tabs()[0]).toMatchObject({ externalChange: null, revision: 2 });
    expect(toasts().some((t) => t.title === 'File changed externally.')).toBe(false);

    await handleFileChanged({ path: '/a.md', kind: 'modified', modifiedMs: 3 });
    dismissExternalChange(id);
    expect(tabs()[0]?.externalChange).toBeNull();
    expect(toasts()).toEqual([]);
  });

  it('reloads automatically, preserving scroll, when autoReload is on', async () => {
    updateSettings({ autoReload: true });
    const { id } = await openA();
    setTabScroll(id, 50);
    await handleFileChanged({ path: '/a.md', kind: 'modified', modifiedMs: 2 });
    expect(tabs()[0]).toMatchObject({ revision: 2, scrollTop: 50, externalChange: null });
    expect(toasts()).toEqual([]);
  });

  it('ignores events that do not change the modification time', async () => {
    const { backend } = await openA();
    await handleFileChanged({ path: '/a.md', kind: 'modified', modifiedMs: 1 });
    await handleFileChanged({ path: '/other.md', kind: 'modified', modifiedMs: 9 });
    expect(tabs()[0]?.externalChange).toBeNull();
    expect(backend.callsOf('open_document')).toHaveLength(1);
  });

  it('marks removed files and offers to close the tab', async () => {
    await openA();
    await handleFileChanged({ path: '/a.md', kind: 'removed', modifiedMs: null });
    expect(tabs()[0]?.externalChange).toBe('removed');
    const notice = toasts().find((t) => t.title === 'File was deleted or moved.');
    expect(notice?.variant).toBe('warning');
    notice?.actions[0]?.onClick();
    expect(tabs()).toEqual([]);
    expect(toasts()).toEqual([]);
  });
});

describe('openPaths', () => {
  it('opens markdown files, folders, and rejects other files', async () => {
    const tree: DirectoryTree = {
      root: { name: 'proj', path: '/proj', kind: 'directory', isMarkdown: false, children: [] },
      markdownFileCount: 0,
      truncated: false,
    };
    mockBackend({
      open_document: ({ path }) => makeDoc(path as string),
      check_files: ({ paths }) => (paths as string[]).map((p) => p.endsWith('.png')),
      scan_folder: () => tree,
    });
    await openPaths(['/x/one.md', '/x/two.markdown', '/proj', '/x/pic.png']);
    expect(tabs().map((t) => t.path)).toEqual(['/x/one.md', '/x/two.markdown']);
    expect(getActiveTab()?.path).toBe('/x/one.md');
    expect(useFolder.getState()).toMatchObject({ rootPath: '/proj', status: 'ready' });
    expect(toasts()).toEqual([
      expect.objectContaining({
        variant: 'warning',
        description: 'pic.png is not a Markdown file.',
      }),
    ]);
  });
});
