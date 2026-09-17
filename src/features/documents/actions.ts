// All mutations of the documents store. Loads are race-safe: every load
// gets a request token and stale results (tab closed / reloaded again) are
// ignored.
import { toAppError } from '@/lib/errors';
import { basename, isMarkdownPath, samePath } from '@/lib/paths';
import { pickMarkdownFiles } from '@/lib/platform/dialogs';
import { checkFiles, openDocumentFile, unwatchFile, watchFile } from '@/lib/platform/ipc';
import { logger } from '@/lib/platform/logger';
import { notify } from '@/lib/platform/system';
import { MAX_CLOSED_PATHS, useDocuments } from '@/stores/documentsStore';
import { addRecent } from '@/stores/recentStore';
import { useSettings } from '@/stores/settingsStore';
import { dismissToast, toast } from '@/stores/toastStore';
import type { DocumentTab, FileChangedPayload, OpenedDocument } from '@/types';
import { openFolder } from '../folder/actions';

export interface OpenDocumentOptions {
  newTab?: boolean;
  activate?: boolean;
  scrollTop?: number;
}

export interface ReloadOptions {
  preserveScroll?: boolean;
}

const requestTokens = new Map<string, number>();
/** Tab id → path currently watched for that tab. */
const watchedPaths = new Map<string, string>();
let tokenCounter = 0;

function getTab(id: string): DocumentTab | undefined {
  return useDocuments.getState().tabs.find((tab) => tab.id === id);
}

function findTabByPath(path: string): DocumentTab | undefined {
  return useDocuments.getState().tabs.find((tab) => samePath(tab.path, path));
}

function patchTab(id: string, patch: Partial<DocumentTab>): void {
  useDocuments.setState(({ tabs }) => ({
    tabs: tabs.map((tab) => (tab.id === id ? { ...tab, ...patch } : tab)),
  }));
}

function changeToastId(path: string): string {
  return `file-changed:${path}`;
}

function logFailure(action: string) {
  return (err: unknown) => {
    logger.warn(action, err);
  };
}

function startWatching(tabId: string, path: string): void {
  const current = watchedPaths.get(tabId);
  if (current !== undefined && samePath(current, path)) return;
  if (current !== undefined) stopWatching(tabId);
  watchedPaths.set(tabId, path);
  watchFile(path).catch(logFailure(`Could not watch ${path}`));
}

function stopWatching(tabId: string): void {
  const path = watchedPaths.get(tabId);
  if (path === undefined) return;
  watchedPaths.delete(tabId);
  unwatchFile(path).catch(logFailure(`Could not unwatch ${path}`));
}

/** Forgets a tab's in-flight load and file watch. */
function releaseTab(tab: DocumentTab): void {
  requestTokens.delete(tab.id);
  stopWatching(tab.id);
  dismissToast(changeToastId(tab.path));
}

function pushClosed(closedPaths: string[], paths: string[]): string[] {
  const next = closedPaths.filter((p) => !paths.some((closed) => samePath(p, closed)));
  return [...next, ...paths].slice(-MAX_CLOSED_PATHS);
}

function createTab(path: string, scrollTop: number): DocumentTab {
  return {
    id: crypto.randomUUID(),
    path,
    name: basename(path),
    status: 'loading',
    doc: null,
    error: null,
    scrollTop,
    externalChange: null,
    revision: 0,
  };
}

function renderOptions() {
  return { allowHtml: useSettings.getState().renderHtml };
}

type LoadResult = { ok: true; doc: OpenedDocument } | { ok: false; error: unknown } | null;

/** Loads `path` for a tab; resolves to `null` when the result is stale. */
async function loadFor(tabId: string, path: string): Promise<LoadResult> {
  const token = ++tokenCounter;
  requestTokens.set(tabId, token);
  let result: LoadResult;
  try {
    result = { ok: true, doc: await openDocumentFile(path, renderOptions()) };
  } catch (error) {
    result = { ok: false, error };
  }
  if (requestTokens.get(tabId) !== token || getTab(tabId) === undefined) return null;
  requestTokens.delete(tabId);
  return result;
}

function applyLoaded(tabId: string, doc: OpenedDocument, scrollTop: number): void {
  const tab = getTab(tabId);
  if (tab === undefined) return;
  const duplicate = useDocuments
    .getState()
    .tabs.find((other) => other.id !== tabId && samePath(other.path, doc.path));
  if (duplicate !== undefined) {
    // The requested path resolved to a document that is already open.
    const wasActive = useDocuments.getState().activeId === tabId;
    removeTabs([tabId], false);
    if (wasActive) activateTab(duplicate.id);
    return;
  }
  patchTab(tabId, {
    path: doc.path,
    name: doc.name,
    status: 'ready',
    doc,
    error: null,
    scrollTop,
    externalChange: null,
    revision: tab.revision + 1,
  });
  if (!samePath(tab.path, doc.path)) dismissToast(changeToastId(tab.path));
  dismissToast(changeToastId(doc.path));
  startWatching(tabId, doc.path);
  addRecent(doc.path);
}

function showError(err: unknown, path: string) {
  const error = toAppError(err, 'file');
  logger.error(`Failed to load ${path}`, error.technical);
  toast({ variant: 'error', title: error.title, description: error.description });
  return error;
}

export async function openDocument(path: string, opts: OpenDocumentOptions = {}): Promise<void> {
  const activate = opts.activate ?? true;
  const existing = findTabByPath(path);
  if (existing !== undefined) {
    if (activate) activateTab(existing.id);
    return;
  }

  const tab = createTab(path, opts.scrollTop ?? 0);
  const { tabs, activeId, closedPaths } = useDocuments.getState();
  const newTab = opts.newTab ?? useSettings.getState().openInNewTab;
  const replaced = !newTab && activeId !== null ? tabs.find((t) => t.id === activeId) : undefined;

  if (replaced !== undefined) {
    releaseTab(replaced);
    useDocuments.setState({
      tabs: tabs.map((t) => (t.id === replaced.id ? tab : t)),
      activeId: tab.id,
      closedPaths: pushClosed(closedPaths, [replaced.path]),
    });
  } else {
    useDocuments.setState({
      tabs: [...tabs, tab],
      activeId: activate || activeId === null ? tab.id : activeId,
    });
  }

  const result = await loadFor(tab.id, path);
  if (result === null) return;
  if (result.ok) {
    applyLoaded(tab.id, result.doc, getTab(tab.id)?.scrollTop ?? 0);
    return;
  }
  const error = showError(result.error, path);
  patchTab(tab.id, { status: 'error', error, doc: null });
}

export async function reloadDocument(tabId: string, options: ReloadOptions = {}): Promise<void> {
  const tab = getTab(tabId);
  if (tab === undefined) return;
  const preserveScroll = options.preserveScroll ?? true;
  if (tab.doc === null) patchTab(tabId, { status: 'loading', error: null });

  const result = await loadFor(tabId, tab.path);
  if (result === null) return;
  const current = getTab(tabId);
  if (current === undefined) return;
  if (result.ok) {
    applyLoaded(tabId, result.doc, preserveScroll ? current.scrollTop : 0);
    return;
  }
  const error = showError(result.error, current.path);
  if (current.doc === null) patchTab(tabId, { status: 'error', error });
}

/** Opens a set of Markdown files; several files always open in new tabs. */
async function openMarkdownFiles(paths: string[]): Promise<void> {
  const multiple = paths.length > 1;
  await Promise.all(
    paths.map((path, index) =>
      openDocument(path, multiple ? { newTab: true, activate: index === 0 } : {}),
    ),
  );
}

/** Opens paths from drag & drop, the command line or a second instance. */
export async function openPaths(paths: string[]): Promise<void> {
  const markdown = paths.filter(isMarkdownPath);
  const others = paths.filter((path) => !isMarkdownPath(path));
  const tasks: Promise<void>[] = [openMarkdownFiles(markdown)];
  if (others.length > 0) {
    tasks.push(
      checkFiles(others)
        .then(async (isFile) => {
          const unsupported = others.filter((_, i) => isFile[i] === true);
          const folder = others.find((_, i) => isFile[i] !== true);
          if (unsupported.length > 0) {
            toast({
              variant: 'warning',
              title: 'This file type isn’t supported.',
              description:
                unsupported.length === 1
                  ? `${basename(unsupported[0] ?? '')} is not a Markdown file.`
                  : `${unsupported.length} files are not Markdown files.`,
            });
          }
          if (folder !== undefined) await openFolder(folder);
        })
        .catch((err: unknown) => {
          logger.error('Could not inspect dropped paths', err);
        }),
    );
  }
  await Promise.all(tasks);
}

export async function openFileDialog(): Promise<void> {
  const paths = await pickMarkdownFiles();
  if (paths.length > 0) await openMarkdownFiles(paths);
}

function removeTabs(ids: string[], rememberClosed = true): void {
  const { tabs, activeId, closedPaths } = useDocuments.getState();
  const removing = tabs.filter((tab) => ids.includes(tab.id));
  if (removing.length === 0) return;
  removing.forEach(releaseTab);
  const remaining = tabs.filter((tab) => !ids.includes(tab.id));

  let nextActive = activeId;
  if (activeId !== null && ids.includes(activeId)) {
    const index = tabs.findIndex((tab) => tab.id === activeId);
    const after = tabs.slice(index + 1).find((tab) => !ids.includes(tab.id));
    const before = tabs
      .slice(0, index)
      .reverse()
      .find((tab) => !ids.includes(tab.id));
    nextActive = (after ?? before)?.id ?? null;
  }
  useDocuments.setState({
    tabs: remaining,
    activeId: nextActive,
    closedPaths: rememberClosed
      ? pushClosed(
          closedPaths,
          removing.map((tab) => tab.path),
        )
      : closedPaths,
  });
}

export function closeTab(id: string): void {
  removeTabs([id]);
}

export function closeOtherTabs(id: string): void {
  const { tabs } = useDocuments.getState();
  if (!tabs.some((tab) => tab.id === id)) return;
  removeTabs(tabs.filter((tab) => tab.id !== id).map((tab) => tab.id));
  activateTab(id);
}

export function closeAllTabs(): void {
  removeTabs(useDocuments.getState().tabs.map((tab) => tab.id));
}

export async function reopenClosedTab(): Promise<void> {
  const { closedPaths } = useDocuments.getState();
  const path = closedPaths[closedPaths.length - 1];
  if (path === undefined) return;
  useDocuments.setState({ closedPaths: closedPaths.slice(0, -1) });
  await openDocument(path, { newTab: true });
}

export function activateTab(id: string): void {
  const { activeId } = useDocuments.getState();
  if (activeId !== id && getTab(id) !== undefined) useDocuments.setState({ activeId: id });
}

function activateOffset(offset: number): void {
  const { tabs, activeId } = useDocuments.getState();
  if (tabs.length === 0) return;
  const index = tabs.findIndex((tab) => tab.id === activeId);
  const next = tabs[(Math.max(index, 0) + offset + tabs.length) % tabs.length];
  if (next !== undefined) activateTab(next.id);
}

export function activateNextTab(): void {
  activateOffset(1);
}

export function activatePreviousTab(): void {
  activateOffset(-1);
}

export function setTabScroll(id: string, scrollTop: number): void {
  const tab = getTab(id);
  if (tab !== undefined && tab.scrollTop !== scrollTop) patchTab(id, { scrollTop });
}

export function dismissExternalChange(id: string): void {
  const tab = getTab(id);
  if (tab === undefined) return;
  dismissToast(changeToastId(tab.path));
  if (tab.externalChange !== null) patchTab(id, { externalChange: null });
}

/** Re-renders every document (e.g. after the "Render raw HTML" setting changed). */
export async function rerenderAllDocuments(): Promise<void> {
  const ids = useDocuments
    .getState()
    .tabs.filter((tab) => tab.status !== 'loading')
    .map((tab) => tab.id);
  await Promise.all(ids.map((id) => reloadDocument(id, { preserveScroll: true })));
}

/** Handles the `file-changed` event emitted by the file watcher. */
export async function handleFileChanged(payload: FileChangedPayload): Promise<void> {
  const tab = findTabByPath(payload.path);
  if (tab === undefined) return;
  const toastId = changeToastId(tab.path);

  if (payload.kind === 'removed') {
    patchTab(tab.id, { externalChange: 'removed' });
    toast({
      id: toastId,
      variant: 'warning',
      title: 'File was deleted or moved.',
      description: tab.name,
      durationMs: null,
      actions: [
        { label: 'Close Tab', onClick: () => closeTab(tab.id), primary: true },
        { label: 'Keep Open', onClick: () => dismissExternalChange(tab.id) },
      ],
    });
    void notify('File was deleted or moved', tab.name);
    return;
  }

  const unchanged =
    tab.externalChange === null &&
    payload.modifiedMs !== null &&
    tab.doc?.modifiedMs === payload.modifiedMs;
  if (unchanged) return;

  if (useSettings.getState().autoReload || tab.status === 'error') {
    await reloadDocument(tab.id, { preserveScroll: true });
    return;
  }
  patchTab(tab.id, { externalChange: 'modified' });
  toast({
    id: toastId,
    variant: 'info',
    title: 'File changed externally.',
    description: tab.name,
    durationMs: null,
    actions: [
      {
        label: 'Reload',
        primary: true,
        onClick: () => void reloadDocument(tab.id, { preserveScroll: true }),
      },
      { label: 'Ignore', onClick: () => dismissExternalChange(tab.id) },
    ],
  });
  void notify('File changed externally', tab.name);
}

/** Test helper: forget module-level bookkeeping. */
export function resetDocumentActionsForTests(): void {
  requestTokens.clear();
  watchedPaths.clear();
}
