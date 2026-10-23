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
import type { DirectoryTree, DocumentSource, FsErrorKind, OpenedDocument } from '@/types';
import {
  activateNextTab,
  confirmQuit,
  activatePreviousTab,
  activateTab,
  closeAllTabs,
  closeOtherTabs,
  closeTab,
  createFileDialog,
  dismissExternalChange,
  handleFileChanged,
  openDocument,
  openPaths,
  reloadDocument,
  reopenClosedTab,
  rerenderAllDocuments,
  saveDocument,
  setDraft,
  setTabScroll,
  startEditing,
  stopEditing,
  toggleEditing,
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
    await closeTab(tabs()[0]!.id);
    expect(backend.callsOf('unwatch_file').map((c) => c.args)).toEqual([{ path: '/d/a.md' }]);
  });

  it('ignores the result when the tab was closed while loading', async () => {
    const pending = deferred<OpenedDocument>();
    mockBackend({ open_document: () => pending.promise });
    const promise = openDocument('/d/a.md');
    await closeTab(tabs()[0]!.id);
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
    await closeTab(b);
    expect(useDocuments.getState().activeId).toBe(c);
    await closeTab(c);
    expect(useDocuments.getState().activeId).toBe(a);
    await closeTab(a);
    expect(useDocuments.getState().activeId).toBeNull();
    expect(useDocuments.getState().closedPaths).toEqual(['/b.md', '/c.md', '/a.md']);
  });

  it('closes other tabs and all tabs', async () => {
    const [, b] = await openThree();
    await closeOtherTabs(b);
    expect(tabs().map((t) => t.id)).toEqual([b]);
    expect(useDocuments.getState().activeId).toBe(b);
    await closeAllTabs();
    expect(tabs()).toEqual([]);
    expect(useDocuments.getState().activeId).toBeNull();
    expect(useDocuments.getState().closedPaths).toEqual(['/a.md', '/c.md', '/b.md']);
  });

  it('reopens closed tabs most recent first', async () => {
    const [a, b] = await openThree();
    await closeTab(a);
    await closeTab(b);
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
    await closeAllTabs();
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
    await flushPromises();
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

// ---------------------------------------------------------------------------
// Editing
// ---------------------------------------------------------------------------

interface EditBackend {
  source: string;
  written: string[];
  saveError: FsErrorKind | null;
  renderError: boolean;
}

function editBackend(initial = '# Hello\n') {
  const state: EditBackend = {
    source: initial,
    written: [],
    saveError: null,
    renderError: false,
  };
  const backend = mockBackend({
    open_document: ({ path }) => makeDoc(path as string, { html: `<p>${state.source.trim()}</p>` }),
    read_source: ({ path }) => ({
      path: path as string,
      name: '/a.md',
      size: state.source.length,
      modifiedMs: 1,
      content: state.source,
      lossy: false,
    }),
    save_document: ({ path, content }) => {
      if (state.saveError !== null) throwFsError(state.saveError);
      state.source = content as string;
      state.written.push(content as string);
      return makeDoc(path as string, {
        html: `<p>${state.source.trim()}</p>`,
        modifiedMs: 2,
        size: state.source.length,
      });
    },
    render_source: ({ source }) => {
      if (state.renderError) throwFsError('io');
      return {
        html: `<p>draft:${(source as string).trim()}</p>`,
        headings: [],
        wordCount: 2,
        flavor: 'markdown',
        simplified: false,
      };
    },
  });
  return { ...backend, state };
}

/** Opens `/a.md` and returns its tab id. */
async function openForEditing(initial?: string) {
  const backend = editBackend(initial);
  await openDocument('/a.md');
  return { backend, id: tabs()[0]!.id };
}

function confirmWith(answer: boolean) {
  return vi.spyOn(window, 'confirm').mockReturnValue(answer);
}

describe('startEditing', () => {
  it('loads the raw source and opens the editor', async () => {
    const { backend, id } = await openForEditing('# Hello\n');
    await startEditing(id);
    expect(backend.callsOf('read_source').map((c) => c.args)).toEqual([{ path: '/a.md' }]);
    expect(tabs()[0]).toMatchObject({
      editing: true,
      draft: '# Hello\n',
      savedText: '# Hello\n',
      dirty: false,
    });
  });

  it('stays in view mode and toasts when the source cannot be read', async () => {
    mockBackend({
      open_document: ({ path }) => makeDoc(path as string),
      read_source: () => throwFsError('permissionDenied'),
    });
    await openDocument('/a.md');
    await startEditing(tabs()[0]!.id);
    expect(tabs()[0]).toMatchObject({ editing: false, draft: null });
    expect(toasts().at(-1)).toMatchObject({
      variant: 'error',
      title: 'Unable to edit this file.',
    });
  });

  it('reuses a draft that was kept while reading', async () => {
    const { backend, id } = await openForEditing();
    await startEditing(id);
    setDraft(id, '# Changed');
    await stopEditing(id);
    expect(tabs()[0]).toMatchObject({ editing: false, dirty: true, draft: '# Changed' });
    await startEditing(id);
    expect(tabs()[0]).toMatchObject({ editing: true, draft: '# Changed' });
    expect(backend.callsOf('read_source')).toHaveLength(1);
  });

  it('ignores a source that arrives after the tab was closed', async () => {
    const pending = deferred<DocumentSource>();
    mockBackend({
      open_document: ({ path }) => makeDoc(path as string),
      read_source: () => pending.promise,
    });
    await openDocument('/a.md');
    const id = tabs()[0]!.id;
    const promise = startEditing(id);
    await closeTab(id);
    pending.resolve({
      path: '/a.md',
      name: 'a.md',
      size: 1,
      modifiedMs: 1,
      content: 'x',
      lossy: false,
    });
    await promise;
    expect(tabs()).toEqual([]);
  });
});

describe('setDraft', () => {
  it('tracks dirty state against the text on disk', async () => {
    const { id } = await openForEditing('a\n');
    await startEditing(id);
    setDraft(id, 'a\nb');
    expect(tabs()[0]).toMatchObject({ draft: 'a\nb', dirty: true });
    setDraft(id, 'a\n');
    expect(tabs()[0]).toMatchObject({ draft: 'a\n', dirty: false });
  });

  it('does nothing without a loaded draft', async () => {
    const { id } = await openForEditing();
    setDraft(id, 'nope');
    expect(tabs()[0]).toMatchObject({ draft: null, dirty: false });
  });
});

describe('saveDocument', () => {
  it('writes the draft, adopts the re-render and clears dirty', async () => {
    const { backend, id } = await openForEditing('a\n');
    await startEditing(id);
    setDraft(id, '# New\n');
    await saveDocument(id);
    expect(backend.callsOf('save_document')[0]?.args).toEqual({
      path: '/a.md',
      content: '# New\n',
      options: { allowHtml: true },
    });
    expect(tabs()[0]).toMatchObject({
      dirty: false,
      saving: false,
      savedText: '# New\n',
      editing: true,
      revision: 2,
    });
    expect(tabs()[0]?.doc?.html).toBe('<p># New</p>');
    expect(toasts()).toEqual([]);
  });

  it('is a no-op when nothing changed', async () => {
    const { backend, id } = await openForEditing();
    await startEditing(id);
    await saveDocument(id);
    expect(backend.callsOf('save_document')).toHaveLength(0);
  });

  it('reports `saving` while the write is in flight', async () => {
    const pending = deferred<OpenedDocument>();
    mockBackend({
      open_document: ({ path }) => makeDoc(path as string),
      read_source: () => ({
        path: '/a.md',
        name: 'a.md',
        size: 1,
        modifiedMs: 1,
        content: 'a',
        lossy: false,
      }),
      save_document: () => pending.promise,
    });
    await openDocument('/a.md');
    const id = tabs()[0]!.id;
    await startEditing(id);
    setDraft(id, 'b');
    const promise = saveDocument(id);
    expect(tabs()[0]?.saving).toBe(true);
    pending.resolve(makeDoc('/a.md'));
    await promise;
    expect(tabs()[0]?.saving).toBe(false);
  });

  it('keeps the draft and toasts when the write fails', async () => {
    const { backend, id } = await openForEditing('a\n');
    await startEditing(id);
    setDraft(id, 'b\n');
    backend.state.saveError = 'permissionDenied';
    await saveDocument(id);
    expect(tabs()[0]).toMatchObject({ draft: 'b\n', dirty: true, saving: false, editing: true });
    expect(toasts().at(-1)).toMatchObject({
      variant: 'error',
      title: 'Unable to save this file.',
      description: 'You don’t have permission to write to it.',
    });
  });

  it('stays dirty when the user typed on while saving', async () => {
    const pending = deferred<OpenedDocument>();
    mockBackend({
      open_document: ({ path }) => makeDoc(path as string),
      read_source: () => ({
        path: '/a.md',
        name: 'a.md',
        size: 1,
        modifiedMs: 1,
        content: 'a',
        lossy: false,
      }),
      save_document: () => pending.promise,
    });
    await openDocument('/a.md');
    const id = tabs()[0]!.id;
    await startEditing(id);
    setDraft(id, 'b');
    const promise = saveDocument(id);
    setDraft(id, 'bc');
    pending.resolve(makeDoc('/a.md'));
    await promise;
    expect(tabs()[0]).toMatchObject({ dirty: true, savedText: 'b', draft: 'bc' });
  });
});

describe('stopEditing / toggleEditing', () => {
  it('previews the draft when going back to reading', async () => {
    const { backend, id } = await openForEditing('a\n');
    await startEditing(id);
    setDraft(id, 'draft text');
    await stopEditing(id);
    expect(backend.callsOf('render_source')[0]?.args).toEqual({
      path: '/a.md',
      source: 'draft text',
      options: { allowHtml: true },
    });
    expect(tabs()[0]).toMatchObject({ editing: false, dirty: true, revision: 2 });
    expect(tabs()[0]?.doc?.html).toBe('<p>draft:draft text</p>');
  });

  it('falls back to the saved render when previewing fails', async () => {
    const { backend, id } = await openForEditing('a\n');
    await startEditing(id);
    setDraft(id, 'draft text');
    backend.state.renderError = true;
    await stopEditing(id);
    expect(tabs()[0]).toMatchObject({ editing: false, dirty: true, revision: 1 });
    expect(tabs()[0]?.doc?.html).toBe('<p>a</p>');
  });

  it('asks before discarding and keeps the draft when declined', async () => {
    const { id } = await openForEditing('a\n');
    await startEditing(id);
    setDraft(id, 'b');
    const confirmSpy = confirmWith(false);
    await stopEditing(id, { discard: true });
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('unsaved changes'));
    expect(tabs()[0]).toMatchObject({ editing: true, dirty: true, draft: 'b' });

    confirmSpy.mockReturnValue(true);
    await stopEditing(id, { discard: true });
    expect(tabs()[0]).toMatchObject({ editing: false, dirty: false, draft: null, savedText: null });
  });

  it('discards without asking when there are no changes', async () => {
    const { id } = await openForEditing();
    await startEditing(id);
    const confirmSpy = confirmWith(true);
    await toggleEditing(id);
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(tabs()[0]).toMatchObject({ editing: false });
    await toggleEditing(id);
    expect(tabs()[0]).toMatchObject({ editing: true });
  });
});

describe('unsaved-change guards', () => {
  async function dirtyTab(text = 'changed') {
    const result = await openForEditing('a\n');
    await startEditing(result.id);
    setDraft(result.id, text);
    return result;
  }

  it('asks before closing a dirty tab', async () => {
    const { id } = await dirtyTab();
    const confirmSpy = confirmWith(false);
    await closeTab(id);
    expect(tabs()).toHaveLength(1);
    confirmSpy.mockReturnValue(true);
    await closeTab(id);
    expect(tabs()).toEqual([]);
  });

  it('asks before quitting with unsaved changes', async () => {
    const { id } = await dirtyTab();
    const confirmSpy = confirmWith(false);
    expect(await confirmQuit()).toBe(false);
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('a.md'));
    expect(tabs()[0]).toMatchObject({ dirty: true });

    confirmSpy.mockReturnValue(true);
    expect(await confirmQuit()).toBe(true);
    // Quitting is allowed but nothing is closed here: the window does that.
    expect(tabs()).toHaveLength(1);

    await stopEditing(id, { discard: true });
    expect(await confirmQuit()).toBe(true);
  });

  it('asks once, listing the dirty files, when closing several tabs', async () => {
    const backend = editBackend('a\n');
    await openDocument('/a.md', { newTab: true });
    await openDocument('/b.md', { newTab: true });
    for (const tab of tabs()) {
      await startEditing(tab.id);
      setDraft(tab.id, 'changed');
    }
    expect(backend.callsOf('read_source')).toHaveLength(2);
    const confirmSpy = confirmWith(true);
    await closeAllTabs();
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('2 files'));
    expect(tabs()).toEqual([]);
  });

  it('asks before closing the other tabs', async () => {
    editBackend('a\n');
    await openDocument('/a.md', { newTab: true });
    await openDocument('/b.md', { newTab: true });
    const [first, second] = tabs();
    await startEditing(second!.id);
    setDraft(second!.id, 'changed');
    const confirmSpy = confirmWith(false);
    await closeOtherTabs(first!.id);
    expect(tabs()).toHaveLength(2);
    expect(confirmSpy).toHaveBeenCalledOnce();
  });

  it('asks before reloading a dirty tab and restores the editor afterwards', async () => {
    const { backend, id } = await dirtyTab();
    const confirmSpy = confirmWith(false);
    await reloadDocument(id);
    expect(tabs()[0]).toMatchObject({ dirty: true, draft: 'changed', revision: 1 });

    confirmSpy.mockReturnValue(true);
    backend.state.source = '# From disk\n';
    await reloadDocument(id);
    expect(tabs()[0]).toMatchObject({
      dirty: false,
      editing: true,
      draft: '# From disk\n',
      revision: 2,
    });
  });

  it('never replaces a dirty tab when openInNewTab is off', async () => {
    editBackend('a\n');
    updateSettings({ openInNewTab: false });
    await openDocument('/a.md');
    const id = tabs()[0]!.id;
    await startEditing(id);
    setDraft(id, 'changed');
    await openDocument('/b.md');
    expect(tabs().map((t) => t.path)).toEqual(['/a.md', '/b.md']);
  });

  it('warns instead of auto-reloading when the file changes while editing', async () => {
    updateSettings({ autoReload: true });
    const { backend } = await dirtyTab();
    await handleFileChanged({ path: '/a.md', kind: 'modified', modifiedMs: 5 });
    expect(tabs()[0]).toMatchObject({ dirty: true, draft: 'changed', externalChange: 'modified' });
    expect(backend.callsOf('open_document')).toHaveLength(1);
    const notice = toasts().at(-1);
    expect(notice).toMatchObject({
      variant: 'warning',
      title: 'File changed on disk while you were editing.',
    });
    expect(notice?.actions.map((a) => a.label)).toEqual(['Keep Editing', 'Reload']);
  });

  it('re-renders a dirty tab from its draft instead of reloading it', async () => {
    const { backend, id } = await dirtyTab('draft text');
    await stopEditing(id);
    updateSettings({ renderHtml: false });
    await rerenderAllDocuments();
    expect(backend.callsOf('open_document')).toHaveLength(1);
    expect(backend.callsOf('render_source').at(-1)?.args).toEqual({
      path: '/a.md',
      source: 'draft text',
      options: { allowHtml: false },
    });
    expect(tabs()[0]).toMatchObject({ dirty: true, draft: 'draft text' });
  });
});

describe('createFileDialog', () => {
  interface CreateState {
    chosen: string | null;
    created: string[];
    existing: string[];
  }

  function createBackend(chosen: string | null) {
    setTauriRuntime(true);
    const state: CreateState = { chosen, created: [], existing: [] };
    const backend = mockBackend({
      'plugin:dialog|save': () => state.chosen,
      create_document: ({ path }) => {
        const target = path as string;
        if (state.existing.includes(target)) throwFsError('alreadyExists', 'EEXIST');
        state.created.push(target);
        return makeDoc(target, { size: 0, html: '', wordCount: 0 });
      },
      read_source: ({ path }) => ({
        path: path as string,
        name: 'untitled.md',
        size: 0,
        modifiedMs: 1,
        content: '',
        lossy: false,
      }),
      scan_folder: ({ path }) => folderTree(path as string),
    });
    return { ...backend, state };
  }

  function folderTree(root: string): DirectoryTree {
    return {
      markdownFileCount: 1,
      truncated: false,
      root: {
        name: 'project',
        path: root,
        kind: 'directory',
        isMarkdown: false,
        children: [
          { name: 'untitled.md', path: `${root}/untitled.md`, kind: 'file', isMarkdown: true },
        ],
      },
    };
  }

  it('does nothing at all when the dialog is cancelled', async () => {
    const backend = createBackend(null);
    await createFileDialog();
    expect(backend.callsOf('create_document')).toHaveLength(0);
    expect(tabs()).toHaveLength(0);
    expect(toasts()).toHaveLength(0);
  });

  it('is a no-op outside Tauri', async () => {
    const backend = createBackend('/d/untitled.md');
    setTauriRuntime(false);
    await createFileDialog();
    expect(backend.callsOf('plugin:dialog|save')).toHaveLength(0);
    expect(tabs()).toHaveLength(0);
  });

  it('opens the new file in a tab that is already in edit mode', async () => {
    const backend = createBackend('/d/untitled.md');
    await createFileDialog();
    expect(backend.callsOf('create_document')[0]?.args).toEqual({
      path: '/d/untitled.md',
      options: { allowHtml: true },
    });
    expect(tabs()).toHaveLength(1);
    expect(tabs()[0]).toMatchObject({
      path: '/d/untitled.md',
      name: 'untitled.md',
      status: 'ready',
      editing: true,
      draft: '',
      savedText: '',
      dirty: false,
    });
    expect(useDocuments.getState().activeId).toBe(tabs()[0]!.id);
    expect(useRecent.getState().items.map((i) => i.path)).toEqual(['/d/untitled.md']);
  });

  it('offers the invoking folder, and the active document’s folder otherwise', async () => {
    const backend = createBackend('/notes/untitled.md');
    await createFileDialog('/notes');
    expect(backend.callsOf('plugin:dialog|save')[0]?.args).toMatchObject({
      options: { defaultPath: '/notes/untitled.md' },
    });

    // A second call with no folder follows the document opened by the first.
    backend.state.chosen = '/notes/second.md';
    await createFileDialog();
    expect(backend.callsOf('plugin:dialog|save')[1]?.args).toMatchObject({
      options: { defaultPath: '/notes/untitled.md' },
    });
    expect(backend.state.created).toEqual(['/notes/untitled.md', '/notes/second.md']);
  });

  it('appends .md to a name typed without an extension', async () => {
    const backend = createBackend('/d/thoughts');
    await createFileDialog();
    expect(backend.callsOf('create_document')[0]?.args).toMatchObject({
      path: '/d/thoughts.md',
    });
  });

  it('shows a friendly toast when the name is taken and opens no tab', async () => {
    const backend = createBackend('/d/notes.md');
    backend.state.existing.push('/d/notes.md');
    await createFileDialog();
    expect(tabs()).toHaveLength(0);
    expect(toasts().at(-1)).toMatchObject({
      variant: 'error',
      title: 'A file with this name already exists.',
      description: 'Choose another name.',
    });
  });

  it('reports an unwritable folder without opening a tab', async () => {
    setTauriRuntime(true);
    mockBackend({
      'plugin:dialog|save': () => '/root/untitled.md',
      create_document: () => throwFsError('permissionDenied'),
    });
    await createFileDialog();
    expect(tabs()).toHaveLength(0);
    expect(toasts().at(-1)).toMatchObject({
      variant: 'error',
      title: 'Unable to create this file.',
      description: 'You don’t have permission to write to this folder.',
    });
  });

  it('refreshes the open folder so the new file appears and is selected', async () => {
    const backend = createBackend('/project/untitled.md');
    useFolder.setState({
      rootPath: '/project',
      tree: { markdownFileCount: 0, truncated: false, root: folderTree('/project').root },
      status: 'ready',
      error: null,
      expanded: { '/project': true },
    });
    await createFileDialog('/project');
    expect(backend.callsOf('scan_folder').at(-1)?.args).toEqual({
      path: '/project',
      showAllFiles: false,
    });
    expect(useFolder.getState().expanded).toEqual({ '/project': true });
    // The tree marks the file as selected through the active tab's path.
    expect(getActiveTab()?.path).toBe('/project/untitled.md');
  });

  it('does not scan when no folder is open', async () => {
    const backend = createBackend('/d/untitled.md');
    await createFileDialog();
    expect(backend.callsOf('scan_folder')).toHaveLength(0);
  });
});
