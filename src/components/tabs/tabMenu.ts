import { getShortcutLabel } from '@/app/commands';
import { closeAllTabs, closeOtherTabs, closeTab } from '@/features/documents/actions';
import type { ContextMenuItem } from '@/stores/contextMenuStore';
import { copyPathAction, revealAction } from '@/components/sidebar/entryMenu';

type Shortcut = { shortcut: string } | Record<string, never>;

function shortcutOf(id: Parameters<typeof getShortcutLabel>[0]): Shortcut {
  const label = getShortcutLabel(id);
  return label === undefined ? {} : { shortcut: label };
}

export function tabMenuItems(tabId: string, path: string, tabCount: number): ContextMenuItem[] {
  return [
    { id: 'close', label: 'Close', ...shortcutOf('tab.close'), onSelect: () => closeTab(tabId) },
    {
      id: 'close-others',
      label: 'Close Others',
      disabled: tabCount < 2,
      onSelect: () => closeOtherTabs(tabId),
    },
    {
      id: 'close-all',
      label: 'Close All',
      ...shortcutOf('tab.closeAll'),
      onSelect: closeAllTabs,
    },
    { type: 'separator' },
    { id: 'copy-path', label: 'Copy File Path', onSelect: () => copyPathAction(path) },
    { id: 'reveal', label: 'Reveal in Folder', onSelect: () => revealAction(path) },
  ];
}
