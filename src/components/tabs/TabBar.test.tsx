import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { closeContextMenu } from '@/stores/contextMenuStore';
import { useDocuments } from '@/stores/documentsStore';
import { useUi } from '@/stores/uiStore';
import type { DocumentTab } from '@/types';
import { ContextMenu } from '@/components/ui/ContextMenu';
import { installDomStubs } from '@/components/ui/testing';
import { TabBar } from './TabBar';

const actions = vi.hoisted(() => ({
  activateTab: vi.fn(),
  closeTab: vi.fn(),
  closeOtherTabs: vi.fn(),
  closeAllTabs: vi.fn(),
}));
vi.mock('@/features/documents/actions', () => actions);

const system = vi.hoisted(() => ({
  copyText: vi.fn(() => Promise.resolve()),
  revealInFolder: vi.fn(() => Promise.resolve()),
}));
vi.mock('@/lib/platform/system', () => system);

const commands = vi.hoisted(() => ({
  runCommand: vi.fn(() => Promise.resolve()),
  getShortcutLabel: (id: string) =>
    ({ 'tab.close': 'Ctrl+W', 'view.find': 'Ctrl+F', 'app.settings': 'Ctrl+,' })[id],
}));
vi.mock('@/app/commands', () => commands);

function tab(id: string, name: string, extra: Partial<DocumentTab> = {}): DocumentTab {
  return {
    id,
    name,
    path: `/docs/${name}`,
    status: 'ready',
    doc: null,
    error: null,
    scrollTop: 0,
    externalChange: null,
    revision: 1,
    ...extra,
  };
}

describe('TabBar', () => {
  beforeAll(installDomStubs);

  beforeEach(() => {
    vi.clearAllMocks();
    useUi.setState({ sidebarCollapsed: false, searchOpen: false });
    useDocuments.setState({
      tabs: [
        tab('a', 'README.md'),
        tab('b', 'API.md', { externalChange: 'modified' }),
        tab('c', 'Architecture.md'),
      ],
      activeId: 'a',
      closedPaths: [],
    });
  });

  afterEach(() => {
    act(() => {
      closeContextMenu();
    });
  });

  it('renders an accessible tab list with the active tab selected', () => {
    render(<TabBar />);
    const list = screen.getByRole('tablist', { name: 'Open documents' });
    const tabs = within(list).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual([
      'README.md',
      'API.md(changed on disk)',
      'Architecture.md',
    ]);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[0]).toHaveAttribute('tabindex', '0');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    expect(tabs[1]).toHaveAttribute('tabindex', '-1');
  });

  it('activates a tab on click', async () => {
    const user = userEvent.setup();
    render(<TabBar />);
    await user.click(screen.getByRole('tab', { name: /Architecture\.md/ }));
    expect(actions.activateTab).toHaveBeenCalledWith('c');
  });

  it('closes a tab with the close button without activating it', async () => {
    const user = userEvent.setup();
    render(<TabBar />);
    await user.click(screen.getByRole('button', { name: 'Close API.md' }));
    expect(actions.closeTab).toHaveBeenCalledWith('b');
    expect(actions.activateTab).not.toHaveBeenCalled();
  });

  it('closes a tab on middle click', () => {
    render(<TabBar />);
    fireEvent(
      screen.getByRole('tab', { name: /README\.md/ }),
      new MouseEvent('auxclick', { bubbles: true, button: 1 }),
    );
    expect(actions.closeTab).toHaveBeenCalledWith('a');
  });

  it('moves between tabs with arrow keys and closes with Delete', async () => {
    const user = userEvent.setup();
    render(<TabBar />);
    screen.getByRole('tab', { name: /README\.md/ }).focus();
    await user.keyboard('{ArrowRight}');
    expect(actions.activateTab).toHaveBeenLastCalledWith('b');
    await user.keyboard('{ArrowLeft}');
    expect(actions.activateTab).toHaveBeenLastCalledWith('a');
    await user.keyboard('{ArrowLeft}');
    expect(actions.activateTab).toHaveBeenLastCalledWith('c');
    await user.keyboard('{Home}');
    expect(actions.activateTab).toHaveBeenLastCalledWith('a');
    await user.keyboard('{Delete}');
    expect(actions.closeTab).toHaveBeenCalledWith('a');
  });

  it('offers tab actions in the context menu', async () => {
    const user = userEvent.setup();
    render(
      <>
        <TabBar />
        <ContextMenu />
      </>,
    );
    fireEvent.contextMenu(screen.getByRole('tab', { name: /API\.md/ }), {
      clientX: 10,
      clientY: 10,
    });
    const menu = screen.getByRole('menu');
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((i) => i.textContent),
    ).toEqual(['CloseCtrl+W', 'Close Others', 'Close All', 'Copy File Path', 'Reveal in Folder']);

    await user.click(within(menu).getByRole('menuitem', { name: 'Close Others' }));
    expect(actions.closeOtherTabs).toHaveBeenCalledWith('b');

    fireEvent.contextMenu(screen.getByRole('tab', { name: /API\.md/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Copy File Path' }));
    expect(system.copyText).toHaveBeenCalledWith('/docs/API.md');

    fireEvent.contextMenu(screen.getByRole('tab', { name: /API\.md/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Reveal in Folder' }));
    expect(system.revealInFolder).toHaveBeenCalledWith('/docs/API.md');

    fireEvent.contextMenu(screen.getByRole('tab', { name: /API\.md/ }));
    await user.click(screen.getByRole('menuitem', { name: /^CloseCtrl/ }));
    expect(actions.closeTab).toHaveBeenCalledWith('b');

    fireEvent.contextMenu(screen.getByRole('tab', { name: /API\.md/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Close All' }));
    expect(actions.closeAllTabs).toHaveBeenCalled();
  });

  it('shows the expand-sidebar button only when the sidebar is collapsed', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<TabBar />);
    expect(screen.queryByRole('button', { name: 'Show sidebar' })).not.toBeInTheDocument();
    act(() => {
      useUi.setState({ sidebarCollapsed: true });
    });
    rerender(<TabBar />);
    await user.click(screen.getByRole('button', { name: 'Show sidebar' }));
    expect(commands.runCommand).toHaveBeenCalledWith('view.toggleSidebar');
  });

  it('runs toolbar commands', async () => {
    const user = userEvent.setup();
    render(<TabBar />);
    await user.click(screen.getByRole('button', { name: 'Find in document' }));
    expect(commands.runCommand).toHaveBeenCalledWith('view.find');
    await user.click(screen.getByRole('button', { name: 'Reading mode' }));
    expect(commands.runCommand).toHaveBeenCalledWith('view.readingMode');
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(commands.runCommand).toHaveBeenCalledWith('app.settings');
  });
});
