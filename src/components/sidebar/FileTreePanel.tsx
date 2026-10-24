import {
  ChevronsDownUp,
  FilePlus,
  FileText,
  FolderOpen,
  FolderX,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react';
import { getShortcutLabel } from '@/app/commands';
import { createFileDialog, openFileDialog } from '@/features/documents/actions';
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
import { SidebarPanelHeader } from './SidebarPanelHeader';

export function FileTreePanel() {
  const rootPath = useFolder((s) => s.rootPath);
  const tree = useFolder((s) => s.tree);
  const status = useFolder((s) => s.status);
  const error = useFolder((s) => s.error);
  const name = tree?.root.name ?? (rootPath === null ? '' : basename(rootPath));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SidebarPanelHeader title="Files">
        <IconButton
          label="Open File"
          shortcut={getShortcutLabel('file.open')}
          icon={<FileText />}
          onClick={() => void openFileDialog()}
        />
        {rootPath !== null && (
          <>
            <IconButton
              label="New file in this folder"
              shortcut={getShortcutLabel('file.new')}
              icon={<FilePlus />}
              onClick={() => void createFileDialog(rootPath)}
            />
            <IconButton
              label="Refresh folder"
              icon={<RefreshCw />}
              disabled={status === 'loading'}
              onClick={() => void refreshFolder()}
            />
            <IconButton
              label="Collapse all folders"
              icon={<ChevronsDownUp />}
              disabled={status !== 'ready'}
              onClick={collapseAllFolders}
            />
            <IconButton label="Close folder" icon={<FolderX />} onClick={closeFolder} />
          </>
        )}
      </SidebarPanelHeader>

      {rootPath === null ? (
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
      ) : (
        <>
          {/* The folder itself is the panel's title block. */}
          <div className="shrink-0 px-4 pt-4 pb-3">
            <h2 className="truncate font-heading text-2xl leading-none font-semibold uppercase">
              {name}
            </h2>
            <p title={displayPath(rootPath)} className="mt-1.5 truncate text-ui-xs text-fg-muted">
              {displayPath(rootPath)}
            </p>
          </div>

          {status === 'loading' && !tree && (
            <div
              className="flex items-center gap-2 px-4 py-3 text-ui-sm text-fg-muted"
              role="status"
            >
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
              <Button
                size="sm"
                icon={<RefreshCw aria-hidden />}
                onClick={() => void refreshFolder()}
              >
                Try Again
              </Button>
            </EmptyMessage>
          )}

          {tree && status !== 'error' && (
            <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2">
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
                <p className="mx-1 mb-3 flex items-start gap-2 border border-border bg-warning-subtle px-2.5 py-2 text-ui-sm text-fg-muted">
                  <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0 text-warning" />
                  This folder is very large; only part of it is shown.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
