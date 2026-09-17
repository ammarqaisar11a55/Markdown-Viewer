import type { DirectoryEntry } from '@/types';

export interface VisibleNode {
  entry: DirectoryEntry;
  /** 1-based level (children of the root folder are level 1). */
  level: number;
  parentPath: string | null;
  setSize: number;
  posInSet: number;
  expanded: boolean;
}

/** Visible rows of the tree (children of `root`, recursing into expanded folders). */
export function flattenTree(
  root: DirectoryEntry,
  expanded: Readonly<Record<string, boolean>>,
): VisibleNode[] {
  const out: VisibleNode[] = [];
  const walk = (entries: readonly DirectoryEntry[], level: number, parentPath: string | null) => {
    entries.forEach((entry, index) => {
      const isDir = entry.kind === 'directory';
      const open = isDir && expanded[entry.path] === true;
      out.push({
        entry,
        level,
        parentPath,
        setSize: entries.length,
        posInSet: index + 1,
        expanded: open,
      });
      if (open && entry.children) walk(entry.children, level + 1, entry.path);
    });
  };
  walk(root.children ?? [], 1, null);
  return out;
}
