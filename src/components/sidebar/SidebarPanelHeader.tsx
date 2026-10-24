import type { ReactNode } from 'react';

export interface SidebarPanelHeaderProps {
  /** The view's name, shown as a spec-sheet label. */
  title: string;
  /** The view's actions, aligned to the right. */
  children?: ReactNode;
}

/** The 44px header at the top of a sidebar panel: view name, then its actions. */
export function SidebarPanelHeader({ title, children }: SidebarPanelHeaderProps) {
  return (
    <div className="flex h-11 shrink-0 items-center gap-0.5 border-b border-border pr-2 pl-4">
      <h2 className="mv-label min-w-0 flex-1 truncate text-ui-sm text-fg-muted">{title}</h2>
      {children}
    </div>
  );
}
