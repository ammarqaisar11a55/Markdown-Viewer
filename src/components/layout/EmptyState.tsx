import { clsx } from 'clsx';
import { FileText, FolderOpen } from 'lucide-react';
import { getShortcutLabel } from '@/app/commands';
import { openDocument, openFileDialog } from '@/features/documents/actions';
import { openFolderDialog } from '@/features/folder/actions';
import { useRecent } from '@/features/recent/actions';
import { dirname, displayPath } from '@/lib/paths';
import { AppMark } from '@/components/ui/AppMark';
import { Button } from '@/components/ui/Button';
import { Kbd } from '@/components/ui/Kbd';
import { Tooltip } from '@/components/ui/Tooltip';

const MAX_RECENT = 6;

export function EmptyState() {
  const recent = useRecent((s) => s.items);
  const items = recent.slice(0, MAX_RECENT);
  const openShortcut = getShortcutLabel('file.open');
  const folderShortcut = getShortcutLabel('file.openFolder');

  return (
    <div className="flex h-full min-h-0 overflow-y-auto">
      <div className="m-auto flex w-full max-w-[540px] flex-col items-center px-8 py-14 text-center">
        <AppMark className="size-11" />
        <h1 className="mt-6 text-[clamp(40px,6vw,56px)] leading-[0.94] uppercase">
          Markdown Viewer
        </h1>
        <p className="mt-4 text-ui-lg text-fg-muted">Read Markdown beautifully.</p>

        <Button
          variant="primary"
          className="mt-9 h-9 px-5"
          icon={<FileText aria-hidden />}
          onClick={() => void openFileDialog()}
        >
          Open Markdown File
        </Button>
        <p className="mt-4 text-ui-sm text-fg-subtle">or drag a .md file here</p>
        {openShortcut && <Kbd shortcut={openShortcut} className="mt-3" />}

        <Tooltip label="Open a folder of Markdown files" shortcut={folderShortcut} side="bottom">
          <Button
            variant="ghost"
            size="sm"
            className="mt-7"
            icon={<FolderOpen aria-hidden />}
            onClick={() => void openFolderDialog()}
          >
            Open Folder
          </Button>
        </Tooltip>

        {items.length > 0 && (
          <section aria-labelledby="empty-recent-title" className="mt-12 w-full text-left">
            <h2
              id="empty-recent-title"
              className="mv-label border-b border-border px-2 pb-2 text-ui-sm text-fg-muted"
            >
              Recent files
            </h2>
            <ul>
              {items.map((item) => (
                <li key={item.path}>
                  <Tooltip label={displayPath(item.path)} side="bottom" className="flex w-full">
                    <button
                      type="button"
                      onClick={() => void openDocument(item.path)}
                      className={clsx(
                        'group flex h-9 w-full min-w-0 items-center gap-3 border-b border-border/60 px-2 text-left',
                        'transition-colors duration-100 hover:bg-bg-muted',
                        item.missing && 'opacity-60',
                      )}
                    >
                      <FileText aria-hidden className="size-4 shrink-0 text-fg-subtle" />
                      <span
                        className={clsx(
                          'min-w-0 shrink-0 truncate text-ui text-fg',
                          item.missing && 'line-through',
                        )}
                      >
                        {item.name}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-ui-sm text-fg-subtle">
                        {displayPath(dirname(item.path))}
                      </span>
                      {item.missing && (
                        <span className="mv-label shrink-0 border border-border px-1.5 text-[10px] text-fg-muted">
                          Missing
                        </span>
                      )}
                    </button>
                  </Tooltip>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
