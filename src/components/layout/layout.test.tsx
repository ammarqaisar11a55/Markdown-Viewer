import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useDocuments } from '@/stores/documentsStore';
import { useRecent } from '@/stores/recentStore';
import { useToasts } from '@/stores/toastStore';
import { useUi } from '@/stores/uiStore';
import type { DocumentTab } from '@/types';
import { installDomStubs } from '@/components/ui/testing';
import { DropOverlay } from './DropOverlay';
import { EmptyState } from './EmptyState';
import { formatReadingTime, formatWordCount, formatZoom } from './format';
import { MainArea } from './MainArea';
import { ReadingModeExit } from './ReadingModeExit';
import { StatusBar } from './StatusBar';

const documentActions = vi.hoisted(() => ({
  openDocument: vi.fn(() => Promise.resolve()),
  openFileDialog: vi.fn(() => Promise.resolve()),
  reloadDocument: vi.fn(() => Promise.resolve()),
  closeTab: vi.fn(),
  dismissExternalChange: vi.fn(),
}));
vi.mock('@/features/documents/actions', () => documentActions);

const folderActions = vi.hoisted(() => ({ openFolderDialog: vi.fn(() => Promise.resolve()) }));
vi.mock('@/features/folder/actions', () => folderActions);

const system = vi.hoisted(() => ({ copyText: vi.fn(() => Promise.resolve()) }));
vi.mock('@/lib/platform/system', () => system);

vi.mock('@/app/commands', () => ({
  getShortcutLabel: (id: string) =>
    ({ 'file.open': 'Ctrl+O', 'view.zoomReset': 'Ctrl+0', 'view.toggleTheme': 'Ctrl+Shift+D' })[id],
  runCommand: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/hooks/useThemeEffect', () => ({ useResolvedTheme: () => 'light' }));

vi.mock('@/components/markdown/MarkdownView', () => ({
  MarkdownView: ({ tab }: { tab: DocumentTab }) => (
    <div role="document" aria-label={tab.name}>
      {tab.doc?.html}
    </div>
  ),
}));
vi.mock('@/components/search/SearchBar', () => ({ SearchBar: () => null }));

function makeTab(overrides: Partial<DocumentTab> = {}): DocumentTab {
  return {
    id: 't1',
    path: '/home/me/docs/guide.md',
    name: 'guide.md',
    status: 'ready',
    doc: {
      path: '/home/me/docs/guide.md',
      name: 'guide.md',
      size: 100,
      modifiedMs: 1,
      html: 'Rendered content',
      headings: [],
      wordCount: 1150,
      lossy: false,
    },
    error: null,
    scrollTop: 0,
    externalChange: null,
    revision: 1,
    ...overrides,
  };
}

function setTabs(...tabs: DocumentTab[]) {
  useDocuments.setState({ tabs, activeId: tabs[0]?.id ?? null, closedPaths: [] });
}

beforeAll(installDomStubs);

beforeEach(() => {
  vi.clearAllMocks();
  setTabs();
  useRecent.setState({ items: [] });
  useToasts.setState({ toasts: [] });
  useUi.setState({ readingMode: false, zoom: 1, dragActive: false, searchOpen: false });
});

describe('format helpers', () => {
  it('formats word counts, reading time and zoom', () => {
    expect(formatWordCount(1)).toBe('1 word');
    expect(formatWordCount(12345)).toBe('12,345 words');
    expect(formatReadingTime(0)).toBe('0 min read');
    expect(formatReadingTime(50)).toBe('1 min read');
    expect(formatReadingTime(1150)).toBe('5 min read');
    expect(formatZoom(1.1)).toBe('110%');
  });
});

describe('EmptyState', () => {
  it('offers to open a file or folder', async () => {
    const user = userEvent.setup();
    render(<EmptyState />);
    expect(screen.getByRole('heading', { name: 'Markdown Viewer' })).toBeInTheDocument();
    expect(screen.getByText('Read Markdown beautifully.')).toBeInTheDocument();
    expect(screen.getByText('or drag a .md file here')).toBeInTheDocument();
    expect(screen.getByText('Ctrl')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open Markdown File' }));
    expect(documentActions.openFileDialog).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Open Folder' }));
    expect(folderActions.openFolderDialog).toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: 'Recent files' })).not.toBeInTheDocument();
  });

  it('lists up to six recent files and opens them', async () => {
    const user = userEvent.setup();
    useRecent.setState({
      items: Array.from({ length: 8 }, (_, i) => ({
        path: `/docs/file${i}.md`,
        name: `file${i}.md`,
        openedAt: i,
      })),
    });
    render(<EmptyState />);
    const section = screen.getByRole('region', { name: 'Recent files' });
    expect(section.querySelectorAll('li')).toHaveLength(6);
    await user.click(screen.getByText('file2.md'));
    expect(documentActions.openDocument).toHaveBeenCalledWith('/docs/file2.md');
  });
});

describe('MainArea', () => {
  it('shows the empty state without tabs', () => {
    render(<MainArea />);
    expect(screen.getByRole('button', { name: 'Open Markdown File' })).toBeInTheDocument();
  });

  it('renders the document inside the tab panel', () => {
    setTabs(makeTab());
    render(<MainArea />);
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('aria-labelledby', 'tab-t1');
    expect(screen.getByRole('document', { name: 'guide.md' })).toHaveTextContent(
      'Rendered content',
    );
  });

  it('shows a loading skeleton', () => {
    setTabs(makeTab({ status: 'loading', doc: null }));
    render(<MainArea />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading document');
  });

  it('shows a friendly error with recovery actions', async () => {
    const user = userEvent.setup();
    useRecent.setState({
      items: [{ path: '/home/me/docs/guide.md', name: 'guide.md', openedAt: 1 }],
    });
    setTabs(
      makeTab({
        status: 'error',
        doc: null,
        error: {
          kind: 'notFound',
          title: 'Unable to open this file.',
          description: 'The file may have been moved or deleted.',
          technical: 'ENOENT: no such file',
        },
      }),
    );
    render(<MainArea />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Unable to open this file.');
    expect(alert).not.toHaveTextContent('ENOENT');

    await user.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(documentActions.reloadDocument).toHaveBeenCalledWith('t1', { preserveScroll: false });
    await user.click(screen.getByRole('button', { name: 'Remove from Recent' }));
    expect(useRecent.getState().items).toEqual([]);
    expect(screen.queryByRole('button', { name: 'Remove from Recent' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close Tab' }));
    expect(documentActions.closeTab).toHaveBeenCalledWith('t1');
  });

  it('shows the external change banner', async () => {
    const user = userEvent.setup();
    setTabs(makeTab({ externalChange: 'modified' }));
    const { rerender } = render(<MainArea />);
    expect(screen.getByText('This file changed on disk.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reload' }));
    expect(documentActions.reloadDocument).toHaveBeenCalledWith('t1');
    await user.click(screen.getByRole('button', { name: 'Ignore' }));
    expect(documentActions.dismissExternalChange).toHaveBeenCalledWith('t1');

    act(() => {
      setTabs(makeTab({ externalChange: 'removed' }));
    });
    rerender(<MainArea />);
    expect(screen.getByText('File was deleted or moved.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(documentActions.closeTab).toHaveBeenCalledWith('t1');
  });
});

describe('StatusBar', () => {
  it('shows word count, reading time and zoom', async () => {
    const user = userEvent.setup();
    setTabs(makeTab());
    useUi.setState({ zoom: 1.2 });
    render(<StatusBar />);
    expect(screen.getByText('1,150 words')).toBeInTheDocument();
    expect(screen.getByText('5 min read')).toBeInTheDocument();
    const zoom = screen.getByRole('button', { name: 'Zoom 120%, reset zoom' });
    await user.click(zoom);
    expect(useUi.getState().zoom).toBe(1);
  });

  it('copies the file path on click', async () => {
    const user = userEvent.setup();
    setTabs(makeTab());
    render(<StatusBar />);
    await user.click(screen.getByText(/guide\.md$/));
    expect(system.copyText).toHaveBeenCalledWith('/home/me/docs/guide.md');
    expect(useToasts.getState().toasts[0]?.title).toBe('Path copied');
  });

  it('omits document details without an active document', () => {
    render(<StatusBar />);
    expect(screen.queryByText(/words/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument();
  });
});

describe('ReadingModeExit', () => {
  it('exits reading mode with the button', async () => {
    const user = userEvent.setup();
    useUi.setState({ readingMode: true });
    render(<ReadingModeExit />);
    await user.click(screen.getByRole('button', { name: /Exit Reading Mode/ }));
    expect(useUi.getState().readingMode).toBe(false);
  });

  it('exits on Escape unless an overlay is open', async () => {
    const user = userEvent.setup();
    useUi.setState({ readingMode: true, searchOpen: true });
    render(<ReadingModeExit />);
    await user.keyboard('{Escape}');
    expect(useUi.getState().readingMode).toBe(true);

    act(() => {
      useUi.setState({ searchOpen: false });
    });
    await user.keyboard('{Escape}');
    expect(useUi.getState().readingMode).toBe(false);
  });

  it('hides the pill after a moment of inactivity', () => {
    vi.useFakeTimers();
    try {
      useUi.setState({ readingMode: true });
      const { container } = render(<ReadingModeExit />);
      const pill = container.querySelector('.reading-exit')!;
      expect(pill).toHaveAttribute('data-visible', 'true');
      act(() => {
        vi.advanceTimersByTime(2500);
      });
      expect(pill).toHaveAttribute('data-visible', 'false');
      act(() => {
        window.dispatchEvent(new Event('pointermove'));
      });
      expect(pill).toHaveAttribute('data-visible', 'true');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('DropOverlay', () => {
  it('appears while files are dragged over the window', () => {
    const { rerender } = render(<DropOverlay />);
    expect(screen.queryByText('Drop to open')).not.toBeInTheDocument();
    act(() => {
      useUi.setState({ dragActive: true });
    });
    rerender(<DropOverlay />);
    expect(screen.getByText('Drop to open')).toBeInTheDocument();
  });
});
