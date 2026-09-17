import { updateSettings } from '@/stores/settingsStore';
import { useToasts } from '@/stores/toastStore';
import { useUi } from '@/stores/uiStore';
import { deferred, throwFsError, mockBackend, resetAppState } from '@/test/state';
import type { DirectoryTree } from '@/types';
import { startSettingsEffects } from '../settings/effects';
import {
  closeFolder,
  collapseAllFolders,
  getFolderMarkdownFiles,
  openFolder,
  refreshFolder,
  toggleFolderExpanded,
  useFolder,
} from './actions';

const TREE: DirectoryTree = {
  root: {
    name: 'proj',
    path: '/proj',
    kind: 'directory',
    isMarkdown: false,
    children: [
      {
        name: 'docs',
        path: '/proj/docs',
        kind: 'directory',
        isMarkdown: false,
        children: [
          { name: 'api.md', path: '/proj/docs/api.md', kind: 'file', isMarkdown: true },
          { name: 'logo.png', path: '/proj/docs/logo.png', kind: 'file', isMarkdown: false },
        ],
      },
      { name: 'README.md', path: '/proj/README.md', kind: 'file', isMarkdown: true },
    ],
  },
  markdownFileCount: 2,
  truncated: false,
};

beforeEach(resetAppState);

describe('folder actions', () => {
  it('opens a folder, expands the root and shows the files view', async () => {
    const backend = mockBackend({ scan_folder: () => TREE });
    useUi.setState({ sidebarCollapsed: true });
    const promise = openFolder('/proj/');
    expect(useFolder.getState().status).toBe('loading');
    await promise;
    expect(useFolder.getState()).toMatchObject({
      rootPath: '/proj',
      status: 'ready',
      error: null,
      expanded: { '/proj': true },
    });
    expect(useUi.getState()).toMatchObject({ sidebarView: 'files', sidebarCollapsed: false });
    expect(backend.callsOf('scan_folder')[0]?.args).toEqual({
      path: '/proj/',
      showAllFiles: false,
    });
  });

  it('lists markdown files with relative paths', async () => {
    mockBackend({ scan_folder: () => TREE });
    expect(getFolderMarkdownFiles()).toEqual([]);
    await openFolder('/proj');
    const files = getFolderMarkdownFiles();
    expect(files).toEqual([
      { path: '/proj/docs/api.md', name: 'api.md', relative: 'docs/api.md' },
      { path: '/proj/README.md', name: 'README.md', relative: 'README.md' },
    ]);
    expect(getFolderMarkdownFiles()).toBe(files);
  });

  it('reports scan errors with folder wording', async () => {
    mockBackend({
      scan_folder: () => {
        throwFsError('notFound');
      },
    });
    await openFolder('/missing');
    expect(useFolder.getState()).toMatchObject({
      status: 'error',
      tree: null,
      error: { kind: 'notFound', title: 'Unable to open this folder.' },
    });
    expect(useToasts.getState().toasts[0]?.title).toBe('Unable to open this folder.');
  });

  it('can fail silently', async () => {
    mockBackend({
      scan_folder: () => {
        throwFsError('permissionDenied');
      },
    });
    await openFolder('/locked', { silent: true });
    expect(useFolder.getState().status).toBe('error');
    expect(useToasts.getState().toasts).toEqual([]);
  });

  it('toggles and collapses directories', async () => {
    mockBackend({ scan_folder: () => TREE });
    await openFolder('/proj');
    toggleFolderExpanded('/proj/docs');
    expect(useFolder.getState().expanded['/proj/docs']).toBe(true);
    toggleFolderExpanded('/proj/docs');
    expect(useFolder.getState().expanded['/proj/docs']).toBe(false);
    collapseAllFolders();
    expect(useFolder.getState().expanded).toEqual({});
  });

  it('refreshes keeping expansion and rescans when showAllFiles changes', async () => {
    const backend = mockBackend({ scan_folder: () => TREE });
    const stop = startSettingsEffects();
    await openFolder('/proj');
    toggleFolderExpanded('/proj/docs');
    await refreshFolder();
    expect(useFolder.getState().expanded).toEqual({ '/proj': true, '/proj/docs': true });

    updateSettings({ showAllFiles: true });
    await Promise.resolve();
    expect(backend.callsOf('scan_folder').at(-1)?.args).toEqual({
      path: '/proj',
      showAllFiles: true,
    });
    stop();
  });

  it('closes the folder and ignores in-flight scans', async () => {
    const pending = deferred<DirectoryTree>();
    mockBackend({ scan_folder: () => pending.promise });
    const promise = openFolder('/proj');
    closeFolder();
    pending.resolve(TREE);
    await promise;
    expect(useFolder.getState()).toMatchObject({ rootPath: null, tree: null, status: 'idle' });
  });
});
