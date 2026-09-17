import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useUi } from '@/stores/uiStore';
import { AboutDialog } from './AboutDialog';
import { ShortcutsDialog } from './ShortcutsDialog';

vi.mock('@/app/commands', () => ({
  commands: {
    'file.open': { id: 'file.open', label: 'Open File…', shortcuts: ['Mod+O'], category: 'File' },
    'file.reload': {
      id: 'file.reload',
      label: 'Reload',
      shortcuts: ['Mod+R', 'F5'],
      category: 'File',
    },
    'app.about': { id: 'app.about', label: 'About', shortcuts: [], category: 'App' },
    'view.zoomIn': {
      id: 'view.zoomIn',
      label: 'Zoom In',
      shortcuts: ['Mod+=', 'Mod++'],
      category: 'View',
    },
  },
}));

vi.mock('@/lib/shortcuts', () => ({
  formatShortcut: (value: string) => value.replace('Mod', 'Ctrl'),
}));

describe('ShortcutsDialog', () => {
  beforeEach(() => {
    useUi.setState({ shortcutsOpen: true });
  });

  it('lists command shortcuts grouped by category', () => {
    render(<ShortcutsDialog />);
    const dialog = screen.getByRole('dialog', { name: 'Keyboard Shortcuts' });
    expect(within(dialog).getByRole('heading', { name: 'Files' })).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'View' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('heading', { name: 'Application' })).not.toBeInTheDocument();
    expect(within(dialog).getByText('Open File')).toBeInTheDocument();
    const reload = within(dialog).getByText('Reload').parentElement!;
    expect(reload).toHaveTextContent('CtrlRorF5');
    expect(within(dialog).getByText('Next match')).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    render(<ShortcutsDialog />);
    await user.keyboard('{Escape}');
    expect(useUi.getState().shortcutsOpen).toBe(false);
  });
});

describe('AboutDialog', () => {
  it('shows the app details and closes', async () => {
    const user = userEvent.setup();
    useUi.setState({ aboutOpen: true });
    render(<AboutDialog />);
    const dialog = screen.getByRole('dialog', { name: 'About Markdown Viewer' });
    expect(dialog).toHaveTextContent('Development build');
    expect(dialog).toHaveTextContent('MIT License');
    expect(within(dialog).getByRole('list', { name: 'Built with' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(useUi.getState().aboutOpen).toBe(false);
  });
});
