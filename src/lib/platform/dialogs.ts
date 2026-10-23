import { isTauri } from '@tauri-apps/api/core';
import { confirm, open, save } from '@tauri-apps/plugin-dialog';
import { extname, joinPath } from '@/lib/paths';

export interface ConfirmOptions {
  title: string;
  okLabel: string;
  cancelLabel: string;
  /** Dialog icon; defaults to `info`. */
  kind?: 'info' | 'warning';
}

const MARKDOWN_FILTER = {
  name: 'Markdown',
  extensions: ['md', 'markdown', 'mdown', 'mkd', 'mdx'],
};

/** Name offered for a new document before the user types one. */
const DEFAULT_NEW_FILE_NAME = 'untitled.md';

export async function pickMarkdownFiles(): Promise<string[]> {
  if (!isTauri()) return [];
  const selected = await open({
    title: 'Open Markdown File',
    multiple: true,
    directory: false,
    filters: [MARKDOWN_FILTER],
  });
  return selected ?? [];
}

export async function pickFolder(): Promise<string | null> {
  if (!isTauri()) return null;
  return open({ title: 'Open Folder', directory: true, multiple: false });
}

/** A name typed without an extension gets the default one instead of failing. */
function withMarkdownExtension(path: string): string {
  if (extname(path) !== '') return path;
  return `${path.replace(/\.$/, '')}.md`;
}

/**
 * Asks the operating system where a new Markdown file should go.
 *
 * The native save dialog — not a field inside the app — chooses the path, so
 * the user alone decides the one place the create command may write to (see
 * `create_document` in `src-tauri/src/commands.rs`). Resolves to `null` when
 * the dialog is cancelled.
 */
export async function pickNewMarkdownFile(directory: string | null): Promise<string | null> {
  if (!isTauri()) return null;
  const chosen = await save({
    title: 'New Markdown File',
    defaultPath:
      directory === null ? DEFAULT_NEW_FILE_NAME : joinPath(directory, DEFAULT_NEW_FILE_NAME),
    filters: [MARKDOWN_FILTER],
  });
  return chosen === null ? null : withMarkdownExtension(chosen);
}

export async function confirmDialog(message: string, options: ConfirmOptions): Promise<boolean> {
  if (!isTauri()) return window.confirm(message);
  const { kind = 'info', ...rest } = options;
  return confirm(message, { ...rest, kind });
}
