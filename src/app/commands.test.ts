import { useDocuments } from '@/stores/documentsStore';
import { useSettings } from '@/stores/settingsStore';
import { useToasts } from '@/stores/toastStore';
import { useUi } from '@/stores/uiStore';
import { makeDoc, mockBackend, resetAppState } from '@/test/state';
import { openDocument } from '@/features/documents/actions';
import {
  commands,
  DEDUPE_WINDOW_MS,
  getShortcutLabel,
  isCommandEnabled,
  isCommandId,
  runCommand,
} from './commands';

beforeEach(() => {
  resetAppState();
  vi.useFakeTimers({ toFake: ['performance'] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('command registry', () => {
  it('is keyed by id with Title Case labels', () => {
    for (const [id, command] of Object.entries(commands)) {
      expect(command.id).toBe(id);
      expect(command.label.charAt(0)).toBe(command.label.charAt(0).toUpperCase());
    }
    expect(commands['file.open'].label).toBe('Open File…');
    expect(commands['app.about'].label).toBe('About Markdown Viewer');
  });

  it('has no conflicting shortcuts', () => {
    const all = Object.values(commands).flatMap((c) => c.shortcuts);
    expect(new Set(all).size).toBe(all.length);
  });

  it('validates ids', () => {
    expect(isCommandId('view.zoomIn')).toBe(true);
    expect(isCommandId('toString')).toBe(false);
    expect(isCommandId(42)).toBe(false);
  });

  it('formats shortcut labels', () => {
    expect(getShortcutLabel('file.openFolder')).toMatch(/^(Ctrl\+Shift\+O|⇧⌘O)$/);
    expect(getShortcutLabel('app.about')).toBeUndefined();
  });
});

describe('runCommand', () => {
  it('dedupes the same command within the window', async () => {
    await runCommand('view.zoomIn');
    await runCommand('view.zoomIn');
    expect(useUi.getState().zoom).toBe(1.1);
    vi.advanceTimersByTime(DEDUPE_WINDOW_MS + 1);
    await runCommand('view.zoomIn');
    expect(useUi.getState().zoom).toBe(1.2);
  });

  it('does not dedupe different commands', async () => {
    await runCommand('view.zoomIn');
    await runCommand('view.toggleSidebar');
    expect(useUi.getState()).toMatchObject({ zoom: 1.1, sidebarCollapsed: true });
  });

  it('skips disabled commands', async () => {
    expect(isCommandEnabled('view.find')).toBe(false);
    await runCommand('view.find');
    expect(useUi.getState().searchOpen).toBe(false);

    mockBackend({ open_document: ({ path }) => makeDoc(path as string) });
    await openDocument('/a.md');
    await runCommand('view.find');
    expect(useUi.getState().searchOpen).toBe(true);
  });

  it('toggles the theme based on the resolved theme', async () => {
    useSettings.setState({ theme: 'system' });
    await runCommand('view.toggleTheme');
    expect(useSettings.getState().theme).toBe('dark');
    vi.advanceTimersByTime(DEDUPE_WINDOW_MS + 1);
    await runCommand('view.toggleTheme');
    expect(useSettings.getState().theme).toBe('light');
  });

  it('closes the active tab and reopens it', async () => {
    mockBackend({ open_document: ({ path }) => makeDoc(path as string) });
    await openDocument('/a.md');
    await runCommand('tab.close');
    expect(useDocuments.getState().tabs).toEqual([]);
    await runCommand('tab.reopenClosed');
    expect(useDocuments.getState().tabs[0]?.path).toBe('/a.md');
  });

  it('turns failures into a friendly toast', async () => {
    const original = commands['app.settings'].run;
    commands['app.settings'].run = () => {
      throw new Error('kaboom');
    };
    try {
      await runCommand('app.settings');
    } finally {
      commands['app.settings'].run = original;
    }
    expect(useToasts.getState().toasts).toEqual([
      expect.objectContaining({ variant: 'error', title: 'Something went wrong.' }),
    ]);
  });
});
