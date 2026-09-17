import { clsx } from 'clsx';
import { X } from 'lucide-react';
import { memo, type KeyboardEvent, type MouseEvent } from 'react';
import { activateTab, closeTab } from '@/features/documents/actions';
import { displayPath } from '@/lib/paths';
import { openContextMenu } from '@/stores/contextMenuStore';
import { useDocuments, type DocumentsState } from '@/stores/documentsStore';
import { Spinner } from '@/components/ui/Spinner';
import { Tooltip } from '@/components/ui/Tooltip';
import { DOCUMENT_PANEL_ID } from '@/components/layout/ids';
import { tabMenuItems } from './tabMenu';

const findTab = (s: DocumentsState, id: string) => s.tabs.find((t) => t.id === id);

export interface TabItemProps {
  id: string;
  active: boolean;
  onKeyDown: (id: string, event: KeyboardEvent<HTMLElement>) => void;
}

export const TabItem = memo(function TabItem({ id, active, onKeyDown }: TabItemProps) {
  const name = useDocuments((s) => findTab(s, id)?.name ?? '');
  const path = useDocuments((s) => findTab(s, id)?.path ?? '');
  const status = useDocuments((s) => findTab(s, id)?.status ?? 'ready');
  const changed = useDocuments((s) => (findTab(s, id)?.externalChange ?? null) !== null);

  const onContextMenu = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    openContextMenu(
      event.clientX,
      event.clientY,
      tabMenuItems(id, path, useDocuments.getState().tabs.length),
    );
  };

  return (
    <Tooltip label={displayPath(path)} className="h-full shrink-0">
      <div
        id={`tab-${id}`}
        role="tab"
        data-tab-id={id}
        aria-selected={active}
        aria-controls={active ? DOCUMENT_PANEL_ID : undefined}
        tabIndex={active ? 0 : -1}
        onClick={() => {
          activateTab(id);
        }}
        onMouseDown={(event) => {
          // Prevent middle-click autoscroll.
          if (event.button === 1) event.preventDefault();
        }}
        onAuxClick={(event) => {
          if (event.button === 1) {
            event.preventDefault();
            closeTab(id);
          }
        }}
        onKeyDown={(event) => {
          onKeyDown(id, event);
        }}
        onContextMenu={onContextMenu}
        className={clsx(
          'focus-inset group relative flex h-full max-w-[220px] min-w-[112px] items-center gap-1.5 border-r border-border pr-1.5 pl-3',
          'text-ui transition-colors duration-100',
          active
            ? 'bg-bg text-fg'
            : 'bg-transparent text-fg-muted hover:bg-bg-muted/60 hover:text-fg',
        )}
      >
        {active && <span aria-hidden className="absolute inset-x-0 top-0 h-[2px] bg-accent" />}
        {active && <span aria-hidden className="absolute inset-x-0 -bottom-px h-px bg-bg" />}
        {status === 'loading' && <Spinner className="size-3" />}
        <span className={clsx('min-w-0 flex-1 truncate', status === 'error' && 'text-danger')}>
          {name}
        </span>
        {changed && <span className="sr-only">(changed on disk)</span>}
        <span className="relative flex size-5 shrink-0 items-center justify-center">
          {changed && (
            <span aria-hidden className="size-2 rounded-full bg-warning group-hover:opacity-0" />
          )}
          <button
            type="button"
            tabIndex={-1}
            aria-label={`Close ${name}`}
            onClick={(event) => {
              event.stopPropagation();
              closeTab(id);
            }}
            className={clsx(
              'absolute inset-0 flex items-center justify-center rounded-sm text-fg-subtle',
              'transition-colors duration-100 hover:bg-bg-muted hover:text-fg',
              active || changed
                ? ''
                : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100',
              changed && 'opacity-0 group-hover:opacity-100',
            )}
          >
            <X aria-hidden className="size-3.5" />
          </button>
        </span>
      </div>
    </Tooltip>
  );
});
