// Typed wrappers around the Rust commands (see the IPC contract).
// Data commands always go through `invoke` (callers handle rejections);
// fire-and-forget side-effect commands are no-ops outside Tauri.
import { invoke, isTauri } from '@tauri-apps/api/core';
import type {
  DirectoryTree,
  DocumentSource,
  OpenedDocument,
  RenderOptions,
  RenderedSource,
} from '@/types';

export { isTauri };

export function openDocumentFile(path: string, options: RenderOptions): Promise<OpenedDocument> {
  return invoke<OpenedDocument>('open_document', { path, options });
}

/** Raw file text for the editor. */
export function readSource(path: string): Promise<DocumentSource> {
  return invoke<DocumentSource>('read_source', { path });
}

/** Writes the file and returns the re-rendered document. */
export function saveDocument(
  path: string,
  content: string,
  options: RenderOptions,
): Promise<OpenedDocument> {
  return invoke<OpenedDocument>('save_document', { path, content, options });
}

/** Renders unsaved text; `path` only selects the flavor, the file is not read. */
export function renderSource(
  path: string,
  source: string,
  options: RenderOptions,
): Promise<RenderedSource> {
  return invoke<RenderedSource>('render_source', { path, source, options });
}

export function scanFolder(path: string, showAllFiles: boolean): Promise<DirectoryTree> {
  return invoke<DirectoryTree>('scan_folder', { path, showAllFiles });
}

export function checkFiles(paths: string[]): Promise<boolean[]> {
  if (paths.length === 0) return Promise.resolve([]);
  return invoke<boolean[]>('check_files', { paths });
}

export async function watchFile(path: string): Promise<void> {
  if (!isTauri()) return;
  await invoke('watch_file', { path });
}

export async function unwatchFile(path: string): Promise<void> {
  if (!isTauri()) return;
  await invoke('unwatch_file', { path });
}

export async function takeStartupPaths(): Promise<string[]> {
  if (!isTauri()) return [];
  return invoke<string[]>('take_startup_paths');
}

export async function setMenuVisible(visible: boolean): Promise<void> {
  if (!isTauri()) return;
  await invoke('set_menu_visible', { visible });
}
