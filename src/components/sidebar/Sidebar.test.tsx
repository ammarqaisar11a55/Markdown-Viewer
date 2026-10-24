import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useDocuments } from '@/stores/documentsStore';
import { SIDEBAR_WIDTH, useUi } from '@/stores/uiStore';
import { installDomStubs } from '@/components/ui/testing';
import { Sidebar } from './Sidebar';

vi.mock('@/app/commands', async () => {
  const { useUi: ui } = await import('@/stores/uiStore');
  return {
    getShortcutLabel: (id: string) =>
      ({ 'view.toggleSidebar': 'Ctrl+B', 'file.open': 'Ctrl+O', 'app.settings': 'Ctrl+,' })[id],
    runCommand: vi.fn((id: string) => {
      if (id === 'view.toggleSidebar') ui.getState().toggleSidebar();
      return Promise.resolve();
    }),
  };
});

const documentActions = vi.hoisted(() => ({
  openDocument: vi.fn(() => Promise.resolve()),
  openFileDialog: vi.fn(() => Promise.resolve()),
  createFileDialog: vi.fn(() => Promise.resolve()),
}));
vi.mock('@/features/documents/actions', () => documentActions);

const folderActions = vi.hoisted(() => ({
  openFolderDialog: vi.fn(() => Promise.resolve()),
  refreshFolder: vi.fn(() => Promise.resolve()),
  closeFolder: vi.fn(),
}));
vi.mock('@/features/folder/actions', async () => ({
  ...(await import('@/stores/folderStore')),
  ...folderActions,
}));

vi.mock('@/stores/viewerStore', async () => {
  const { create } = await import('zustand');
  return {
    useViewer: create(() => ({ headings: [], activeHeadingId: null })),
    scrollToHeading: vi.fn(),
  };
});

describe('Sidebar', () => {
  beforeAll(installDomStubs);

  beforeEach(() => {
    vi.clearAllMocks();
    useDocuments.setState({ tabs: [], activeId: null, closedPaths: [] });
    useUi.setState({
      sidebarCollapsed: false,
      sidebarWidth: SIDEBAR_WIDTH.default,
      sidebarView: 'outline',
      windowWidth: 1280,
    });
  });

  it('renders the rail with the view switch and the app buttons', () => {
    render(<Sidebar />);
    expect(screen.getByRole('navigation', { name: 'Views' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Sidebar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About Markdown Viewer' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Sidebar views' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide sidebar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
  });

  it('offers Open File and Open Folder in the Files panel', async () => {
    const user = userEvent.setup();
    useUi.setState({ sidebarView: 'files' });
    render(<Sidebar />);
    await user.click(screen.getByRole('button', { name: 'Open File' }));
    expect(documentActions.openFileDialog).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Open Folder' }));
    expect(folderActions.openFolderDialog).toHaveBeenCalled();
  });

  it('hides the panel but keeps the rail when collapsed', async () => {
    const user = userEvent.setup();
    render(<Sidebar />);
    await user.click(screen.getByRole('button', { name: 'Hide sidebar' }));
    expect(useUi.getState().sidebarCollapsed).toBe(true);
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Views' })).toBeInTheDocument();
  });

  it('renders only the rail while collapsed', () => {
    useUi.setState({ sidebarCollapsed: true });
    render(<Sidebar />);
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Views' })).toBeInTheDocument();
  });

  it('switches views from the rail (click and arrow keys)', async () => {
    const user = userEvent.setup();
    render(<Sidebar />);
    expect(screen.getByRole('button', { name: 'Outline' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: 'Outline' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Recent' }));
    expect(useUi.getState().sidebarView).toBe('recent');
    expect(screen.getByRole('heading', { name: 'Recent' })).toBeInTheDocument();
    expect(screen.getByText('No recent files')).toBeInTheDocument();

    await user.keyboard('{ArrowDown}');
    expect(useUi.getState().sidebarView).toBe('outline');
    expect(screen.getByRole('button', { name: 'Outline' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(useUi.getState().sidebarView).toBe('files');
    expect(screen.getByRole('heading', { name: 'Files' })).toBeInTheDocument();
    expect(screen.getByText('No folder open')).toBeInTheDocument();
  });

  it('resizes with the keyboard and resets on double-click', async () => {
    const user = userEvent.setup();
    render(<Sidebar />);
    const handle = screen.getByRole('separator', { name: 'Resize sidebar' });
    expect(handle).toHaveAttribute('aria-valuenow', String(SIDEBAR_WIDTH.default));

    handle.focus();
    await user.keyboard('{ArrowRight}');
    expect(useUi.getState().sidebarWidth).toBe(SIDEBAR_WIDTH.default + 16);
    await user.keyboard('{Shift>}{ArrowLeft}{/Shift}');
    expect(useUi.getState().sidebarWidth).toBe(SIDEBAR_WIDTH.default + 16 - 64);
    await user.keyboard('{Home}');
    expect(useUi.getState().sidebarWidth).toBe(SIDEBAR_WIDTH.min);
    expect(handle).toHaveAttribute('aria-valuenow', String(SIDEBAR_WIDTH.min));
    await user.keyboard('{End}');
    expect(useUi.getState().sidebarWidth).toBe(SIDEBAR_WIDTH.max);

    await user.dblClick(handle);
    expect(useUi.getState().sidebarWidth).toBe(SIDEBAR_WIDTH.default);
  });

  it('resizes by dragging', () => {
    render(<Sidebar />);
    const handle = screen.getByRole('separator', { name: 'Resize sidebar' });
    fireEvent.pointerDown(handle, { button: 0, clientX: 280, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 330, pointerId: 1 });
    expect(useUi.getState().sidebarWidth).toBe(330);
    fireEvent.pointerUp(handle, { clientX: 330, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 400, pointerId: 1 });
    expect(useUi.getState().sidebarWidth).toBe(330);
  });

  it('overlays with a scrim on narrow windows and closes on Escape', async () => {
    const user = userEvent.setup();
    useUi.setState({ windowWidth: 800 });
    render(<Sidebar />);
    expect(screen.getByRole('complementary')).toHaveClass('fixed');
    await user.keyboard('{Escape}');
    expect(useUi.getState().sidebarCollapsed).toBe(true);
  });

  it('closes the overlay when the scrim is pressed', () => {
    useUi.setState({ windowWidth: 800 });
    render(<Sidebar />);
    act(() => {
      fireEvent.mouseDown(screen.getByRole('presentation'));
    });
    expect(useUi.getState().sidebarCollapsed).toBe(true);
  });
});
