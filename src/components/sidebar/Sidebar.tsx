import { clsx } from 'clsx';
import { useEffect } from 'react';
import { useUi } from '@/stores/uiStore';
import { useIsNarrow } from '@/components/layout/useIsNarrow';
import { FileTreePanel } from './FileTreePanel';
import { OutlinePanel } from './OutlinePanel';
import { RecentPanel } from './RecentPanel';
import { ResizeHandle } from './ResizeHandle';
import { SidebarRail } from './SidebarRail';

const SIDEBAR_ID = 'app-sidebar';

/**
 * The sidebar is two columns: a fixed icon rail and the panel for the live
 * view. Collapsing hides the panel only — the rail stays.
 */
export function Sidebar() {
  const collapsed = useUi((s) => s.sidebarCollapsed);
  const width = useUi((s) => s.sidebarWidth);
  const view = useUi((s) => s.sidebarView);
  const setSidebarCollapsed = useUi((s) => s.setSidebarCollapsed);
  const narrow = useIsNarrow();

  useEffect(() => {
    if (!narrow || collapsed) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) setSidebarCollapsed(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [narrow, collapsed, setSidebarCollapsed]);

  return (
    <>
      <SidebarRail />
      {!collapsed && narrow && (
        <div
          role="presentation"
          className="animate-fade-in fixed inset-y-0 right-0 left-[60px] z-30 bg-scrim"
          onMouseDown={() => {
            setSidebarCollapsed(true);
          }}
        />
      )}
      {!collapsed && (
        <aside
          id={SIDEBAR_ID}
          aria-label="Sidebar"
          style={{ width }}
          className={clsx(
            'theme-surface flex h-full min-h-0 shrink-0 flex-col border-r border-border bg-bg',
            narrow
              ? 'animate-fade-in fixed inset-y-0 left-[60px] z-40 max-w-[calc(85vw-60px)] shadow-(--shadow-modal)'
              : 'relative',
          )}
        >
          {view === 'outline' && <OutlinePanel />}
          {view === 'files' && <FileTreePanel />}
          {view === 'recent' && <RecentPanel />}
          <ResizeHandle controls={SIDEBAR_ID} />
        </aside>
      )}
    </>
  );
}
