import { flushPersisted } from '@/lib/platform/storage';
import { getActiveTab, useDocuments } from '@/stores/documentsStore';
import { useFolder } from '@/stores/folderStore';
import { updateSettings } from '@/stores/settingsStore';
import { flushPromises, throwFsError, makeDoc, mockBackend, resetAppState } from '@/test/state';
import type { DirectoryTree, SessionSnapshot } from '@/types';
import { openDocument, setTabScroll } from '../documents/actions';
import {
  createSnapshot,
  restoreSession,
  sanitizeSnapshot,
  startSessionPersistence,
} from './session';

const TREE: DirectoryTree = {
  root: { name: 'p', path: '/p', kind: 'directory', isMarkdown: false, children: [] },
  markdownFileCount: 0,
  truncated: false,
};

function backend(existing: string[]) {
  return mockBackend({
    open_document: ({ path }) => makeDoc(path as string),
    check_files: ({ paths }) => (paths as string[]).map((p) => existing.includes(p)),
    scan_folder: () => TREE,
  });
}

function storeSnapshot(snapshot: SessionSnapshot) {
  window.localStorage.setItem('mdv:session', JSON.stringify(snapshot));
}

beforeEach(resetAppState);

describe('session snapshot', () => {
  it('captures tabs, active path and folder', async () => {
    backend(['/a.md', '/b.md']);
    await openDocument('/a.md');
    await openDocument('/b.md');
    setTabScroll(useDocuments.getState().tabs[0]!.id, 12.4);
    useFolder.setState({ rootPath: '/p' });
    expect(createSnapshot()).toEqual({
      tabs: [
        { path: '/a.md', scrollTop: 12 },
        { path: '/b.md', scrollTop: 0 },
      ],
      activePath: '/b.md',
      folderPath: '/p',
    });
  });

  it('excludes errored tabs', async () => {
    mockBackend({
      open_document: () => {
        throwFsError('notFound');
      },
    });
    await openDocument('/broken.md');
    expect(createSnapshot().tabs).toEqual([]);
  });

  it('persists changes', async () => {
    backend(['/a.md']);
    startSessionPersistence();
    await openDocument('/a.md');
    await flushPersisted();
    expect(JSON.parse(window.localStorage.getItem('mdv:session') ?? 'null')).toEqual({
      tabs: [{ path: '/a.md', scrollTop: 0 }],
      activePath: '/a.md',
      folderPath: null,
    });
  });

  it('sanitizes stored snapshots', () => {
    expect(sanitizeSnapshot(null)).toBeNull();
    expect(sanitizeSnapshot({ tabs: 'x' })).toBeNull();
    expect(
      sanitizeSnapshot({ tabs: [{ path: '/a.md', scrollTop: 'x' }, { path: 3 }], activePath: 1 }),
    ).toEqual({ tabs: [{ path: '/a.md', scrollTop: 0 }], activePath: null, folderPath: null });
  });
});

describe('restoreSession', () => {
  const snapshot: SessionSnapshot = {
    tabs: [
      { path: '/a.md', scrollTop: 10 },
      { path: '/gone.md', scrollTop: 0 },
      { path: '/b.md', scrollTop: 20 },
    ],
    activePath: '/b.md',
    folderPath: '/p',
  };

  it('restores tabs, scroll, active tab and folder, skipping missing files', async () => {
    backend(['/a.md', '/b.md']);
    storeSnapshot(snapshot);
    await restoreSession();
    await flushPromises();
    const { tabs } = useDocuments.getState();
    expect(tabs.map((t) => [t.path, t.scrollTop, t.status])).toEqual([
      ['/a.md', 10, 'ready'],
      ['/b.md', 20, 'ready'],
    ]);
    expect(getActiveTab()?.path).toBe('/b.md');
    expect(useFolder.getState().rootPath).toBe('/p');
  });

  it('activates the first tab when the active one is missing', async () => {
    backend(['/a.md']);
    storeSnapshot({ ...snapshot, activePath: '/gone.md', folderPath: null });
    await restoreSession();
    expect(getActiveTab()?.path).toBe('/a.md');
  });

  it('does nothing when disabled', async () => {
    const calls = backend(['/a.md', '/b.md']);
    storeSnapshot(snapshot);
    updateSettings({ restoreSession: false });
    await restoreSession();
    expect(useDocuments.getState().tabs).toEqual([]);
    expect(calls.calls).toEqual([]);
  });
});
