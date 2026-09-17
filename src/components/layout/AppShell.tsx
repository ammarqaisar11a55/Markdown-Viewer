import { useEffect, useRef } from 'react';
import { useUi } from '@/stores/uiStore';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { TabBar } from '@/components/tabs/TabBar';
import { DropOverlay } from './DropOverlay';
import { MainArea } from './MainArea';
import { ReadingModeExit } from './ReadingModeExit';
import { StatusBar } from './StatusBar';
import { useIsNarrow } from './useIsNarrow';

const TEXT_INPUT = 'input, textarea, [contenteditable="true"]';

/** Suppresses the webview's default context menu except inside text inputs. */
function suppressNativeMenu(event: MouseEvent): void {
  if (event.defaultPrevented) return;
  const target = event.target;
  if (target instanceof Element && target.closest(TEXT_INPUT)) return;
  event.preventDefault();
}

export function AppShell() {
  const readingMode = useUi((s) => s.readingMode);
  const narrow = useIsNarrow();
  const setSidebarCollapsed = useUi((s) => s.setSidebarCollapsed);
  const autoCollapsedRef = useRef(false);

  // Covers portaled overlays (dialogs, toasts) as well as the shell itself.
  useEffect(() => {
    window.addEventListener('contextmenu', suppressNativeMenu);
    return () => {
      window.removeEventListener('contextmenu', suppressNativeMenu);
    };
  }, []);

  // Collapse the sidebar when the window becomes narrow (it then opens as an
  // overlay) and bring it back when the window widens again.
  useEffect(() => {
    const { sidebarCollapsed } = useUi.getState();
    if (narrow && !sidebarCollapsed) {
      autoCollapsedRef.current = true;
      setSidebarCollapsed(true);
    } else if (!narrow && autoCollapsedRef.current) {
      autoCollapsedRef.current = false;
      if (sidebarCollapsed) setSidebarCollapsed(false);
    }
  }, [narrow, setSidebarCollapsed]);

  return (
    <div className="bg-bg text-fg flex h-full w-full overflow-hidden">
      {!readingMode && <Sidebar />}
      <div className="flex min-w-0 flex-1 flex-col">
        {!readingMode && <TabBar />}
        <MainArea />
        {!readingMode && <StatusBar />}
      </div>
      {readingMode && <ReadingModeExit />}
      <DropOverlay />
    </div>
  );
}
