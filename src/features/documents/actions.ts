// All mutations of the documents store. Loads are race-safe: every load
// gets a request token and stale results (tab closed / reloaded again) are
// ignored.
import { toAppError } from '@/lib/errors';
import { basename, dirname, isMarkdownPath, samePath } from '@/lib/paths';
import { confirmDialog, pickMarkdownFiles, pickNewMarkdownFile } from '@/lib/platform/dialogs';
import {
  checkFiles,
  createDocument as createDocumentFile,
  openDocumentFile,
  readSource,
  renderSource,
  saveDocument as saveDocumentFile,
  unwatchFile,
  watchFile,
} from '@/lib/platform/ipc';
import { logger } from '@/lib/platform/logger';
import { notify } from '@/lib/platform/system';
import { MAX_CLOSED_PATHS, useDocuments } from '@/stores/documentsStore';
import { useFolder } from '@/stores/folderStore';
import { addRecent } from '@/stores/recentStore';
import { useSettings } from '@/stores/settingsStore';
import { dismissToast, toast } from '@/stores/toastStore';
import type {
  DocumentSource,
  DocumentTab,
  FileChangedPayload,
  OpenedDocument,
  RenderedSource,
} from '@/types';
import { openFolder, refreshFolder } from '../folder/actions';

export interface OpenDocumentOptions {
  newTab?: boolean;
  activate?: boolean;
  scrollTop?: number;
}

export interface ReloadOptions {
  preserveScroll?: boolean;
}

export interface StopEditingOptions {
  /** Throw the draft away (asks first when there are unsaved changes). */
  discard?: boolean;
}

/** Editing fields of a tab that has no draft. */
const NOT_EDITING = {
  editing: false,
  draft: null,
  savedText: null,
  dirty: false,
  saving: false,
} as const satisfies Partial<DocumentTab>;

const requestTokens = new Map<string, number>();
/** Tab id → token of the in-flight `read_source` / `render_source` call. */
const sourceTokens = new Map<string, number>();
const previewTokens = new Map<string, number>();
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
  sourceTokens.delete(tab.id);
  previewTokens.delete(tab.id);
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
    ...NOT_EDITING,
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
    // A load always lands on the text that is on disk; callers that could
    // lose a draft ask for confirmation first.
    ...NOT_EDITING,
  });
  if (!samePath(tab.path, doc.path)) dismissToast(changeToastId(tab.path));
  dismissToast(changeToastId(doc.path));
  startWatching(tabId, doc.path);
  addRecent(doc.path);
}

/**
 * Asks before unsaved changes are thrown away. A dialog that cannot be shown
 * counts as "no", so a draft is never lost by accident.
 */
async function confirmDiscard(dirty: DocumentTab[]): Promise<boolean> {
  const first = dirty[0];
  if (first === undefined) return true;
  const message =
    dirty.length === 1
      ? `${first.name} has unsaved changes.\n\nDiscard them?`
      : `${dirty.length} files have unsaved changes.\n\nDiscard them?`;
  try {
    return await confirmDialog(message, {
      title: 'Unsaved Changes',
      okLabel: 'Discard',
      cancelLabel: 'Cancel',
      kind: 'warning',
    });
  } catch (err) {
    logger.warn('Could not ask about unsaved changes', err);
    return false;
  }
}

/** True when the given tabs may be closed (no draft, or the user agreed). */
async function confirmClosing(ids: string[]): Promise<boolean> {
  const dirty = useDocuments.getState().tabs.filter((tab) => ids.includes(tab.id) && tab.dirty);
  if (dirty.length === 0) return true;
  return confirmDiscard(dirty);
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
  const active = activeId === null ? undefined : tabs.find((t) => t.id === activeId);
  // A tab with unsaved changes is never replaced; the document opens beside it.
  const replaced = !newTab && active?.dirty !== true ? active : undefined;

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
  // Reloading replaces the draft with what is on disk.
  if (tab.dirty && !(await confirmDiscard([tab]))) return;
  if (getTab(tabId) === undefined) return;
  const wasEditing = tab.editing;
  const preserveScroll = options.preserveScroll ?? true;
  if (tab.doc === null) patchTab(tabId, { status: 'loading', error: null });

  const result = await loadFor(tabId, tab.path);
  if (result === null) return;
  const current = getTab(tabId);
  if (current === undefined) return;
  if (result.ok) {
    applyLoaded(tabId, result.doc, preserveScroll ? current.scrollTop : 0);
    // Stay in the editor, now showing the reloaded text.
    if (wasEditing) await startEditing(tabId);
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

/**
 * Creates a new Markdown file and opens it, ready to type in.
 *
 * The native save dialog picks the path — the app never creates a file at a
 * path of its own making — and the backend refuses to overwrite anything that
 * is already there. `directory` preselects the folder the action was invoked
 * from; without one, the active document's folder or the open folder is used.
 */
export async function createFileDialog(directory: string | null = null): Promise<void> {
  const path = await pickNewMarkdownFile(directory ?? suggestedDirectory());
  // Cancelling the dialog does nothing at all.
  if (path === null) return;

  let doc: OpenedDocument;
  try {
    doc = await createDocumentFile(path, renderOptions());
  } catch (err) {
    const error = toAppError(err, 'create');
    logger.error(`Failed to create ${path}`, error.technical);
    toast({ variant: 'error', title: error.title, description: error.description });
    return;
  }

  const existing = findTabByPath(doc.path);
  if (existing !== undefined) {
    // The new file landed where an open tab points, so that tab's own file was
    // gone. Reloading asks first, so an unsaved draft is never thrown away.
    activateTab(existing.id);
    await Promise.all([reloadDocument(existing.id), folderRefresh()]);
    return;
  }

  // A new document always gets its own tab; it never replaces what is open.
  const tab = createTab(doc.path, 0);
  useDocuments.setState(({ tabs }) => ({ tabs: [...tabs, tab], activeId: tab.id }));
  applyLoaded(tab.id, doc, 0);
  // The tree is rescanned so the new file shows up; the open tab selects it.
  await Promise.all([startEditing(tab.id), folderRefresh()]);
}

/** Folder to offer when the caller did not name one. */
function suggestedDirectory(): string | null {
  const { tabs, activeId } = useDocuments.getState();
  const active = activeId === null ? undefined : tabs.find((tab) => tab.id === activeId);
  if (active !== undefined) return dirname(active.path);
  return useFolder.getState().rootPath;
}

function folderRefresh(): Promise<void> {
  return useFolder.getState().rootPath === null ? Promise.resolve() : refreshFolder();
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

/**
 * Asks about unsaved changes before the window closes.
 *
 * Returns true when it is safe to quit; cancelling keeps the window open with
 * every draft intact.
 */
export async function confirmQuit(): Promise<boolean> {
  const ids = useDocuments.getState().tabs.map((tab) => tab.id);
  return confirmClosing(ids);
}

export async function closeTab(id: string): Promise<void> {
  if (!(await confirmClosing([id]))) return;
  removeTabs([id]);
}

export async function closeOtherTabs(id: string): Promise<void> {
  const { tabs } = useDocuments.getState();
  if (!tabs.some((tab) => tab.id === id)) return;
  const ids = tabs.filter((tab) => tab.id !== id).map((tab) => tab.id);
  if (!(await confirmClosing(ids))) return;
  removeTabs(ids);
  activateTab(id);
}

export async function closeAllTabs(): Promise<void> {
  const ids = useDocuments.getState().tabs.map((tab) => tab.id);
  if (!(await confirmClosing(ids))) return;
  removeTabs(ids);
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

// ---------------------------------------------------------------------------
// Editing
// ---------------------------------------------------------------------------

/** Re-renders the preview from the draft, without touching the file. */
async function previewDraft(tabId: string): Promise<void> {
  const tab = getTab(tabId);
  if (tab === undefined) return;
  if (tab.draft === null || tab.doc === null) return;
  const token = ++tokenCounter;
  previewTokens.set(tabId, token);
  let rendered: RenderedSource;
  try {
    rendered = await renderSource(tab.path, tab.draft, renderOptions());
  } catch (err) {
    previewTokens.delete(tabId);
    // The last saved render stays on screen.
    logger.warn(`Could not preview unsaved changes to ${tab.path}`, err);
    return;
  }
  if (previewTokens.get(tabId) !== token) return;
  previewTokens.delete(tabId);
  const current = getTab(tabId);
  if (current === undefined) return;
  if (current.doc === null) return;
  patchTab(tabId, {
    doc: {
      ...current.doc,
      html: rendered.html,
      headings: rendered.headings,
      wordCount: rendered.wordCount,
      flavor: rendered.flavor,
      simplified: rendered.simplified,
    },
    revision: current.revision + 1,
  });
}

/** Opens the editor for a tab, loading the raw file text first. */
export async function startEditing(tabId: string): Promise<void> {
  const tab = getTab(tabId);
  if (tab === undefined) return;
  if (tab.status !== 'ready' || tab.doc === null || tab.editing) return;
  // A draft kept while reading goes straight back into the editor.
  if (tab.draft !== null) {
    patchTab(tabId, { editing: true });
    return;
  }

  const token = ++tokenCounter;
  sourceTokens.set(tabId, token);
  let source: DocumentSource;
  try {
    source = await readSource(tab.path);
  } catch (err) {
    if (sourceTokens.get(tabId) !== token) return;
    sourceTokens.delete(tabId);
    const error = toAppError(err, 'file');
    logger.error(`Failed to read ${tab.path} for editing`, error.technical);
    toast({
      variant: 'error',
      title: 'Unable to edit this file.',
      description: error.description,
    });
    return;
  }
  if (sourceTokens.get(tabId) !== token || getTab(tabId) === undefined) return;
  sourceTokens.delete(tabId);
  patchTab(tabId, {
    editing: true,
    draft: source.content,
    savedText: source.content,
    dirty: false,
  });
}

/** Records editor input and keeps `dirty` in sync. */
export function setDraft(tabId: string, text: string): void {
  const tab = getTab(tabId);
  if (tab === undefined) return;
  if (tab.draft === null || tab.draft === text) return;
  patchTab(tabId, { draft: text, dirty: text !== tab.savedText });
}

/** Writes the draft to disk and adopts the re-rendered document. */
export async function saveDocument(tabId: string): Promise<void> {
  const tab = getTab(tabId);
  if (tab === undefined) return;
  if (tab.draft === null || !tab.dirty || tab.saving) return;
  const content = tab.draft;
  patchTab(tabId, { saving: true });

  let doc: OpenedDocument;
  try {
    doc = await saveDocumentFile(tab.path, content, renderOptions());
  } catch (err) {
    if (getTab(tabId) === undefined) return;
    patchTab(tabId, { saving: false });
    const error = toAppError(err, 'save');
    logger.error(`Failed to save ${tab.path}`, error.technical);
    toast({ variant: 'error', title: error.title, description: error.description });
    return;
  }

  const current = getTab(tabId);
  if (current === undefined) return;
  patchTab(tabId, {
    path: doc.path,
    name: doc.name,
    status: 'ready',
    doc,
    error: null,
    externalChange: null,
    revision: current.revision + 1,
    savedText: content,
    // The user may have typed on while the write was in flight.
    dirty: current.draft !== content,
    saving: false,
  });
  if (!samePath(current.path, doc.path)) dismissToast(changeToastId(current.path));
  dismissToast(changeToastId(doc.path));
  startWatching(tabId, doc.path);
}

/**
 * Leaves the editor. Without `discard` the draft is kept and the preview is
 * re-rendered from it; with `discard` the draft is thrown away after asking.
 */
export async function stopEditing(tabId: string, options: StopEditingOptions = {}): Promise<void> {
  const tab = getTab(tabId);
  if (tab === undefined) return;
  if (!tab.editing) return;

  if (options.discard === true) {
    if (tab.dirty && !(await confirmDiscard([tab]))) return;
    if (getTab(tabId) === undefined) return;
    patchTab(tabId, { ...NOT_EDITING });
    return;
  }

  patchTab(tabId, { editing: false });
  if (tab.dirty) await previewDraft(tabId);
}

export async function toggleEditing(tabId: string): Promise<void> {
  const tab = getTab(tabId);
  if (tab === undefined) return;
  if (tab.editing) await stopEditing(tabId);
  else await startEditing(tabId);
}

/** Re-renders every document (e.g. after the "Render raw HTML" setting changed). */
export async function rerenderAllDocuments(): Promise<void> {
  const candidates = useDocuments.getState().tabs.filter((tab) => tab.status !== 'loading');
  // Tabs with unsaved changes are never reloaded from disk; their preview is
  // re-rendered from the draft instead.
  await Promise.all(
    candidates.map((tab) =>
      tab.dirty ? previewDraft(tab.id) : reloadDocument(tab.id, { preserveScroll: true }),
    ),
  );
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
        { label: 'Close Tab', onClick: () => void closeTab(tab.id), primary: true },
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

  // Never silently throw a draft away, not even with auto-reload on.
  if (tab.dirty) {
    patchTab(tab.id, { externalChange: 'modified' });
    toast({
      id: toastId,
      variant: 'warning',
      title: 'File changed on disk while you were editing.',
      description: `${tab.name} — your unsaved changes are still here.`,
      durationMs: null,
      actions: [
        { label: 'Keep Editing', primary: true, onClick: () => dismissExternalChange(tab.id) },
        {
          label: 'Reload',
          onClick: () => void reloadDocument(tab.id, { preserveScroll: true }),
        },
      ],
    });
    void notify('File changed on disk', tab.name);
    return;
  }

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
  sourceTokens.clear();
  previewTokens.clear();
  watchedPaths.clear();
}
