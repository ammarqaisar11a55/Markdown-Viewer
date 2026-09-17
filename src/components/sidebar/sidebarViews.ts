import { Clock, FolderTree, ListTree } from 'lucide-react';
import type { SidebarView } from '@/types';

export const SIDEBAR_VIEWS: readonly { value: SidebarView; label: string; icon: typeof Clock }[] = [
  { value: 'outline', label: 'Outline', icon: ListTree },
  { value: 'files', label: 'Files', icon: FolderTree },
  { value: 'recent', label: 'Recent', icon: Clock },
];

export const sidebarTabId = (view: SidebarView) => `sidebar-tab-${view}`;
export const sidebarPanelId = (view: SidebarView) => `sidebar-panel-${view}`;
