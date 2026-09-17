import { clsx } from 'clsx';
import { Clock, FileText, X } from 'lucide-react';
import { memo, type KeyboardEvent, type MouseEvent } from 'react';
import { openDocument } from '@/features/documents/actions';
import { clearRecent, removeRecent, useRecent } from '@/features/recent/actions';
import { dirname, displayPath, samePath } from '@/lib/paths';
import { openContextMenu } from '@/stores/contextMenuStore';
import { selectActiveTab, useDocuments } from '@/stores/documentsStore';
import { useSettings } from '@/stores/settingsStore';
import type { RecentFile } from '@/types';
import { EmptyMessage } from '@/components/ui/EmptyMessage';
import { openFileMenuItems, pathMenuItems } from './entryMenu';

export function RecentPanel() {
  const items = useRecent((s) => s.items);
  const remember = useSettings((s) => s.rememberRecent);
  const activePath = useDocuments((s) => selectActiveTab(s)?.path ?? null);

  if (items.length === 0) {
    return (
      <EmptyMessage
        icon={<Clock />}
        title="No recent files"
        description={
          remember ? 'Files you open will appear here.' : 'Recent files are turned off in Settings.'
        }
      />
    );
  }

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-recent-open]'),
    );
    const index = buttons.findIndex((b) => b === document.activeElement);
    const next = event.key === 'ArrowDown' ? index + 1 : index - 1;
    const target = buttons[Math.max(0, Math.min(buttons.length - 1, next))];
    if (target) {
      event.preventDefault();
      target.focus();
    }
  };

  return (
    <section aria-labelledby="recent-heading" className="flex min-h-0 flex-col">
      <div className="flex h-8 shrink-0 items-center pr-2 pl-3">
        <h2 id="recent-heading" className="flex-1 text-ui-sm font-semibold text-fg-muted">
          Recent files
        </h2>
        <button
          type="button"
          onClick={clearRecent}
          className="h-6 rounded-sm px-1.5 text-ui-sm text-fg-muted transition-colors duration-100 hover:bg-bg-muted hover:text-fg"
        >
          Clear
        </button>
      </div>
      {/* Arrow keys move between the native buttons in the list. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <ul className="px-2 pb-3" onKeyDown={onKeyDown}>
        {items.map((item) => (
          <RecentItem
            key={item.path}
            item={item}
            active={activePath !== null && samePath(activePath, item.path)}
          />
        ))}
      </ul>
    </section>
  );
}

const RecentItem = memo(function RecentItem({
  item,
  active,
}: {
  item: RecentFile;
  active: boolean;
}) {
  const onContextMenu = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    openContextMenu(event.clientX, event.clientY, [
      ...openFileMenuItems(item.path),
      { type: 'separator' },
      ...pathMenuItems(item.path),
      { type: 'separator' },
      {
        id: 'remove',
        label: 'Remove from Recent',
        onSelect: () => {
          removeRecent(item.path);
        },
      },
    ]);
  };

  return (
    <li className="group relative">
      <button
        type="button"
        data-recent-open
        title={displayPath(item.path)}
        aria-current={active ? 'page' : undefined}
        onClick={() => void openDocument(item.path)}
        onContextMenu={onContextMenu}
        className={clsx(
          'focus-inset flex w-full min-w-0 items-start gap-2 rounded-md py-1.5 pr-8 pl-2 text-left',
          'transition-colors duration-75',
          active ? 'bg-accent-subtle' : 'hover:bg-bg-muted',
        )}
      >
        <FileText
          aria-hidden
          className={clsx('mt-0.5 size-4 shrink-0', active ? 'text-accent' : 'text-fg-subtle')}
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-center gap-1.5">
            <span
              className={clsx(
                'min-w-0 truncate text-ui',
                active ? 'text-accent' : 'text-fg',
                item.missing && 'text-fg-subtle line-through',
              )}
            >
              {item.name}
            </span>
            {item.missing && (
              <span className="shrink-0 rounded-sm bg-bg-muted px-1 text-ui-xs text-fg-muted">
                Missing
              </span>
            )}
          </span>
          <span className="truncate text-ui-xs text-fg-subtle">
            {displayPath(dirname(item.path))}
          </span>
        </span>
      </button>
      <button
        type="button"
        aria-label={`Remove ${item.name} from recent files`}
        title="Remove from Recent"
        onClick={() => {
          removeRecent(item.path);
        }}
        className={clsx(
          'absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-sm text-fg-subtle',
          'opacity-0 transition-opacity duration-100 group-hover:opacity-100 focus-visible:opacity-100',
          'hover:bg-bg-muted hover:text-fg',
        )}
      >
        <X aria-hidden className="size-3.5" />
      </button>
    </li>
  );
});
