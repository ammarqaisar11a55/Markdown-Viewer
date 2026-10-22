import { isTauri } from '@tauri-apps/api/core';
import { confirm, open } from '@tauri-apps/plugin-dialog';

export interface ConfirmOptions {
  title: string;
  okLabel: string;
  cancelLabel: string;
  /** Dialog icon; defaults to `info`. */
  kind?: 'info' | 'warning';
}

export async function pickMarkdownFiles(): Promise<string[]> {
  if (!isTauri()) return [];
  const selected = await open({
    title: 'Open Markdown File',
    multiple: true,
    directory: false,
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd', 'mdx'] }],
  });
  return selected ?? [];
}

export async function pickFolder(): Promise<string | null> {
  if (!isTauri()) return null;
  return open({ title: 'Open Folder', directory: true, multiple: false });
}

export async function confirmDialog(message: string, options: ConfirmOptions): Promise<boolean> {
  if (!isTauri()) return window.confirm(message);
  const { kind = 'info', ...rest } = options;
  return confirm(message, { ...rest, kind });
}
