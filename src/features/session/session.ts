// Persists the open tabs / folder and restores them on the next start.
import { samePath } from '@/lib/paths';
import { checkFiles } from '@/lib/platform/ipc';
import { logger } from '@/lib/platform/logger';
import { loadPersisted, savePersisted } from '@/lib/platform/storage';
import { useDocuments, type DocumentsState } from '@/stores/documentsStore';
import { useFolder } from '@/stores/folderStore';
import { useSettings } from '@/stores/settingsStore';
import type { SessionSnapshot } from '@/types';
import { activateTab, openDocument } from '../documents/actions';
import { openFolder } from '../folder/actions';

export const SESSION_KEY = 'session';

export function createSnapshot(): SessionSnapshot {
  const { tabs, activeId }: DocumentsState = useDocuments.getState();
  const kept = tabs.filter((tab) => tab.status !== 'error');
  const active = kept.find((tab) => tab.id === activeId);
  return {
    tabs: kept.map((tab) => ({
      path: tab.path,
      scrollTop: Math.max(0, Math.round(tab.scrollTop)),
    })),
    activePath: active?.path ?? null,
    folderPath: useFolder.getState().rootPath,
  };
}

function sameSnapshot(a: SessionSnapshot, b: SessionSnapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function sanitizeSnapshot(input: unknown): SessionSnapshot | null {
  if (typeof input !== 'object' || input === null) return null;
  const raw = input as Record<string, unknown>;
  if (!Array.isArray(raw.tabs)) return null;
  const tabs: SessionSnapshot['tabs'] = [];
  for (const value of raw.tabs as unknown[]) {
    if (typeof value !== 'object' || value === null) continue;
    const { path, scrollTop } = value as Record<string, unknown>;
    if (typeof path !== 'string' || path === '') continue;
    tabs.push({
      path,
      scrollTop: typeof scrollTop === 'number' && Number.isFinite(scrollTop) ? scrollTop : 0,
    });
  }
  return {
    tabs,
    activePath: typeof raw.activePath === 'string' ? raw.activePath : null,
    folderPath: typeof raw.folderPath === 'string' ? raw.folderPath : null,
  };
}

let unsubscribers: (() => void)[] = [];

/** Saves the session (debounced by the storage layer) whenever it changes. */
export function startSessionPersistence(): () => void {
  stopSessionPersistence();
  let last = createSnapshot();
  const save = () => {
    const next = createSnapshot();
    if (sameSnapshot(last, next)) return;
    last = next;
    savePersisted(SESSION_KEY, next);
  };
  unsubscribers = [useDocuments.subscribe(save), useFolder.subscribe(save)];
  return stopSessionPersistence;
}

export function stopSessionPersistence(): void {
  unsubscribers.forEach((unsubscribe) => {
    unsubscribe();
  });
  unsubscribers = [];
}

/** Restores the previous session when enabled. Missing files are skipped. */
export async function restoreSession(): Promise<void> {
  if (!useSettings.getState().restoreSession) return;
  const snapshot = sanitizeSnapshot(await loadPersisted<unknown>(SESSION_KEY, null));
  if (snapshot === null) return;

  if (snapshot.folderPath !== null) {
    void openFolder(snapshot.folderPath, { silent: true });
  }
  if (snapshot.tabs.length === 0) return;

  let exists: boolean[];
  try {
    exists = await checkFiles(snapshot.tabs.map((tab) => tab.path));
  } catch (err) {
    logger.warn('Could not verify session files', err);
    return;
  }
  const available = snapshot.tabs.filter((tab, i) => {
    if (exists[i] === true) return true;
    logger.info(`Skipping missing session file ${tab.path}`);
    return false;
  });
  const opening = available.map((tab) =>
    openDocument(tab.path, { newTab: true, activate: false, scrollTop: tab.scrollTop }),
  );
  const { tabs } = useDocuments.getState();
  const active =
    (snapshot.activePath === null
      ? undefined
      : tabs.find((tab) => samePath(tab.path, snapshot.activePath ?? ''))) ??
    tabs.find((tab) => tab.path === available[0]?.path);
  if (active !== undefined) activateTab(active.id);
  void Promise.all(opening);
}
