import { isTauri } from '@tauri-apps/api/core';
import { confirm, open } from '@tauri-apps/plugin-dialog';

export interface ConfirmOptions {
  title: string;
  okLabel: string;
  cancelLabel: string;
}

export async function pickMarkdownFiles(): Promise<string[]> {
  if (!isTauri()) return [];
  const selected = await open({
    title: 'Open Markdown File',
    multiple: true,
    directory: false,
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] }],
  });
  return selected ?? [];
}

export async function pickFolder(): Promise<string | null> {
  if (!isTauri()) return null;
  return open({ title: 'Open Folder', directory: true, multiple: false });
}

export async function confirmDialog(message: string, options: ConfirmOptions): Promise<boolean> {
  if (!isTauri()) return window.confirm(message);
  return confirm(message, { ...options, kind: 'info' });
}
