import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useDocuments } from '@/stores/documentsStore';
import { INITIAL_FOLDER_STATE, useFolder } from '@/stores/folderStore';
import { useRecent } from '@/stores/recentStore';
import { useUi } from '@/stores/uiStore';
import type { DocumentTab } from '@/types';
import { installDomStubs } from '@/components/ui/testing';
import { buildQuickOpenItems } from './buildItems';
import { QuickOpenDialog } from './QuickOpenDialog';

const documentActions = vi.hoisted(() => ({ openDocument: vi.fn(() => Promise.resolve()) }));
vi.mock('@/features/documents/actions', () => documentActions);

function tab(path: string): DocumentTab {
  return {
    id: path,
    path,
    name: path.split('/').pop()!,
    status: 'ready',
    doc: null,
    error: null,
    scrollTop: 0,
    externalChange: null,
    revision: 1,
  };
}

function setup() {
  useDocuments.setState({ tabs: [tab('/p/README.md')], activeId: '/p/README.md' });
  useRecent.setState({
    items: [
      { path: '/p/README.md', name: 'README.md', openedAt: 3 },
      { path: '/notes/todo.md', name: 'todo.md', openedAt: 2 },
    ],
  });
  useFolder.setState({
    rootPath: '/p',
    status: 'ready',
    expanded: {},
    error: null,
    tree: {
      markdownFileCount: 2,
      truncated: false,
      root: {
        name: 'p',
        path: '/p',
        kind: 'directory',
        isMarkdown: false,
        children: [
          { name: 'README.md', path: '/p/README.md', kind: 'file', isMarkdown: true },
          {
            name: 'docs',
            path: '/p/docs',
            kind: 'directory',
            isMarkdown: false,
            children: [
              {
                name: 'architecture.md',
                path: '/p/docs/architecture.md',
                kind: 'file',
                isMarkdown: true,
              },
            ],
          },
        ],
      },
    },
  });
  useUi.setState({ quickOpenOpen: true });
}

describe('QuickOpenDialog', () => {
  beforeAll(installDomStubs);

  beforeEach(() => {
    vi.clearAllMocks();
    useFolder.setState({ ...INITIAL_FOLDER_STATE });
    setup();
  });

  it('lists tabs, recent and folder files grouped and deduplicated', () => {
    render(<QuickOpenDialog />);
    const input = screen.getByRole('combobox', { name: 'Search files' });
    expect(input).toHaveFocus();
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveTextContent('README.md');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(options[1]).toHaveTextContent('todo.md');
    expect(options[2]).toHaveTextContent('architecture.md');
    for (const group of ['Open tabs', 'Recent', 'Folder']) {
      expect(screen.getByText(group)).toBeInTheDocument();
    }
  });

  it('filters with fuzzy matching and opens the result with Enter', async () => {
    const user = userEvent.setup();
    render(<QuickOpenDialog />);
    await user.type(screen.getByRole('combobox'), 'arch md');
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent('architecture.md');
    expect(within(options[0]!).getAllByText(/./, { selector: 'mark' }).length).toBeGreaterThan(0);

    await user.keyboard('{Enter}');
    expect(documentActions.openDocument).toHaveBeenCalledWith('/p/docs/architecture.md');
    expect(useUi.getState().quickOpenOpen).toBe(false);
  });

  it('moves the selection with arrow keys', async () => {
    const user = userEvent.setup();
    render(<QuickOpenDialog />);
    const input = screen.getByRole('combobox');
    await user.keyboard('{ArrowDown}');
    const second = screen.getAllByRole('option')[1]!;
    expect(second).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', second.id);
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(screen.getAllByRole('option')[2]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Enter}');
    expect(documentActions.openDocument).toHaveBeenCalledWith('/p/docs/architecture.md');
  });

  it('opens a result on click', async () => {
    const user = userEvent.setup();
    render(<QuickOpenDialog />);
    await user.click(screen.getByText('todo.md'));
    expect(documentActions.openDocument).toHaveBeenCalledWith('/notes/todo.md');
  });

  it('shows an empty message when nothing matches', async () => {
    const user = userEvent.setup();
    render(<QuickOpenDialog />);
    await user.type(screen.getByRole('combobox'), 'zzzz');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText('No matching files.')).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(documentActions.openDocument).not.toHaveBeenCalled();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    render(<QuickOpenDialog />);
    await user.keyboard('{Escape}');
    expect(useUi.getState().quickOpenOpen).toBe(false);
  });
});

describe('buildQuickOpenItems', () => {
  it('uses relative paths for folder files and keeps the name as suffix', () => {
    const items = buildQuickOpenItems(
      [],
      [{ path: '/a/b.md', name: 'b.md', openedAt: 1, missing: true }],
      [{ path: '/p/docs/c.md', name: 'c.md', relative: 'docs/c.md' }],
    );
    expect(items).toEqual([
      { path: '/a/b.md', name: 'b.md', text: '/a/b.md', group: 'Recent', missing: true },
      { path: '/p/docs/c.md', name: 'c.md', text: 'docs/c.md', group: 'Folder', missing: false },
    ]);
  });
});
