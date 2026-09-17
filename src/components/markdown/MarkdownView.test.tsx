import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openDocument, setTabScroll } from '@/features/documents/actions';
import { openExternalUrl, revealInFolder } from '@/lib/platform/system';
import { useContextMenu } from '@/stores/contextMenuStore';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settingsStore';
import { useViewer } from '@/stores/viewerStore';
import type { DocumentTab, OpenedDocument } from '@/types';
import { MarkdownView } from './MarkdownView';

vi.mock('@/features/documents/actions', () => ({
  openDocument: vi.fn(() => Promise.resolve()),
  setTabScroll: vi.fn(),
}));

vi.mock('@/lib/platform/system', () => ({
  toAssetUrl: (path: string) => `mdasset://localhost/${encodeURIComponent(path)}`,
  copyText: vi.fn(() => Promise.resolve()),
  openExternalUrl: vi.fn(() => Promise.resolve()),
  revealInFolder: vi.fn(() => Promise.resolve()),
}));

const HTML = [
  '<h1 id="title">Title<a href="#title" aria-label="Link to heading \'Title\'" class="anchor"></a></h1>',
  '<p>See <a href="#usage">usage</a>, <a href="https://example.com/">site</a>,',
  ' <a href="other.md#part">other</a> and <a href="files/data.csv">data</a>.</p>',
  '<p><img src="img/pic.png" alt="Picture"></p>',
  '<pre><code class="language-js">let a = 1;\n</code></pre>',
  '<h2 id="usage">Usage<a href="#usage" class="anchor"></a></h2>',
].join('\n');

function makeDoc(overrides: Partial<OpenedDocument> = {}): OpenedDocument {
  return {
    path: '/home/u/docs/guide.md',
    name: 'guide.md',
    size: HTML.length,
    modifiedMs: 0,
    html: HTML,
    headings: [
      { level: 1, text: 'Title', id: 'title' },
      { level: 2, text: 'Usage', id: 'usage' },
    ],
    wordCount: 10,
    lossy: false,
    ...overrides,
  };
}

function makeTab(overrides: Partial<DocumentTab> = {}): DocumentTab {
  const doc = overrides.doc ?? makeDoc();
  return {
    id: 'tab-1',
    path: doc.path,
    name: doc.name,
    status: 'ready',
    doc,
    error: null,
    scrollTop: 0,
    externalChange: null,
    revision: 1,
    ...overrides,
  };
}

beforeEach(() => {
  useSettings.setState({ ...DEFAULT_SETTINGS });
  useContextMenu.setState({ open: false, x: 0, y: 0, items: [] });
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    },
  );
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query }));
  HTMLElement.prototype.scrollTo = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function viewer(): HTMLElement {
  return screen.getByRole('document', { name: 'guide.md' });
}

describe('MarkdownView', () => {
  it('renders the document and registers the viewer', () => {
    const { container } = render(<MarkdownView tab={makeTab()} />);
    const scroller = viewer();
    expect(scroller).toHaveAttribute('tabindex', '0');
    expect(container.querySelector('.markdown-body h1')).toHaveTextContent('Title');
    expect(container.querySelector('.md-code-block .md-code-lang')).toHaveTextContent('JavaScript');
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      `mdasset://localhost/${encodeURIComponent('/home/u/docs/img/pic.png')}`,
    );
    expect(useViewer.getState().container).toBe(scroller);
    expect(useViewer.getState().headings.map((h) => h.id)).toEqual(['title', 'usage']);
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('shows a banner for lossy documents', () => {
    render(<MarkdownView tab={makeTab({ doc: makeDoc({ lossy: true }) })} />);
    expect(screen.getByRole('note')).toHaveTextContent('could not be decoded');
  });

  it('scrolls to in-document anchors', async () => {
    const user = userEvent.setup();
    render(<MarkdownView tab={makeTab()} />);
    await user.click(screen.getByRole('link', { name: 'usage' }));
    expect(viewer().scrollTo).toHaveBeenCalled();
    expect(useViewer.getState().activeHeadingId).toBe('usage');
    expect(document.activeElement).toHaveAttribute('id', 'usage');
  });

  it('opens external links with the OS and never navigates', () => {
    render(<MarkdownView tab={makeTab()} />);
    const link = screen.getByRole('link', { name: 'site' });
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(openExternalUrl).toHaveBeenCalledWith('https://example.com/');
  });

  it('opens markdown links in a new tab and reveals other local files', async () => {
    const user = userEvent.setup();
    render(<MarkdownView tab={makeTab()} />);
    await user.click(screen.getByRole('link', { name: 'other' }));
    expect(openDocument).toHaveBeenCalledWith('/home/u/docs/other.md', { newTab: true });
    fireEvent(
      screen.getByRole('link', { name: 'data' }),
      new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 }),
    );
    expect(revealInFolder).toHaveBeenCalledWith('/home/u/docs/files/data.csv');
  });

  it('opens images in a lightbox that closes with Escape', async () => {
    const user = userEvent.setup();
    render(<MarkdownView tab={makeTab()} />);
    await user.click(screen.getByRole('button', { name: 'Open image preview: Picture' }));
    const dialog = screen.getByRole('dialog', { name: 'Image preview: Picture' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close image preview' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens a content context menu', () => {
    render(<MarkdownView tab={makeTab()} />);
    fireEvent.contextMenu(screen.getByRole('link', { name: 'site' }), {
      clientX: 12,
      clientY: 34,
    });
    const state = useContextMenu.getState();
    expect(state).toMatchObject({ open: true, x: 12, y: 34 });
    const ids = state.items.map((item) => ('id' in item ? item.id : '-'));
    expect(ids).toEqual(['open-link', 'copy-link', '-', 'select-all']);
  });

  it('re-renders only when the revision changes and restores scroll', () => {
    const tab = makeTab({ scrollTop: 120 });
    const { container, rerender } = render(<MarkdownView tab={tab} />);
    const scroller = viewer();
    expect(scroller.scrollTop).toBe(120);
    const firstHeading = container.querySelector('h1');

    rerender(<MarkdownView tab={{ ...tab, scrollTop: 200 }} />);
    expect(container.querySelector('h1')).toBe(firstHeading);

    const doc = makeDoc({ html: '<h1 id="title">Changed</h1>' });
    rerender(<MarkdownView tab={{ ...tab, doc, revision: 2 }} />);
    expect(container.querySelector('h1')).not.toBe(firstHeading);
    expect(container.querySelector('h1')).toHaveTextContent('Changed');
  });

  it('re-renders when image loading settings change', () => {
    const { container } = render(
      <MarkdownView
        tab={makeTab({ doc: makeDoc({ html: '<p><img src="https://x.org/a.png" alt="r"></p>' }) })}
      />,
    );
    expect(container.querySelector('img')).not.toBeNull();
    act(() => {
      useSettings.setState({ loadRemoteImages: false });
    });
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.md-image-placeholder')).toHaveTextContent(
      'Remote image blocked',
    );
  });

  it('reports scroll positions', async () => {
    render(<MarkdownView tab={makeTab()} />);
    const scroller = viewer();
    scroller.scrollTop = 300;
    fireEvent.scroll(scroller);
    await waitFor(() => expect(setTabScroll).toHaveBeenCalledWith('tab-1', 300));
  });

  it('selects only the document on Ctrl+A', () => {
    render(<MarkdownView tab={makeTab()} />);
    fireEvent.keyDown(viewer(), { key: 'a', ctrlKey: true });
    expect(window.getSelection()?.toString()).toContain('Title');
  });
});
