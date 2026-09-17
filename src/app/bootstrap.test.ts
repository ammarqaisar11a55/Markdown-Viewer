import { emit } from '@tauri-apps/api/event';
import { mockWindows } from '@tauri-apps/api/mocks';
import { displayPath } from '@/lib/paths';
import { getActiveTab, useDocuments } from '@/stores/documentsStore';
import { useSettings } from '@/stores/settingsStore';
import { useToasts } from '@/stores/toastStore';
import { useUi } from '@/stores/uiStore';
import { flushPromises, makeDoc, mockBackend, resetAppState } from '@/test/state';
import { setTauriRuntime } from '@/test/tauri';
import type { FileChangedPayload } from '@/types';
import { bootstrap } from './bootstrap';

beforeEach(resetAppState);

describe('bootstrap (desktop)', () => {
  it('hydrates state, restores the session, opens startup paths and wires native events', async () => {
    setTauriRuntime(true);
    mockWindows('main');
    window.localStorage.clear();
    const existing = ['/s/session.md', '/s/startup.md', '/s/dropped.md'];
    const backend = mockBackend(
      {
        'plugin:store|load': () => 1,
        'plugin:store|get': ({ key }) => {
          if (key === 'settings') return [{ theme: 'dark' }, true];
          if (key === 'session') {
            return [
              {
                tabs: [{ path: '/s/session.md', scrollTop: 5 }],
                activePath: '/s/session.md',
                folderPath: null,
              },
              true,
            ];
          }
          return [null, false];
        },
        'plugin:path|resolve_directory': () => '/home/me',
        take_startup_paths: () => ['/s/startup.md'],
        check_files: ({ paths }) => (paths as string[]).map((p) => existing.includes(p)),
        open_document: ({ path }) => makeDoc(path as string, { modifiedMs: 1 }),
      },
      { shouldMockEvents: true },
    );

    await expect(bootstrap()).resolves.toBeUndefined();
    await flushPromises();

    expect(useSettings.getState().theme).toBe('dark');
    expect(displayPath('/home/me/x.md')).toBe('~/x.md');
    expect(useDocuments.getState().tabs.map((t) => t.path)).toEqual([
      '/s/session.md',
      '/s/startup.md',
    ]);
    expect(getActiveTab()?.path).toBe('/s/startup.md');
    expect(document.title).toBe('startup.md — Markdown Viewer');
    expect(backend.callsOf('plugin:window|set_title').at(-1)?.args).toMatchObject({
      value: 'startup.md — Markdown Viewer',
    });

    await emit('menu-action', 'view.toggleSidebar');
    await emit('menu-action', 'not.a.command');
    expect(useUi.getState().sidebarCollapsed).toBe(true);

    const change: FileChangedPayload = {
      path: '/s/startup.md',
      kind: 'modified',
      modifiedMs: 99,
    };
    await emit('file-changed', change);
    expect(getActiveTab()?.externalChange).toBe('modified');
    expect(useToasts.getState().toasts.some((t) => t.title === 'File changed externally.')).toBe(
      true,
    );

    await emit('tauri://drag-enter', { paths: ['/s/dropped.md'], position: { x: 0, y: 0 } });
    expect(useUi.getState().dragActive).toBe(true);
    await emit('tauri://drag-drop', { paths: ['/s/dropped.md'], position: { x: 0, y: 0 } });
    await flushPromises();
    expect(useUi.getState().dragActive).toBe(false);
    expect(getActiveTab()?.path).toBe('/s/dropped.md');

    await emit('open-paths', ['/s/session.md']);
    expect(getActiveTab()?.path).toBe('/s/session.md');
  });
});
