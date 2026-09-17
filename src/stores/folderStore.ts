// Open folder state. Loading actions live in `src/features/folder/actions.ts`.
import { create } from 'zustand';
import { relativePath } from '@/lib/paths';
import type { AppError, DirectoryEntry, DirectoryTree } from '@/types';

export type FolderStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface FolderState {
  rootPath: string | null;
  tree: DirectoryTree | null;
  status: FolderStatus;
  error: AppError | null;
  /** Directory path → expanded. */
  expanded: Record<string, boolean>;
}

export interface FolderFile {
  path: string;
  name: string;
  relative: string;
}

export const INITIAL_FOLDER_STATE: Readonly<FolderState> = Object.freeze({
  rootPath: null,
  tree: null,
  status: 'idle',
  error: null,
  expanded: {},
});

export const useFolder = create<FolderState>()(() => ({ ...INITIAL_FOLDER_STATE }));

export function toggleFolderExpanded(path: string): void {
  useFolder.setState(({ expanded }) => ({ expanded: { ...expanded, [path]: !expanded[path] } }));
}

export function collapseAllFolders(): void {
  useFolder.setState({ expanded: {} });
}

function collectMarkdown(entry: DirectoryEntry, rootPath: string, out: FolderFile[]): void {
  if (entry.kind === 'file') {
    if (entry.isMarkdown) {
      out.push({
        path: entry.path,
        name: entry.name,
        relative: relativePath(rootPath, entry.path),
      });
    }
    return;
  }
  entry.children?.forEach((child) => {
    collectMarkdown(child, rootPath, out);
  });
}

let cachedTree: DirectoryTree | null = null;
let cachedFiles: FolderFile[] = [];

/** All Markdown files of the open folder (memoized per tree). */
export function getFolderMarkdownFiles(): FolderFile[] {
  const { tree } = useFolder.getState();
  if (tree !== cachedTree) {
    cachedTree = tree;
    cachedFiles = [];
    if (tree !== null) collectMarkdown(tree.root, tree.root.path, cachedFiles);
  }
  return cachedFiles;
}
