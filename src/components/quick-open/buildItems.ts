import { dirname, displayPath, pathKey } from '@/lib/paths';
import type { FolderFile } from '@/stores/folderStore';
import type { DocumentTab, RecentFile } from '@/types';

export type QuickOpenGroup = 'Open tabs' | 'Recent' | 'Folder';

export interface QuickOpenItem {
  path: string;
  name: string;
  /** Text matched by the fuzzy filter; always ends with `name`. */
  text: string;
  group: QuickOpenGroup;
  missing: boolean;
}

function textFor(path: string, name: string): string {
  const dir = displayPath(dirname(path));
  if (dir === '') return name;
  const sep = dir.includes('\\') && !dir.includes('/') ? '\\' : '/';
  return dir.endsWith(sep) ? `${dir}${name}` : `${dir}${sep}${name}`;
}

/** Candidates for Quick Open: open tabs, then recent files, then folder files (deduped). */
export function buildQuickOpenItems(
  tabs: readonly Pick<DocumentTab, 'path' | 'name'>[],
  recent: readonly RecentFile[],
  folderFiles: readonly FolderFile[],
): QuickOpenItem[] {
  const seen = new Set<string>();
  const out: QuickOpenItem[] = [];
  const add = (item: QuickOpenItem) => {
    const key = pathKey(item.path);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(item);
  };
  for (const tab of tabs) {
    add({
      path: tab.path,
      name: tab.name,
      text: textFor(tab.path, tab.name),
      group: 'Open tabs',
      missing: false,
    });
  }
  for (const file of recent) {
    add({
      path: file.path,
      name: file.name,
      text: textFor(file.path, file.name),
      group: 'Recent',
      missing: file.missing === true,
    });
  }
  for (const file of folderFiles) {
    add({ path: file.path, name: file.name, text: file.relative, group: 'Folder', missing: false });
  }
  return out;
}
