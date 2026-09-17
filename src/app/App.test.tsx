import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useDocuments } from '@/stores/documentsStore';
import { useUi } from '@/stores/uiStore';
import type { DocumentTab } from '@/types';
import { installDomStubs } from '@/components/ui/testing';
import { App } from './App';

const hooks = vi.hoisted(() => ({ useGlobalShortcuts: vi.fn(), useThemeEffect: vi.fn() }));
vi.mock('@/hooks/useGlobalShortcuts', () => ({ useGlobalShortcuts: hooks.useGlobalShortcuts }));
vi.mock('@/hooks/useThemeEffect', () => ({
  useThemeEffect: hooks.useThemeEffect,
  useResolvedTheme: () => 'dark',
}));

vi.mock('@/stores/viewerStore', async () => {
  const { create } = await import('zustand');
  return {
    useViewer: create(() => ({ headings: [], activeHeadingId: null })),
    scrollToHeading: vi.fn(),
  };
});
vi.mock('@/components/markdown/MarkdownView', () => ({
  MarkdownView: ({ tab }: { tab: DocumentTab }) => <div role="document" aria-label={tab.name} />,
}));
vi.mock('@/components/search/SearchBar', () => ({ SearchBar: () => null }));

const readyTab: DocumentTab = {
  id: 't1',
  path: '/docs/guide.md',
  name: 'guide.md',
  status: 'ready',
  doc: {
    path: '/docs/guide.md',
    name: 'guide.md',
    size: 1,
    modifiedMs: 1,
    html: '',
    headings: [],
    wordCount: 3,
    lossy: false,
  },
  error: null,
  scrollTop: 0,
  externalChange: null,
  revision: 1,
};

describe('App', () => {
  beforeAll(installDomStubs);

  beforeEach(() => {
    useDocuments.setState({ tabs: [], activeId: null, closedPaths: [] });
    useUi.setState({
      readingMode: false,
      sidebarCollapsed: false,
      windowWidth: 1280,
      settingsOpen: false,
      quickOpenOpen: false,
    });
  });

  it('wires global hooks and renders the shell with the empty state', () => {
    render(<App />);
    expect(hooks.useGlobalShortcuts).toHaveBeenCalled();
    expect(hooks.useThemeEffect).toHaveBeenCalled();
    expect(screen.getByRole('complementary', { name: 'Sidebar' })).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: 'Open documents' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Markdown File' })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo', { name: 'Status bar' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('hides the chrome in reading mode', async () => {
    const user = userEvent.setup();
    useDocuments.setState({ tabs: [readyTab], activeId: 't1' });
    useUi.setState({ readingMode: true });
    render(<App />);
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
    expect(screen.getByRole('document', { name: 'guide.md' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Exit Reading Mode/ }));
    expect(useUi.getState().readingMode).toBe(false);
  });

  it('auto-collapses the sidebar on narrow windows', () => {
    useUi.setState({ windowWidth: 800 });
    render(<App />);
    expect(useUi.getState().sidebarCollapsed).toBe(true);
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();

    act(() => {
      useUi.setState({ windowWidth: 1200 });
    });
    expect(useUi.getState().sidebarCollapsed).toBe(false);
    expect(screen.getByRole('complementary', { name: 'Sidebar' })).toBeInTheDocument();
  });

  it('keeps a sidebar the user collapsed when the window widens', () => {
    useUi.setState({ windowWidth: 800, sidebarCollapsed: true });
    render(<App />);
    act(() => {
      useUi.setState({ windowWidth: 1200 });
    });
    expect(useUi.getState().sidebarCollapsed).toBe(true);
  });

  it('suppresses the native context menu except in text inputs', () => {
    useUi.setState({ quickOpenOpen: true });
    render(<App />);
    const heading = screen.getByRole('heading', { name: 'Markdown Viewer' });
    expect(fireEvent.contextMenu(heading)).toBe(false);
    // Portaled dialogs are covered too.
    expect(fireEvent.contextMenu(screen.getByRole('listbox'))).toBe(false);
    expect(fireEvent.contextMenu(screen.getByRole('combobox'))).toBe(true);
  });

  it('opens the settings dialog from the store', () => {
    render(<App />);
    act(() => {
      useUi.setState({ settingsOpen: true });
    });
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
  });
});
