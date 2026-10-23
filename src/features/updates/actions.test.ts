import type { Channel } from '@tauri-apps/api/core';
import type { DownloadEvent } from '@tauri-apps/plugin-updater';
import { resetStorageForTests } from '@/lib/platform/storage';
import { useDocuments } from '@/stores/documentsStore';
import { updateSettings } from '@/stores/settingsStore';
import { useToasts } from '@/stores/toastStore';
import { INITIAL_UPDATES_STATE, useUpdates } from '@/stores/updatesStore';
import { makeDoc, mockBackend, resetAppState } from '@/test/state';
import { setTauriRuntime } from '@/test/tauri';
import type { DocumentTab } from '@/types';
import {
  CHECK_INTERVAL_MS,
  checkForUpdates,
  installUpdate,
  resetUpdateActionsForTests,
  scheduleStartupUpdateCheck,
  STARTUP_CHECK_DELAY_MS,
  UPDATE_TOAST_ID,
} from './actions';

const MANIFEST_MISSING = 'Could not fetch a valid release JSON from the remote';

function metadata(version = '1.2.0', body?: string) {
  return {
    rid: 1,
    currentVersion: '1.1.0',
    version,
    rawJson: {},
    ...(body === undefined ? {} : { body }),
  };
}

/** Rejects like a Rust command, which sends its error as a plain string. */
function rejectWith(message: string) {
  return () => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- mirrors the IPC rejection shape
    throw message;
  };
}

/** Answers the native confirmations by the text they show. */
function dialogs(answers: { restart?: boolean; discard?: boolean }) {
  return ({ message }: Record<string, unknown>) => {
    const text = String(message);
    if (text.includes('Restart Markdown Viewer')) {
      return answers.restart === true ? 'Restart Now' : 'Later';
    }
    if (text.includes('unsaved changes')) return answers.discard === true ? 'Discard' : 'Cancel';
    return 'Cancel';
  };
}

/** Drives the plugin's progress channel, as the Rust side would. */
function downloadAndInstall(contentLength: number | null, chunks: number[]) {
  return (args: Record<string, unknown>) => {
    const channel = args.onEvent as Channel<DownloadEvent>;
    channel.onmessage({
      event: 'Started',
      data: contentLength === null ? {} : { contentLength },
    });
    for (const chunkLength of chunks) {
      channel.onmessage({ event: 'Progress', data: { chunkLength } });
    }
    channel.onmessage({ event: 'Finished' });
    return null;
  };
}

function dirtyTab(): DocumentTab {
  return {
    id: 'dirty',
    path: '/a.md',
    name: 'a.md',
    status: 'ready',
    doc: makeDoc('/a.md'),
    error: null,
    scrollTop: 0,
    externalChange: null,
    revision: 1,
    editing: true,
    draft: '# changed',
    savedText: '# a',
    dirty: true,
    saving: false,
  };
}

const titles = () => useToasts.getState().toasts.map((t) => t.title);

beforeEach(() => {
  resetAppState();
  resetUpdateActionsForTests();
  useUpdates.setState({ ...INITIAL_UPDATES_STATE });
  setTauriRuntime(true);
});

afterEach(resetUpdateActionsForTests);

describe('checkForUpdates', () => {
  it('reports an up-to-date app only when the user asked', async () => {
    const backend = mockBackend({ 'plugin:updater|check': () => null });

    await checkForUpdates({ manual: true });
    expect(useUpdates.getState().status).toBe('upToDate');
    expect(useUpdates.getState().lastCheckedAt).not.toBeNull();
    expect(titles()).toEqual(['You’re up to date.']);

    useToasts.setState({ toasts: [] });
    useUpdates.setState({ lastCheckedAt: null });
    resetStorageForTests();
    await checkForUpdates();
    expect(backend.callsOf('plugin:updater|check')).toHaveLength(2);
    expect(titles()).toEqual([]);
  });

  it('offers an available update in a sticky toast, automatically too', async () => {
    mockBackend({ 'plugin:updater|check': () => metadata('1.2.0', '  Faster search.  ') });

    await checkForUpdates();
    expect(useUpdates.getState()).toMatchObject({
      status: 'available',
      version: '1.2.0',
      notes: 'Faster search.',
    });
    const [item] = useToasts.getState().toasts;
    expect(item).toMatchObject({
      id: UPDATE_TOAST_ID,
      title: 'Version 1.2.0 is available.',
      durationMs: null,
      variant: 'info',
    });
    expect(item?.actions.map((action) => action.label)).toEqual(['Install', 'Later']);

    item?.actions[1]?.onClick();
    expect(useToasts.getState().toasts).toEqual([]);
  });

  it('treats a missing release manifest as up to date', async () => {
    mockBackend({ 'plugin:updater|check': rejectWith(MANIFEST_MISSING) });

    await checkForUpdates({ manual: true });
    expect(useUpdates.getState()).toMatchObject({ status: 'upToDate', error: null });
    expect(titles()).toEqual(['You’re up to date.']);
  });

  it('shows a friendly error for a manual check and stays silent otherwise', async () => {
    mockBackend({ 'plugin:updater|check': rejectWith('error sending request for url') });

    await checkForUpdates({ manual: true });
    expect(useUpdates.getState().status).toBe('error');
    expect(useUpdates.getState().error?.title).toBe('Could not check for updates.');
    // A failed check is not remembered, so the next launch tries again.
    expect(useUpdates.getState().lastCheckedAt).toBeNull();
    expect(titles()).toEqual(['Could not check for updates.']);

    useToasts.setState({ toasts: [] });
    await checkForUpdates();
    expect(titles()).toEqual([]);
  });

  it('checks at most once a day automatically, but always when asked', async () => {
    const backend = mockBackend({ 'plugin:updater|check': () => null });
    useUpdates.setState({ lastCheckedAt: Date.now() - CHECK_INTERVAL_MS / 2 });

    await checkForUpdates();
    expect(backend.callsOf('plugin:updater|check')).toHaveLength(0);

    await checkForUpdates({ manual: true });
    expect(backend.callsOf('plugin:updater|check')).toHaveLength(1);

    // A day later (the manual check above is what got persisted).
    resetStorageForTests();
    useUpdates.setState({ lastCheckedAt: Date.now() - CHECK_INTERVAL_MS - 1 });
    await checkForUpdates();
    expect(backend.callsOf('plugin:updater|check')).toHaveLength(2);
  });

  it('respects the automatic-check setting', async () => {
    const backend = mockBackend({ 'plugin:updater|check': () => null });
    updateSettings({ autoCheckUpdates: false });

    await checkForUpdates();
    expect(backend.callsOf('plugin:updater|check')).toHaveLength(0);

    await checkForUpdates({ manual: true });
    expect(backend.callsOf('plugin:updater|check')).toHaveLength(1);
  });

  it('does nothing outside the desktop app', async () => {
    setTauriRuntime(false);
    await expect(checkForUpdates({ manual: true })).resolves.toBeUndefined();
    expect(useUpdates.getState().status).toBe('idle');
    expect(titles()).toEqual([]);
  });

  it('runs the first automatic check a few seconds after launch', async () => {
    vi.useFakeTimers();
    try {
      const backend = mockBackend({ 'plugin:updater|check': () => null });
      scheduleStartupUpdateCheck();
      scheduleStartupUpdateCheck();
      expect(backend.callsOf('plugin:updater|check')).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(STARTUP_CHECK_DELAY_MS);
      expect(backend.callsOf('plugin:updater|check')).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('installUpdate', () => {
  it('downloads with progress and restarts once confirmed', async () => {
    const backend = mockBackend({
      'plugin:updater|check': () => metadata(),
      'plugin:updater|download_and_install': downloadAndInstall(100, [40, 60]),
      'plugin:dialog|message': dialogs({ restart: true }),
    });
    const seen: string[] = [];
    const unsubscribe = useUpdates.subscribe((state) => {
      seen.push(state.status);
    });

    await checkForUpdates({ manual: true });
    await installUpdate();
    unsubscribe();

    expect(seen).toContain('downloading');
    expect(seen).toContain('installing');
    expect(useUpdates.getState()).toMatchObject({
      status: 'installing',
      downloaded: 100,
      contentLength: 100,
    });
    // The toast is replaced by the progress in the Settings dialog.
    expect(useToasts.getState().toasts).toEqual([]);
    expect(backend.callsOf('plugin:process|restart')).toHaveLength(1);
  });

  it('never restarts while a tab has unsaved changes', async () => {
    const backend = mockBackend({
      'plugin:updater|check': () => metadata(),
      'plugin:updater|download_and_install': downloadAndInstall(50, [50]),
      'plugin:dialog|message': dialogs({ restart: true, discard: false }),
    });
    useDocuments.setState({ tabs: [dirtyTab()], activeId: 'dirty' });

    await checkForUpdates({ manual: true });
    await installUpdate();

    expect(backend.callsOf('plugin:process|restart')).toHaveLength(0);
    expect(titles()).toEqual(['Update installed.']);
    expect(useUpdates.getState().status).toBe('installing');
  });

  it('keeps the update for the next launch when the restart is declined', async () => {
    const backend = mockBackend({
      'plugin:updater|check': () => metadata(),
      'plugin:updater|download_and_install': downloadAndInstall(null, [10]),
      'plugin:dialog|message': dialogs({ restart: false }),
    });

    await checkForUpdates({ manual: true });
    await installUpdate();

    expect(backend.callsOf('plugin:process|restart')).toHaveLength(0);
    expect(useUpdates.getState()).toMatchObject({ downloaded: 10, contentLength: null });
    expect(titles()).toEqual(['Update installed.']);
  });

  it('explains a failed installation', async () => {
    const backend = mockBackend({
      'plugin:updater|check': () => metadata(),
      'plugin:updater|download_and_install': rejectWith('no space left on device'),
    });

    await checkForUpdates({ manual: true });
    await installUpdate();

    expect(useUpdates.getState().status).toBe('error');
    expect(titles()).toEqual(['Could not install the update.']);
    expect(backend.callsOf('plugin:process|restart')).toHaveLength(0);
  });

  it('does nothing without an update to install', async () => {
    const backend = mockBackend({});
    await expect(installUpdate()).resolves.toBeUndefined();
    expect(backend.callsOf('plugin:updater|download_and_install')).toEqual([]);
    expect(backend.callsOf('plugin:process|restart')).toEqual([]);
  });
});
