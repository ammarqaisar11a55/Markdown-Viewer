import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { closeContextMenu } from '@/stores/contextMenuStore';
import { useDocuments } from '@/stores/documentsStore';
import { useRecent } from '@/stores/recentStore';
import { useViewer, scrollToHeading } from '@/stores/viewerStore';
import type { DocumentTab } from '@/types';
import { ContextMenu } from '@/components/ui/ContextMenu';
import { installDomStubs } from '@/components/ui/testing';
import { OutlinePanel } from './OutlinePanel';
import { RecentPanel } from './RecentPanel';

const documentActions = vi.hoisted(() => ({ openDocument: vi.fn(() => Promise.resolve()) }));
vi.mock('@/features/documents/actions', () => documentActions);

vi.mock('@/lib/platform/system', () => ({
  copyText: vi.fn(() => Promise.resolve()),
  revealInFolder: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/stores/viewerStore', async () => {
  const { create } = await import('zustand');
  return {
    useViewer: create<{
      headings: { id: string; text: string; level: number }[];
      activeHeadingId: string | null;
    }>(() => ({ headings: [], activeHeadingId: null })),
    scrollToHeading: vi.fn(),
  };
});

const readyTab: DocumentTab = {
  id: 't1',
  path: '/docs/guide.md',
  name: 'guide.md',
  status: 'ready',
  doc: {
    path: '/docs/guide.md',
    name: 'guide.md',
    size: 10,
    modifiedMs: 1,
    html: '',
    headings: [],
    wordCount: 10,
    lossy: false,
  },
  error: null,
  scrollTop: 0,
  externalChange: null,
  revision: 1,
};

describe('OutlinePanel', () => {
  beforeAll(installDomStubs);

  beforeEach(() => {
    vi.clearAllMocks();
    useDocuments.setState({ tabs: [], activeId: null, closedPaths: [] });
    useViewer.setState({ headings: [], activeHeadingId: null });
  });

  it('asks to open a document when none is active', () => {
    render(<OutlinePanel />);
    expect(screen.getByText('No outline')).toBeInTheDocument();
  });

  it('explains when the document has no headings', () => {
    useDocuments.setState({ tabs: [readyTab], activeId: 't1' });
    render(<OutlinePanel />);
    expect(screen.getByText('No headings')).toBeInTheDocument();
  });

  it('lists headings, marks the active one and scrolls on click', async () => {
    const user = userEvent.setup();
    useDocuments.setState({ tabs: [readyTab], activeId: 't1' });
    useViewer.setState({
      headings: [
        { id: 'intro', text: 'Introduction', level: 1 },
        { id: 'setup', text: 'Setup', level: 2 },
        { id: 'usage', text: 'Usage', level: 2 },
      ],
      activeHeadingId: 'setup',
    });
    render(<OutlinePanel />);
    expect(screen.getByRole('navigation', { name: 'Document outline' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Setup' })).toHaveAttribute(
      'aria-current',
      'location',
    );

    await user.click(screen.getByRole('button', { name: 'Usage' }));
    expect(scrollToHeading).toHaveBeenCalledWith('usage');

    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('button', { name: 'Setup' })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByRole('button', { name: 'Introduction' })).toHaveFocus();
  });
});

describe('RecentPanel', () => {
  beforeAll(installDomStubs);

  beforeEach(() => {
    vi.clearAllMocks();
    useDocuments.setState({ tabs: [], activeId: null, closedPaths: [] });
    useRecent.setState({
      items: [
        { path: '/docs/guide.md', name: 'guide.md', openedAt: 2 },
        { path: '/old/gone.md', name: 'gone.md', openedAt: 1, missing: true },
      ],
    });
  });

  afterEach(() => {
    act(() => {
      closeContextMenu();
    });
  });

  it('lists recent files and opens them', async () => {
    const user = userEvent.setup();
    render(<RecentPanel />);
    expect(screen.getByText('Missing')).toBeInTheDocument();
    await user.click(screen.getByText('guide.md'));
    expect(documentActions.openDocument).toHaveBeenCalledWith('/docs/guide.md');
  });

  it('removes a single entry and clears all', async () => {
    const user = userEvent.setup();
    render(<RecentPanel />);
    await user.click(screen.getByRole('button', { name: 'Remove gone.md from recent files' }));
    expect(useRecent.getState().items.map((i) => i.name)).toEqual(['guide.md']);
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(useRecent.getState().items).toEqual([]);
    expect(screen.getByText('No recent files')).toBeInTheDocument();
  });

  it('offers a context menu with remove', async () => {
    const user = userEvent.setup();
    render(
      <>
        <RecentPanel />
        <ContextMenu />
      </>,
    );
    fireEvent.contextMenu(screen.getByText('guide.md'));
    await user.click(screen.getByRole('menuitem', { name: 'Remove from Recent' }));
    expect(useRecent.getState().items.map((i) => i.name)).toEqual(['gone.md']);
  });
});
