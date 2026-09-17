import { toAppError } from '@/lib/errors';
import { pickFolder } from '@/lib/platform/dialogs';
import { scanFolder } from '@/lib/platform/ipc';
import { logger } from '@/lib/platform/logger';
import { INITIAL_FOLDER_STATE, useFolder } from '@/stores/folderStore';
import { useSettings } from '@/stores/settingsStore';
import { toast } from '@/stores/toastStore';
import { useUi } from '@/stores/uiStore';

export {
  collapseAllFolders,
  getFolderMarkdownFiles,
  toggleFolderExpanded,
  useFolder,
} from '@/stores/folderStore';
export type { FolderFile } from '@/stores/folderStore';

export interface OpenFolderOptions {
  /** Suppress the error toast (used when restoring a session). */
  silent?: boolean;
  /** Keep the current expansion state (refresh). */
  keepExpanded?: boolean;
}

let requestToken = 0;

export async function openFolder(path: string, options: OpenFolderOptions = {}): Promise<void> {
  const token = ++requestToken;
  const previous = useFolder.getState();
  useFolder.setState({
    rootPath: path,
    status: 'loading',
    error: null,
    ...(options.keepExpanded === true ? {} : { tree: null, expanded: {} }),
  });
  try {
    const tree = await scanFolder(path, useSettings.getState().showAllFiles);
    if (token !== requestToken) return;
    const rootPath = tree.root.path;
    const expanded = options.keepExpanded === true ? previous.expanded : { [rootPath]: true };
    useFolder.setState({ rootPath, tree, status: 'ready', error: null, expanded });
    if (options.keepExpanded !== true) {
      useUi.setState({ sidebarView: 'files', sidebarCollapsed: false });
    }
  } catch (err) {
    if (token !== requestToken) return;
    const error = toAppError(err, 'folder');
    logger.error(`Failed to open folder ${path}`, error.technical);
    useFolder.setState({ status: 'error', error, tree: null });
    if (options.silent !== true) {
      toast({ variant: 'error', title: error.title, description: error.description });
    }
  }
}

export async function openFolderDialog(): Promise<void> {
  const path = await pickFolder();
  if (path !== null) await openFolder(path);
}

export async function refreshFolder(): Promise<void> {
  const { rootPath } = useFolder.getState();
  if (rootPath !== null) await openFolder(rootPath, { keepExpanded: true });
}

export function closeFolder(): void {
  requestToken += 1;
  useFolder.setState({ ...INITIAL_FOLDER_STATE });
}
