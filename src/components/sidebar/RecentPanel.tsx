import { clsx } from 'clsx';
import { Clock, X } from 'lucide-react';
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
import { SidebarPanelHeader } from './SidebarPanelHeader';

export function RecentPanel() {
  const items = useRecent((s) => s.items);
  const remember = useSettings((s) => s.rememberRecent);
  const activePath = useDocuments((s) => selectActiveTab(s)?.path ?? null);

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
    <div className="flex min-h-0 flex-1 flex-col">
      <SidebarPanelHeader title="Recent">
        {items.length > 0 && (
          <button
            type="button"
            onClick={clearRecent}
            className="h-6.5 shrink-0 px-2 font-heading text-ui font-semibold text-accent transition-colors duration-100 hover:bg-accent-subtle"
          >
            Clear
          </button>
        )}
      </SidebarPanelHeader>

      {items.length === 0 ? (
        <EmptyMessage
          icon={<Clock />}
          title="No recent files"
          description={
            remember
              ? 'Files you open will appear here.'
              : 'Recent files are turned off in Settings.'
          }
        />
      ) : (
        /* Arrow keys move between the native buttons in the list. */
        /* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */
        <ul
          onKeyDown={onKeyDown}
          className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2 pt-2 pb-4"
        >
          {items.map((item, index) => (
            <RecentItem
              key={item.path}
              item={item}
              index={index}
              active={activePath !== null && samePath(activePath, item.path)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

const RecentItem = memo(function RecentItem({
  item,
  index,
  active,
}: {
  item: RecentFile;
  index: number;
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
          'focus-inset flex w-full min-w-0 items-start gap-1 py-[7px] pr-7 pl-2 text-left',
          'transition-colors duration-75',
          active ? 'mv-bar-left bg-accent-subtle' : 'hover:bg-bg-muted',
        )}
      >
        {/* The design numbers the list instead of repeating a file icon. */}
        <span
          aria-hidden
          className={clsx(
            'mv-num w-7 shrink-0 pt-px text-ui-xs',
            active ? 'text-accent' : 'text-fg-muted',
          )}
        >
          {String(index + 1).padStart(2, '0')}
        </span>
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
              <span className="mv-label shrink-0 border border-border px-1.5 text-[10px] text-fg-muted">
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
          'absolute top-1.5 right-1 flex size-5.5 items-center justify-center text-fg-subtle',
          'opacity-0 transition-opacity duration-100 group-hover:opacity-100 focus-visible:opacity-100',
          'hover:bg-bg-muted hover:text-fg',
        )}
      >
        <X aria-hidden className="size-3.5" />
      </button>
    </li>
  );
});
