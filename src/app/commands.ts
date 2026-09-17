// Central command registry shared by the native menu, keyboard shortcuts,
// the command UI and the shortcuts dialog.
import {
  activateNextTab,
  activatePreviousTab,
  closeAllTabs,
  closeOtherTabs,
  closeTab,
  openFileDialog,
  reloadDocument,
  reopenClosedTab,
} from '@/features/documents/actions';
import { closeFolder, openFolderDialog } from '@/features/folder/actions';
import { toAppError } from '@/lib/errors';
import { logger } from '@/lib/platform/logger';
import { resolveTheme } from '@/lib/platform/theme';
import { quitApp, toggleFullscreen } from '@/lib/platform/system';
import { formatShortcut } from '@/lib/shortcuts';
import { getActiveTab, useDocuments } from '@/stores/documentsStore';
import { useFolder } from '@/stores/folderStore';
import { useSettings } from '@/stores/settingsStore';
import { toast } from '@/stores/toastStore';
import { useUi } from '@/stores/uiStore';

export type CommandId =
  | 'file.open'
  | 'file.openFolder'
  | 'file.quickOpen'
  | 'file.reload'
  | 'file.closeFolder'
  | 'tab.close'
  | 'tab.closeOthers'
  | 'tab.closeAll'
  | 'tab.reopenClosed'
  | 'tab.next'
  | 'tab.previous'
  | 'view.toggleSidebar'
  | 'view.readingMode'
  | 'view.toggleTheme'
  | 'view.zoomIn'
  | 'view.zoomOut'
  | 'view.zoomReset'
  | 'view.find'
  | 'view.fullscreen'
  | 'app.settings'
  | 'app.shortcuts'
  | 'app.about'
  | 'app.quit';

export type CommandCategory = 'File' | 'Tabs' | 'View' | 'App';

export interface Command {
  id: CommandId;
  label: string;
  shortcuts: string[];
  category: CommandCategory;
  run: () => void | Promise<void>;
  enabled?: () => boolean;
  /** Keep running while the key is held down. */
  repeatable?: boolean;
}

export const DEDUPE_WINDOW_MS = 150;

const ui = () => useUi.getState();
const hasTabs = () => useDocuments.getState().tabs.length > 0;
const hasActiveTab = () => getActiveTab() !== null;

function withActiveTab(action: (id: string) => void | Promise<void>) {
  return () => {
    const tab = getActiveTab();
    return tab === null ? undefined : action(tab.id);
  };
}

export const commands: Record<CommandId, Command> = {
  'file.open': {
    id: 'file.open',
    label: 'Open File…',
    shortcuts: ['Mod+O'],
    category: 'File',
    run: openFileDialog,
  },
  'file.openFolder': {
    id: 'file.openFolder',
    label: 'Open Folder…',
    shortcuts: ['Mod+Shift+O'],
    category: 'File',
    run: openFolderDialog,
  },
  'file.quickOpen': {
    id: 'file.quickOpen',
    label: 'Quick Open…',
    shortcuts: ['Mod+P'],
    category: 'File',
    run: () => ui().setQuickOpenOpen(true),
  },
  'file.reload': {
    id: 'file.reload',
    label: 'Reload',
    shortcuts: ['Mod+R', 'F5'],
    category: 'File',
    run: withActiveTab((id) => reloadDocument(id, { preserveScroll: true })),
    enabled: hasActiveTab,
  },
  'file.closeFolder': {
    id: 'file.closeFolder',
    label: 'Close Folder',
    shortcuts: [],
    category: 'File',
    run: closeFolder,
    enabled: () => useFolder.getState().rootPath !== null,
  },
  'tab.close': {
    id: 'tab.close',
    label: 'Close Tab',
    shortcuts: ['Mod+W'],
    category: 'Tabs',
    run: withActiveTab(closeTab),
    enabled: hasActiveTab,
  },
  'tab.closeOthers': {
    id: 'tab.closeOthers',
    label: 'Close Other Tabs',
    shortcuts: [],
    category: 'Tabs',
    run: withActiveTab(closeOtherTabs),
    enabled: () => hasActiveTab() && useDocuments.getState().tabs.length > 1,
  },
  'tab.closeAll': {
    id: 'tab.closeAll',
    label: 'Close All Tabs',
    shortcuts: ['Mod+Shift+W'],
    category: 'Tabs',
    run: closeAllTabs,
    enabled: hasTabs,
  },
  'tab.reopenClosed': {
    id: 'tab.reopenClosed',
    label: 'Reopen Closed Tab',
    shortcuts: ['Mod+Shift+T'],
    category: 'Tabs',
    run: reopenClosedTab,
    enabled: () => useDocuments.getState().closedPaths.length > 0,
  },
  'tab.next': {
    id: 'tab.next',
    label: 'Next Tab',
    shortcuts: ['Mod+Tab', 'Mod+PageDown'],
    category: 'Tabs',
    run: activateNextTab,
    enabled: () => useDocuments.getState().tabs.length > 1,
    repeatable: true,
  },
  'tab.previous': {
    id: 'tab.previous',
    label: 'Previous Tab',
    shortcuts: ['Mod+Shift+Tab', 'Mod+PageUp'],
    category: 'Tabs',
    run: activatePreviousTab,
    enabled: () => useDocuments.getState().tabs.length > 1,
    repeatable: true,
  },
  'view.toggleSidebar': {
    id: 'view.toggleSidebar',
    label: 'Toggle Sidebar',
    shortcuts: ['Mod+B'],
    category: 'View',
    run: () => ui().toggleSidebar(),
  },
  'view.readingMode': {
    id: 'view.readingMode',
    label: 'Reading Mode',
    shortcuts: ['Mod+Shift+R'],
    category: 'View',
    run: () => ui().toggleReadingMode(),
  },
  'view.toggleTheme': {
    id: 'view.toggleTheme',
    label: 'Toggle Theme',
    shortcuts: ['Mod+Shift+D'],
    category: 'View',
    run: () => {
      const { theme, updateSettings } = useSettings.getState();
      updateSettings({ theme: resolveTheme(theme) === 'dark' ? 'light' : 'dark' });
    },
  },
  'view.zoomIn': {
    id: 'view.zoomIn',
    label: 'Zoom In',
    shortcuts: ['Mod+=', 'Mod++'],
    category: 'View',
    run: () => ui().zoomIn(),
    repeatable: true,
  },
  'view.zoomOut': {
    id: 'view.zoomOut',
    label: 'Zoom Out',
    shortcuts: ['Mod+-'],
    category: 'View',
    run: () => ui().zoomOut(),
    repeatable: true,
  },
  'view.zoomReset': {
    id: 'view.zoomReset',
    label: 'Reset Zoom',
    shortcuts: ['Mod+0'],
    category: 'View',
    run: () => ui().resetZoom(),
  },
  'view.find': {
    id: 'view.find',
    label: 'Find in Document',
    shortcuts: ['Mod+F'],
    category: 'View',
    run: () => ui().setSearchOpen(true),
    enabled: () => getActiveTab()?.status === 'ready',
  },
  'view.fullscreen': {
    id: 'view.fullscreen',
    label: 'Toggle Fullscreen',
    shortcuts: ['F11'],
    category: 'View',
    run: async () => {
      ui().setFullscreen(await toggleFullscreen());
    },
  },
  'app.settings': {
    id: 'app.settings',
    label: 'Settings…',
    shortcuts: ['Mod+,'],
    category: 'App',
    run: () => ui().setSettingsOpen(true),
  },
  'app.shortcuts': {
    id: 'app.shortcuts',
    label: 'Keyboard Shortcuts',
    shortcuts: ['Mod+/'],
    category: 'App',
    run: () => ui().setShortcutsOpen(true),
  },
  'app.about': {
    id: 'app.about',
    label: 'About Markdown Viewer',
    shortcuts: [],
    category: 'App',
    run: () => ui().setAboutOpen(true),
  },
  'app.quit': {
    id: 'app.quit',
    label: 'Quit',
    shortcuts: ['Mod+Q'],
    category: 'App',
    run: quitApp,
  },
};

export function isCommandId(value: unknown): value is CommandId {
  return typeof value === 'string' && Object.hasOwn(commands, value);
}

const lastRun = new Map<CommandId, number>();

export function isCommandEnabled(id: CommandId): boolean {
  return commands[id].enabled?.() ?? true;
}

/** Runs a command once per dedupe window; failures become a friendly toast. */
export async function runCommand(id: CommandId): Promise<void> {
  const now = performance.now();
  const previous = lastRun.get(id);
  if (previous !== undefined && now - previous < DEDUPE_WINDOW_MS) return;
  if (!isCommandEnabled(id)) return;
  lastRun.set(id, now);
  try {
    await commands[id].run();
  } catch (err) {
    const error = toAppError(err);
    logger.error(`Command ${id} failed`, err);
    toast({ variant: 'error', title: error.title, description: error.description });
  }
}

export function getShortcutLabel(id: CommandId): string | undefined {
  const first = commands[id].shortcuts[0];
  return first === undefined ? undefined : formatShortcut(first);
}

/** Test helper: clears the dedupe history. */
export function resetCommandDedupeForTests(): void {
  lastRun.clear();
}
