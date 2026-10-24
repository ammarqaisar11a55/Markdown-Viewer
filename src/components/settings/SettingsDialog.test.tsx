import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetSettings, updateSettings, useSettings } from '@/stores/settingsStore';
import { useUi } from '@/stores/uiStore';
import { INITIAL_UPDATES_STATE, useUpdates } from '@/stores/updatesStore';
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
    autoCheckUpdates: true,
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

/** The dialog shows one section at a time; open the one under test. */
async function openSection(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('tab', { name }));
  return screen.getByRole('tabpanel', { name });
}

describe('SettingsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUi.setState({ settingsOpen: true, shortcutsOpen: false });
    useUpdates.setState({ ...INITIAL_UPDATES_STATE });
  });

  it('is hidden while closed', () => {
    useUi.setState({ settingsOpen: false });
    render(<SettingsDialog />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('lists the numbered sections and shows one pane at a time', async () => {
    const user = userEvent.setup();
    render(<SettingsDialog />);
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();

    const nav = screen.getByRole('tablist', { name: 'Settings sections' });
    const tabs = within(nav).getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      '01Appearance',
      '02Behavior',
      '03Markdown',
      '04Updates',
    ]);

    // Appearance opens first; its rows are on screen, the others are not.
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Appearance' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeInTheDocument();
    expect(
      screen.queryByRole('switch', { name: 'Restore previous session' }),
    ).not.toBeInTheDocument();

    const behavior = await openSection(user, 'Behavior');
    expect(
      within(behavior).getByRole('switch', { name: 'Restore previous session' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: 'Theme' })).not.toBeInTheDocument();

    for (const name of ['Markdown', 'Updates']) {
      const panel = await openSection(user, name);
      expect(within(panel).getByRole('heading', { name })).toBeInTheDocument();
    }
  });

  it('moves between sections with the arrow keys', async () => {
    const user = userEvent.setup();
    render(<SettingsDialog />);
    const appearance = screen.getByRole('tab', { name: 'Appearance' });
    appearance.focus();

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('tab', { name: 'Behavior' })).toHaveFocus();
    expect(screen.getByRole('tabpanel', { name: 'Behavior' })).toBeInTheDocument();

    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Updates' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(appearance).toHaveFocus();
    expect(appearance).toHaveAttribute('aria-selected', 'true');
  });

  it('offers a manual update check and the automatic-check switch', async () => {
    const user = userEvent.setup();
    render(<SettingsDialog />);
    const section = await openSection(user, 'Updates');
    expect(within(section).getByText('Not checked yet.')).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Check for Updates' })).toBeEnabled();

    const auto = within(section).getByRole('switch', {
      name: 'Check for updates automatically',
    });
    expect(auto).toBeChecked();
    await user.click(auto);
    expect(updateSettings).toHaveBeenCalledWith({ autoCheckUpdates: false });
    expect(auto).not.toBeChecked();
  });

  it('opens on Updates and shows the release notes while an update waits', () => {
    useUpdates.setState({
      status: 'available',
      version: '1.5.0',
      notes: '### Added\n- A new `thing`\n- **Faster** search\n\nThanks for reading.',
    });
    render(<SettingsDialog />);

    const panel = screen.getByRole('tabpanel', { name: 'Updates' });
    expect(screen.getByRole('tab', { name: 'Updates' })).toHaveAttribute('aria-selected', 'true');

    const notes = within(panel).getByRole('group', { name: 'What’s new in 1.5.0' });
    expect(within(notes).getByRole('heading', { name: 'Added' })).toBeInTheDocument();
    const items = within(notes).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(['A new thing', 'Faster search']);
    expect(within(items[0]!).getByText('thing').tagName).toBe('CODE');
    expect(within(notes).getByText('Thanks for reading.')).toBeInTheDocument();
    expect(notes).toHaveAttribute('tabindex', '0');

    expect(within(panel).getByRole('button', { name: 'Install Update' })).toBeEnabled();
  });

  it('shows no notes box when the update brought none', () => {
    useUpdates.setState({ status: 'available', version: '1.5.0', notes: null });
    render(<SettingsDialog />);
    const panel = screen.getByRole('tabpanel', { name: 'Updates' });
    expect(within(panel).getByText('Version 1.5.0 is available.')).toBeInTheDocument();
    expect(within(panel).queryByRole('group')).not.toBeInTheDocument();
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
    await openSection(user, 'Behavior');
    const autoReload = screen.getByRole('switch', { name: 'Automatically reload changed files' });
    expect(autoReload).not.toBeChecked();
    await user.click(autoReload);
    expect(updateSettings).toHaveBeenCalledWith({ autoReload: true });
    expect(autoReload).toBeChecked();

    await openSection(user, 'Markdown');
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

    await openSection(user, 'Markdown');
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
