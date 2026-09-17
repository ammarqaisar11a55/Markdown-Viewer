import { clsx } from 'clsx';
import { useEffect } from 'react';
import { useUi } from '@/stores/uiStore';
import { useIsNarrow } from '@/components/layout/useIsNarrow';
import { FileTreePanel } from './FileTreePanel';
import { OutlinePanel } from './OutlinePanel';
import { RecentPanel } from './RecentPanel';
import { ResizeHandle } from './ResizeHandle';
import { SidebarHeader } from './SidebarHeader';
import { SidebarViewSwitcher } from './SidebarViewSwitcher';
import { sidebarPanelId, sidebarTabId } from './sidebarViews';

const SIDEBAR_ID = 'app-sidebar';

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

  if (collapsed) return null;

  const aside = (
    <aside
      id={SIDEBAR_ID}
      aria-label="Sidebar"
      style={{ width }}
      className={clsx(
        'theme-surface flex h-full shrink-0 flex-col border-r border-border bg-bg-subtle',
        narrow
          ? 'animate-fade-in fixed inset-y-0 left-0 z-40 max-w-[85vw] shadow-(--shadow-modal)'
          : 'relative',
      )}
    >
      <SidebarHeader />
      <SidebarViewSwitcher />
      <div
        id={sidebarPanelId(view)}
        role="tabpanel"
        aria-labelledby={sidebarTabId(view)}
        className="mt-2 min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
      >
        {view === 'outline' && <OutlinePanel />}
        {view === 'files' && <FileTreePanel />}
        {view === 'recent' && <RecentPanel />}
      </div>
      <ResizeHandle controls={SIDEBAR_ID} />
    </aside>
  );

  if (!narrow) return aside;

  return (
    <>
      <div
        role="presentation"
        className="animate-fade-in fixed inset-0 z-30 bg-scrim"
        onMouseDown={() => {
          setSidebarCollapsed(true);
        }}
      />
      {aside}
    </>
  );
}
