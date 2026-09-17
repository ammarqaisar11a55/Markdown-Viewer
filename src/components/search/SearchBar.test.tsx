import { act, configure, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUi } from '@/stores/uiStore';
import { bumpContentVersion, registerViewer } from '@/stores/viewerStore';
import { SearchBar } from './SearchBar';

// Typing plus the input debounce can be slow on a loaded machine.
configure({ asyncUtilTimeout: 4000 });

class FakeHighlight extends Set<Range> {
  priority = 0;
  constructor(...ranges: Range[]) {
    super(ranges);
  }
}

let highlights: Map<string, FakeHighlight>;
let container: HTMLElement;

beforeEach(() => {
  highlights = new Map();
  vi.stubGlobal('Highlight', FakeHighlight);
  vi.stubGlobal('CSS', { highlights, escape: (v: string) => v });
  Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 10, 10);
  container = document.createElement('div');
  container.tabIndex = 0;
  container.innerHTML =
    '<article class="markdown-body"><p>Alpha beta alpha</p><p>ALPHA gamma</p></article>';
  document.body.append(container);
  act(() => {
    registerViewer(container);
    useUi.setState({ searchOpen: true });
  });
});

afterEach(() => {
  act(() => {
    registerViewer(null);
    useUi.setState({ searchOpen: false });
  });
  container.remove();
  vi.unstubAllGlobals();
});

function status(): HTMLElement {
  return screen.getByRole('status');
}

describe('SearchBar', () => {
  it('renders nothing when closed', () => {
    act(() => {
      useUi.setState({ searchOpen: false });
    });
    const { container: host } = render(<SearchBar />);
    expect(host).toBeEmptyDOMElement();
  });

  it('focuses the input and finds matches', async () => {
    const user = userEvent.setup();
    render(<SearchBar />);
    const input = screen.getByRole('searchbox', { name: 'Find in document' });
    expect(input).toHaveFocus();

    await user.type(input, 'alpha');
    await waitFor(() => expect(status()).toHaveTextContent('1 of 3'));
    expect(highlights.get('search-match')?.size).toBe(3);
    expect(highlights.get('search-current')?.size).toBe(1);
  });

  it('navigates with Enter, Shift+Enter and the buttons', async () => {
    const user = userEvent.setup();
    render(<SearchBar />);
    const input = screen.getByRole('searchbox');
    await user.type(input, 'alpha');
    await waitFor(() => expect(status()).toHaveTextContent('1 of 3'));

    await user.keyboard('{Enter}');
    expect(status()).toHaveTextContent('2 of 3');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    expect(status()).toHaveTextContent('1 of 3');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    expect(status()).toHaveTextContent('3 of 3');
    await user.click(screen.getByRole('button', { name: 'Next match' }));
    expect(status()).toHaveTextContent('1 of 3');
    await user.click(screen.getByRole('button', { name: 'Previous match' }));
    expect(status()).toHaveTextContent('3 of 3');
    await user.keyboard('{F3}');
    expect(status()).toHaveTextContent('1 of 3');

    const current = [...highlights.get('search-current')!][0]!;
    expect(current.toString()).toBe('Alpha');
  });

  it('toggles case sensitivity', async () => {
    const user = userEvent.setup();
    render(<SearchBar />);
    await user.type(screen.getByRole('searchbox'), 'alpha');
    await waitFor(() => expect(status()).toHaveTextContent('1 of 3'));
    const toggle = screen.getByRole('button', { name: 'Match case' });
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(status()).toHaveTextContent('1 of 1'));
  });

  it('shows "No results"', async () => {
    const user = userEvent.setup();
    render(<SearchBar />);
    await user.type(screen.getByRole('searchbox'), 'zeta');
    await waitFor(() => expect(status()).toHaveTextContent('No results'));
    expect(screen.getByRole('button', { name: 'Next match' })).toBeDisabled();
  });

  it('re-runs when the document content changes', async () => {
    const user = userEvent.setup();
    render(<SearchBar />);
    await user.type(screen.getByRole('searchbox'), 'gamma');
    await waitFor(() => expect(status()).toHaveTextContent('1 of 1'));
    container.querySelector('article')!.insertAdjacentHTML('beforeend', '<p>gamma again</p>');
    act(() => {
      bumpContentVersion();
    });
    await waitFor(() => expect(status()).toHaveTextContent('1 of 2'));
  });

  it('closes on Escape, clears highlights and returns focus to the viewer', async () => {
    const user = userEvent.setup();
    render(<SearchBar />);
    await user.type(screen.getByRole('searchbox'), 'beta');
    await waitFor(() => expect(highlights.size).toBe(2));
    await user.keyboard('{Escape}');
    expect(useUi.getState().searchOpen).toBe(false);
    expect(highlights.size).toBe(0);
    expect(container).toHaveFocus();
  });

  it('falls back to the selection without the highlight API', async () => {
    vi.stubGlobal('CSS', {});
    const user = userEvent.setup();
    render(<SearchBar />);
    await user.type(screen.getByRole('searchbox'), 'gamma');
    await waitFor(() => expect(window.getSelection()?.toString()).toBe('gamma'));
    expect(status()).toHaveTextContent('1 of 1');
  });
});
