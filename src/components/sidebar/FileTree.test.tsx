import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { closeContextMenu } from '@/stores/contextMenuStore';
import { useDocuments } from '@/stores/documentsStore';
import { INITIAL_FOLDER_STATE, useFolder } from '@/stores/folderStore';
import type { DirectoryTree } from '@/types';
import { ContextMenu } from '@/components/ui/ContextMenu';
import { installDomStubs } from '@/components/ui/testing';
import { FileTreePanel } from './FileTreePanel';

const documentActions = vi.hoisted(() => ({ openDocument: vi.fn(() => Promise.resolve()) }));
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

const system = vi.hoisted(() => ({
  copyText: vi.fn(() => Promise.resolve()),
  revealInFolder: vi.fn(() => Promise.resolve()),
}));
vi.mock('@/lib/platform/system', () => system);

vi.mock('@/app/commands', () => ({
  getShortcutLabel: () => 'Ctrl+Shift+O',
  runCommand: vi.fn(),
}));

const tree: DirectoryTree = {
  markdownFileCount: 3,
  truncated: false,
  root: {
    name: 'project',
    path: '/project',
    kind: 'directory',
    isMarkdown: false,
    children: [
      {
        name: 'docs',
        path: '/project/docs',
        kind: 'directory',
        isMarkdown: false,
        children: [
          { name: 'api.md', path: '/project/docs/api.md', kind: 'file', isMarkdown: true },
          { name: 'guide.md', path: '/project/docs/guide.md', kind: 'file', isMarkdown: true },
        ],
      },
      { name: 'README.md', path: '/project/README.md', kind: 'file', isMarkdown: true },
      { name: 'logo.png', path: '/project/logo.png', kind: 'file', isMarkdown: false },
    ],
  },
};

function setFolder() {
  useFolder.setState({
    rootPath: '/project',
    tree,
    status: 'ready',
    error: null,
    expanded: { '/project': true },
  });
}

describe('FileTreePanel', () => {
  beforeAll(installDomStubs);

  beforeEach(() => {
    vi.clearAllMocks();
    useFolder.setState({ ...INITIAL_FOLDER_STATE });
    useDocuments.setState({ tabs: [], activeId: null, closedPaths: [] });
  });

  afterEach(() => {
    act(() => {
      closeContextMenu();
    });
  });

  it('shows an empty state with an Open Folder button', async () => {
    const user = userEvent.setup();
    render(<FileTreePanel />);
    expect(screen.getByText('No folder open')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open Folder' }));
    expect(folderActions.openFolderDialog).toHaveBeenCalled();
  });

  it('renders a tree with folder header actions', async () => {
    const user = userEvent.setup();
    setFolder();
    render(<FileTreePanel />);
    expect(screen.getByRole('heading', { name: 'project' })).toBeInTheDocument();
    const treeEl = screen.getByRole('tree', { name: 'Files in project' });
    const items = within(treeEl).getAllByRole('treeitem');
    expect(items.map((i) => i.textContent)).toEqual(['docs', 'README.md', 'logo.png']);
    expect(items[0]).toHaveAttribute('aria-expanded', 'false');
    expect(items[2]).toHaveAttribute('aria-disabled', 'true');

    await user.click(screen.getByRole('button', { name: 'Refresh folder' }));
    expect(folderActions.refreshFolder).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Close folder' }));
    expect(folderActions.closeFolder).toHaveBeenCalled();
  });

  it('expands and collapses folders on click', async () => {
    const user = userEvent.setup();
    setFolder();
    render(<FileTreePanel />);
    const docs = screen.getByRole('treeitem', { name: 'docs' });
    await user.click(docs);
    expect(docs).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('treeitem', { name: 'api.md' })).toHaveAttribute('aria-level', '2');

    await user.click(docs);
    expect(docs).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('treeitem', { name: 'api.md' })).not.toBeInTheDocument();

    await user.click(docs);
    await user.click(screen.getByRole('button', { name: 'Collapse all folders' }));
    expect(screen.queryByRole('treeitem', { name: 'api.md' })).not.toBeInTheDocument();
  });

  it('opens markdown files and ignores other files', async () => {
    const user = userEvent.setup();
    setFolder();
    render(<FileTreePanel />);
    await user.click(screen.getByRole('treeitem', { name: 'README.md' }));
    expect(documentActions.openDocument).toHaveBeenCalledWith('/project/README.md');
    await user.click(screen.getByRole('treeitem', { name: 'logo.png' }));
    expect(documentActions.openDocument).toHaveBeenCalledTimes(1);
  });

  it('marks the active document as selected', () => {
    setFolder();
    useDocuments.setState({
      tabs: [
        {
          id: 't1',
          path: '/project/README.md',
          name: 'README.md',
          status: 'ready',
          doc: null,
          error: null,
          scrollTop: 0,
          externalChange: null,
          revision: 1,
        },
      ],
      activeId: 't1',
    });
    render(<FileTreePanel />);
    const readme = screen.getByRole('treeitem', { name: 'README.md' });
    expect(readme).toHaveAttribute('aria-selected', 'true');
    expect(readme).toHaveAttribute('tabindex', '0');
  });

  it('supports arrow-key navigation', async () => {
    const user = userEvent.setup();
    setFolder();
    render(<FileTreePanel />);
    const docs = screen.getByRole('treeitem', { name: 'docs' });
    docs.focus();

    await user.keyboard('{ArrowRight}');
    expect(docs).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('treeitem', { name: 'api.md' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('treeitem', { name: 'guide.md' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(documentActions.openDocument).toHaveBeenCalledWith('/project/docs/guide.md');
    await user.keyboard('{ArrowLeft}');
    expect(docs).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(docs).toHaveAttribute('aria-expanded', 'false');
    await user.keyboard('{End}');
    expect(screen.getByRole('treeitem', { name: 'logo.png' })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(docs).toHaveFocus();
  });

  it('offers file actions in the context menu', async () => {
    const user = userEvent.setup();
    setFolder();
    render(
      <>
        <FileTreePanel />
        <ContextMenu />
      </>,
    );
    fireEvent.contextMenu(screen.getByRole('treeitem', { name: 'README.md' }));
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual([
      'Open',
      'Open in New Tab',
      'Reveal in Folder',
      'Copy Path',
    ]);
    await user.click(screen.getByRole('menuitem', { name: 'Open in New Tab' }));
    expect(documentActions.openDocument).toHaveBeenCalledWith('/project/README.md', {
      newTab: true,
    });

    fireEvent.contextMenu(screen.getByRole('treeitem', { name: 'logo.png' }));
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual([
      'Reveal in Folder',
      'Copy Path',
    ]);
    await user.click(screen.getByRole('menuitem', { name: 'Reveal in Folder' }));
    expect(system.revealInFolder).toHaveBeenCalledWith('/project/logo.png');
  });

  it('shows loading, error and truncated states', async () => {
    const user = userEvent.setup();
    useFolder.setState({ rootPath: '/project', status: 'loading', tree: null });
    const { rerender } = render(<FileTreePanel />);
    expect(screen.getByRole('status')).toHaveTextContent('Scanning folder');

    act(() => {
      useFolder.setState({
        status: 'error',
        error: {
          kind: 'notFound',
          title: 'Unable to open this folder.',
          description: 'The folder may have been moved or deleted.',
          technical: 'ENOENT',
        },
      });
    });
    rerender(<FileTreePanel />);
    expect(screen.getByText('The folder may have been moved or deleted.')).toBeInTheDocument();
    expect(screen.queryByText('ENOENT')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(folderActions.refreshFolder).toHaveBeenCalled();

    act(() => {
      useFolder.setState({ status: 'ready', error: null, tree: { ...tree, truncated: true } });
    });
    rerender(<FileTreePanel />);
    expect(screen.getByText(/only part of it is shown/)).toBeInTheDocument();
  });
});
