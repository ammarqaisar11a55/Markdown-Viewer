// Shared helpers for store/feature tests.
import { mockIPC, type MockIPCOptions } from '@tauri-apps/api/mocks';
import type { InvokeArgs } from '@tauri-apps/api/core';
import { vi } from 'vitest';
import { resetCommandDedupeForTests } from '@/app/commands';
import { resetDocumentActionsForTests } from '@/features/documents/actions';
import { stopSessionPersistence } from '@/features/session/session';
import { resetStorageForTests } from '@/lib/platform/storage';
import { useDocuments } from '@/stores/documentsStore';
import { INITIAL_FOLDER_STATE, useFolder } from '@/stores/folderStore';
import { useRecent } from '@/stores/recentStore';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settingsStore';
import { useToasts } from '@/stores/toastStore';
import { useUi } from '@/stores/uiStore';
import type { FsErrorPayload, OpenedDocument } from '@/types';

export function resetAppState(): void {
  resetDocumentActionsForTests();
  resetCommandDedupeForTests();
  stopSessionPersistence();
  useDocuments.setState({ tabs: [], activeId: null, closedPaths: [] });
  useFolder.setState({ ...INITIAL_FOLDER_STATE });
  useRecent.setState({ items: [] });
  useSettings.setState({ ...DEFAULT_SETTINGS });
  useToasts.setState({ toasts: [] });
  useUi.setState({
    sidebarCollapsed: false,
    sidebarView: 'outline',
    readingMode: false,
    searchOpen: false,
    quickOpenOpen: false,
    settingsOpen: false,
    zoom: 1,
    dragActive: false,
  });
  resetStorageForTests();
}

export function makeDoc(path: string, overrides: Partial<OpenedDocument> = {}): OpenedDocument {
  const name = path.split(/[\\/]/).pop() ?? path;
  return {
    path,
    name,
    size: 10,
    modifiedMs: 1,
    html: `<h1>${name}</h1>`,
    headings: [],
    wordCount: 1,
    lossy: false,
    ...overrides,
  };
}

/** Throws the plain `FsErrorPayload` object that Rust commands reject with. */
export function throwFsError(kind: FsErrorPayload['kind'], message = 'os error'): never {
  const payload: FsErrorPayload = { kind, message };
  // eslint-disable-next-line @typescript-eslint/only-throw-error -- mirrors the IPC rejection shape
  throw payload;
}

type Handler = (args: Record<string, unknown>) => unknown;

/**
 * Installs an IPC mock. Unhandled commands resolve to `null` and every call is
 * recorded in `calls`.
 */
export function mockBackend(handlers: Record<string, Handler>, options: MockIPCOptions = {}) {
  const calls: { cmd: string; args: Record<string, unknown> }[] = [];
  const fn = vi.fn((cmd: string, payload?: InvokeArgs) => {
    const args = (payload ?? {}) as Record<string, unknown>;
    calls.push({ cmd, args });
    const handler = handlers[cmd];
    return handler === undefined ? null : handler(args);
  });
  mockIPC(fn, options);
  return { calls, fn, callsOf: (cmd: string) => calls.filter((c) => c.cmd === cmd) };
}

/** A promise that can be resolved/rejected from outside. */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
