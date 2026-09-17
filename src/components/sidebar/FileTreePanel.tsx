import { ChevronsDownUp, FolderOpen, FolderX, RefreshCw, TriangleAlert } from 'lucide-react';
import { getShortcutLabel } from '@/app/commands';
import {
  closeFolder,
  collapseAllFolders,
  openFolderDialog,
  refreshFolder,
  useFolder,
} from '@/features/folder/actions';
import { basename, displayPath } from '@/lib/paths';
import { Button } from '@/components/ui/Button';
import { EmptyMessage } from '@/components/ui/EmptyMessage';
import { IconButton } from '@/components/ui/IconButton';
import { Spinner } from '@/components/ui/Spinner';
import { Tooltip } from '@/components/ui/Tooltip';
import { FileTree } from './FileTree';

export function FileTreePanel() {
  const rootPath = useFolder((s) => s.rootPath);
  const tree = useFolder((s) => s.tree);
  const status = useFolder((s) => s.status);
  const error = useFolder((s) => s.error);

  if (rootPath === null) {
    return (
      <EmptyMessage
        icon={<FolderOpen />}
        title="No folder open"
        description="Open a folder to browse its Markdown files."
      >
        <Tooltip label="Open a folder" shortcut={getShortcutLabel('file.openFolder')}>
          <Button
            size="sm"
            icon={<FolderOpen aria-hidden />}
            onClick={() => void openFolderDialog()}
          >
            Open Folder
          </Button>
        </Tooltip>
      </EmptyMessage>
    );
  }

  const name = tree?.root.name ?? basename(rootPath);

  return (
    <div className="flex min-h-0 flex-col">
      <div className="group/header flex h-8 shrink-0 items-center gap-1 pr-2 pl-3">
        <Tooltip label={displayPath(rootPath)} className="min-w-0 flex-1">
          <h2 className="text-ui-sm text-fg-muted min-w-0 truncate font-semibold">{name}</h2>
        </Tooltip>
        <IconButton
          size="sm"
          label="Refresh folder"
          icon={<RefreshCw />}
          disabled={status === 'loading'}
          onClick={() => void refreshFolder()}
        />
        <IconButton
          size="sm"
          label="Collapse all folders"
          icon={<ChevronsDownUp />}
          disabled={status !== 'ready'}
          onClick={collapseAllFolders}
        />
        <IconButton size="sm" label="Close folder" icon={<FolderX />} onClick={closeFolder} />
      </div>

      {status === 'loading' && !tree && (
        <div className="text-ui-sm text-fg-muted flex items-center gap-2 px-4 py-3" role="status">
          <Spinner />
          Scanning folder…
        </div>
      )}

      {status === 'error' && (
        <EmptyMessage
          icon={<TriangleAlert />}
          title={error?.title ?? 'Unable to open this folder.'}
          {...(error ? { description: error.description } : {})}
        >
          <Button size="sm" icon={<RefreshCw aria-hidden />} onClick={() => void refreshFolder()}>
            Try Again
          </Button>
        </EmptyMessage>
      )}

      {tree && status !== 'error' && (
        <>
          {tree.markdownFileCount === 0 && (tree.root.children?.length ?? 0) === 0 ? (
            <EmptyMessage
              icon={<FolderOpen />}
              title="No Markdown files"
              description="This folder has no .md files."
            />
          ) : (
            <FileTree root={tree.root} label={`Files in ${name}`} />
          )}
          {tree.truncated && (
            <p className="bg-warning-subtle text-ui-sm text-fg-muted mx-3 mb-3 flex items-start gap-2 rounded-md px-2.5 py-2">
              <TriangleAlert aria-hidden className="text-warning mt-0.5 size-3.5 shrink-0" />
              This folder is very large; only part of it is shown.
            </p>
          )}
        </>
      )}
    </div>
  );
}
