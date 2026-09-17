import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetSettings, updateSettings, useSettings } from '@/stores/settingsStore';
import { useUi } from '@/stores/uiStore';
import { SettingsDialog } from './SettingsDialog';

vi.mock('@/stores/settingsStore', async () => {
  const { create } = await import('zustand');
  const defaults = {
    theme: 'system',
    fontSize: 16,
    contentWidth: 'medium',
    codeFontSize: 14,
    readingFont: 'sans',
    restoreSession: true,
    openInNewTab: true,
    autoReload: false,
    rememberRecent: true,
    showAllFiles: false,
    syntaxHighlighting: true,
    lineNumbers: false,
    renderHtml: true,
    externalLinks: 'open',
    loadRemoteImages: true,
  };
  const useSettings = create(() => ({ ...defaults }));
  return {
    useSettings,
    DEFAULT_SETTINGS: defaults,
    FONT_SIZE_RANGE: { min: 14, max: 24, step: 1 },
    CODE_FONT_SIZE_RANGE: { min: 11, max: 20, step: 1 },
    updateSettings: vi.fn((partial: object) => {
      useSettings.setState(partial);
    }),
    resetSettings: vi.fn(),
  };
});

describe('SettingsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUi.setState({ settingsOpen: true, shortcutsOpen: false });
  });

  it('is hidden while closed', () => {
    useUi.setState({ settingsOpen: false });
    render(<SettingsDialog />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the three sections', () => {
    render(<SettingsDialog />);
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
    for (const name of ['Appearance', 'Behavior', 'Markdown']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    }
  });

  it('switches the theme', async () => {
    const user = userEvent.setup();
    render(<SettingsDialog />);
    const group = screen.getByRole('radiogroup', { name: 'Theme' });
    expect(screen.getByRole('radio', { name: 'System' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(updateSettings).toHaveBeenCalledWith({ theme: 'dark' });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
  });

  it('changes font sizes with sliders', () => {
    render(<SettingsDialog />);
    const fontSize = screen.getByRole('slider', { name: 'Font size' });
    expect(fontSize).toHaveAttribute('aria-valuetext', '16 px');
    fireEvent.change(fontSize, { target: { value: '20' } });
    expect(updateSettings).toHaveBeenCalledWith({ fontSize: 20 });
    expect(fontSize).toHaveAttribute('aria-valuetext', '20 px');

    fireEvent.change(screen.getByRole('slider', { name: 'Code font size' }), {
      target: { value: '12' },
    });
    expect(updateSettings).toHaveBeenCalledWith({ codeFontSize: 12 });
  });

  it('toggles boolean settings', async () => {
    const user = userEvent.setup();
    render(<SettingsDialog />);
    const autoReload = screen.getByRole('switch', { name: 'Automatically reload changed files' });
    expect(autoReload).not.toBeChecked();
    await user.click(autoReload);
    expect(updateSettings).toHaveBeenCalledWith({ autoReload: true });
    expect(autoReload).toBeChecked();

    await user.click(screen.getByRole('switch', { name: 'Syntax highlighting' }));
    expect(updateSettings).toHaveBeenCalledWith({ syntaxHighlighting: false });
    await user.click(screen.getByRole('switch', { name: 'Render raw HTML' }));
    expect(updateSettings).toHaveBeenCalledWith({ renderHtml: false });
    expect(useSettings.getState().renderHtml).toBe(false);
  });

  it('changes content width, reading font and link behavior', async () => {
    const user = userEvent.setup();
    render(<SettingsDialog />);
    await user.click(screen.getByRole('radio', { name: 'Wide' }));
    expect(updateSettings).toHaveBeenCalledWith({ contentWidth: 'wide' });
    await user.click(screen.getByRole('radio', { name: 'Serif' }));
    expect(updateSettings).toHaveBeenCalledWith({ readingFont: 'serif' });
    await user.click(screen.getByRole('radio', { name: 'Ask first' }));
    expect(updateSettings).toHaveBeenCalledWith({ externalLinks: 'ask' });
  });

  it('resets to defaults and closes with Done', async () => {
    const user = userEvent.setup();
    render(<SettingsDialog />);
    await user.click(screen.getByRole('button', { name: 'Reset to Defaults' }));
    expect(resetSettings).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(useUi.getState().settingsOpen).toBe(false);
  });

  it('opens the keyboard shortcuts', async () => {
    const user = userEvent.setup();
    render(<SettingsDialog />);
    await user.click(screen.getByRole('button', { name: 'Keyboard Shortcuts' }));
    expect(useUi.getState().settingsOpen).toBe(false);
    expect(useUi.getState().shortcutsOpen).toBe(true);
  });
});
