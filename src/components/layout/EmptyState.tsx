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
      <div className="m-auto flex w-full max-w-[420px] flex-col items-center px-6 py-12 text-center">
        <AppMark className="size-12" />
        <h1 className="mt-5 font-serif text-[28px] leading-9 font-semibold tracking-[-0.015em] text-fg">
          Markdown Viewer
        </h1>
        <p className="mt-1 font-serif text-[17px] leading-6 text-fg-muted italic">
          Read Markdown beautifully.
        </p>

        <Button
          variant="primary"
          className="mt-8 h-9 px-4"
          icon={<FileText aria-hidden />}
          onClick={() => void openFileDialog()}
        >
          Open Markdown File
        </Button>
        <p className="mt-3 text-ui-sm text-fg-subtle">or drag a .md file here</p>
        {openShortcut && <Kbd shortcut={openShortcut} className="mt-3" />}

        <Tooltip label="Open a folder of Markdown files" shortcut={folderShortcut} side="bottom">
          <Button
            variant="ghost"
            size="sm"
            className="mt-6"
            icon={<FolderOpen aria-hidden />}
            onClick={() => void openFolderDialog()}
          >
            Open Folder
          </Button>
        </Tooltip>

        {items.length > 0 && (
          <section aria-labelledby="empty-recent-title" className="mt-10 w-full text-left">
            <h2
              id="empty-recent-title"
              className="border-b border-border px-2 pb-1.5 text-ui-sm font-medium text-fg-muted"
            >
              Recent files
            </h2>
            <ul className="mt-1">
              {items.map((item) => (
                <li key={item.path}>
                  <Tooltip label={displayPath(item.path)} side="bottom" className="flex w-full">
                    <button
                      type="button"
                      onClick={() => void openDocument(item.path)}
                      className={clsx(
                        'group flex h-8 w-full min-w-0 items-center gap-2.5 rounded-md px-2 text-left',
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
                        <span className="shrink-0 text-ui-xs text-fg-subtle">Missing</span>
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
