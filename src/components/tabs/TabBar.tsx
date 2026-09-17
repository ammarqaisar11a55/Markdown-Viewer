import { BookOpen, PanelLeftOpen, Search, Settings } from 'lucide-react';
import { useCallback, useEffect, useRef, type KeyboardEvent } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { getShortcutLabel, runCommand } from '@/app/commands';
import { activateTab, closeTab } from '@/features/documents/actions';
import { useDocuments } from '@/stores/documentsStore';
import { useUi } from '@/stores/uiStore';
import { IconButton } from '@/components/ui/IconButton';
import { TabItem } from './TabItem';
import { findByData } from '@/components/ui/dom';

export function TabBar() {
  const tabIds = useDocuments(useShallow((s) => s.tabs.map((t) => t.id)));
  const activeId = useDocuments((s) => s.activeId);
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
        closeTab(id);
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

  return (
    <div className="theme-surface border-border bg-bg-subtle flex h-9 shrink-0 items-stretch border-b">
      {sidebarCollapsed && (
        <div className="border-border flex shrink-0 items-center border-r px-1.5">
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
      <div className="flex shrink-0 items-center gap-0.5 px-1.5">
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
          label="Reading mode"
          shortcut={getShortcutLabel('view.readingMode')}
          icon={<BookOpen />}
          disabled={!hasActive}
          onClick={() => void runCommand('view.readingMode')}
        />
        <IconButton
          label="Settings"
          shortcut={getShortcutLabel('app.settings')}
          icon={<Settings />}
          onClick={() => void runCommand('app.settings')}
        />
      </div>
    </div>
  );
}
