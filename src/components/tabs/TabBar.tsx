import { BookOpen, PanelLeftOpen, Pencil, Search } from 'lucide-react';
import { useCallback, useEffect, useRef, type KeyboardEvent } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { getShortcutLabel, runCommand } from '@/app/commands';
import { activateTab, closeTab } from '@/features/documents/actions';
import { useDocuments } from '@/stores/documentsStore';
import { useUi } from '@/stores/uiStore';
import { IconButton } from '@/components/ui/IconButton';
import { Kbd } from '@/components/ui/Kbd';
import { TabItem } from './TabItem';
import { findByData } from '@/components/ui/dom';

export function TabBar() {
  const tabIds = useDocuments(useShallow((s) => s.tabs.map((t) => t.id)));
  const activeId = useDocuments((s) => s.activeId);
  const editing = useDocuments((s) => s.tabs.find((t) => t.id === s.activeId)?.editing ?? false);
  const canEdit = useDocuments((s) => {
    const tab = s.tabs.find((t) => t.id === s.activeId);
    return tab?.status === 'ready' && tab.doc !== null;
  });
  const sidebarCollapsed = useUi((s) => s.sidebarCollapsed);
  const searchOpen = useUi((s) => s.searchOpen);
  const setSearchOpen = useUi((s) => s.setSearchOpen);
  const hasActive = activeId !== null;
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Keep the active tab visible.
  useEffect(() => {
    if (activeId === null) return;
    const el = findByData(scrollerRef.current, 'tab-id', activeId);
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeId, tabIds.length]);

  // Vertical wheel scrolls the strip horizontally.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      if (scroller.scrollWidth <= scroller.clientWidth) return;
      event.preventDefault();
      scroller.scrollLeft += event.deltaY;
    };
    scroller.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      scroller.removeEventListener('wheel', onWheel);
    };
  }, []);

  const onTabKeyDown = useCallback((id: string, event: KeyboardEvent<HTMLElement>) => {
    const ids = useDocuments.getState().tabs.map((t) => t.id);
    const index = ids.indexOf(id);
    let target: string | undefined;
    switch (event.key) {
      case 'ArrowRight':
        target = ids[(index + 1) % ids.length];
        break;
      case 'ArrowLeft':
        target = ids[(index - 1 + ids.length) % ids.length];
        break;
      case 'Home':
        target = ids[0];
        break;
      case 'End':
        target = ids.at(-1);
        break;
      case 'Delete':
        event.preventDefault();
        void closeTab(id);
        requestAnimationFrame(() => {
          scrollerRef.current?.querySelector<HTMLElement>('[role="tab"][tabindex="0"]')?.focus();
        });
        return;
      case 'Enter':
      case ' ':
        event.preventDefault();
        activateTab(id);
        return;
      default:
        return;
    }
    event.preventDefault();
    if (target === undefined) return;
    activateTab(target);
    findByData(scrollerRef.current, 'tab-id', target)?.focus();
  }, []);

  const quickOpenShortcut = getShortcutLabel('file.quickOpen');

  return (
    <div className="theme-surface flex h-[44px] shrink-0 items-stretch border-b border-border bg-bg-subtle">
      {sidebarCollapsed && (
        <div className="flex shrink-0 items-center border-r border-border px-2">
          <IconButton
            label="Show sidebar"
            shortcut={getShortcutLabel('view.toggleSidebar')}
            icon={<PanelLeftOpen />}
            onClick={() => void runCommand('view.toggleSidebar')}
          />
        </div>
      )}
      <div
        ref={scrollerRef}
        role="tablist"
        aria-label="Open documents"
        className="flex min-w-0 flex-1 scrollbar-none items-stretch overflow-x-auto overflow-y-hidden"
      >
        {tabIds.map((id) => (
          <TabItem key={id} id={id} active={id === activeId} onKeyDown={onTabKeyDown} />
        ))}
      </div>
      <div className="flex shrink-0 items-center gap-0.5 border-l border-border px-2">
        <IconButton
          label="Find in document"
          shortcut={getShortcutLabel('view.find')}
          icon={<Search />}
          active={searchOpen}
          disabled={!hasActive}
          onClick={() => {
            if (searchOpen) setSearchOpen(false);
            else void runCommand('view.find');
          }}
        />
        <IconButton
          label={editing ? 'Stop editing' : 'Edit document'}
          shortcut={getShortcutLabel('edit.toggle')}
          icon={<Pencil />}
          active={editing}
          disabled={!canEdit}
          onClick={() => void runCommand('edit.toggle')}
        />
        <IconButton
          label="Reading mode"
          shortcut={getShortcutLabel('view.readingMode')}
          icon={<BookOpen />}
          disabled={!hasActive}
          onClick={() => void runCommand('view.readingMode')}
        />
      </div>
      <div className="flex shrink-0 items-center border-l border-border px-2.5">
        <button
          type="button"
          onClick={() => void runCommand('file.quickOpen')}
          className="flex h-[30px] w-[230px] items-center gap-2 border border-border bg-bg py-0 pr-1.5 pl-2.5 text-left text-ui text-fg-muted hover:border-border-strong"
        >
          <Search aria-hidden className="size-3.5 shrink-0" />
          <span className="flex-1 truncate">Quick Open</span>
          {quickOpenShortcut !== undefined && <Kbd shortcut={quickOpenShortcut} />}
        </button>
      </div>
    </div>
  );
}
