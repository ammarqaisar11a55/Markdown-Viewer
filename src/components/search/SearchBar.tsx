import { clsx } from 'clsx';
import { CaseSensitive, ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { IconButton } from '@/components/ui/IconButton';
import { DEFAULT_MATCH_LIMIT, findMatches, firstRangeInView } from '@/lib/search/findMatches';
import { formatMatchCount } from '@/lib/search/format';
import {
  createSearchPainter,
  scrollRangeIntoView,
  type SearchPainter,
} from '@/lib/search/highlighter';
import { useUi } from '@/stores/uiStore';
import { useViewer } from '@/stores/viewerStore';

const DEBOUNCE_MS = 120;

interface SearchState {
  /** The query these results belong to. */
  query: string;
  caseSensitive: boolean;
  ranges: Range[];
  limitReached: boolean;
  current: number;
  /** Scroll the current match into view (false for background refreshes). */
  reveal: boolean;
}

const EMPTY: SearchState = {
  query: '',
  caseSensitive: false,
  ranges: [],
  limitReached: false,
  current: -1,
  reveal: false,
};

/** Find-in-document bar. Rendered inside the (relatively positioned) main area. */
export function SearchBar() {
  const open = useUi((s) => s.searchOpen);
  if (!open) return null;
  return <SearchPanel />;
}

function SearchPanel() {
  const setSearchOpen = useUi((s) => s.setSearchOpen);
  const container = useViewer((s) => s.container);
  const contentVersion = useViewer((s) => s.contentVersion);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const painterRef = useRef<SearchPainter | null>(null);
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [result, setResult] = useState<SearchState>(EMPTY);
  const resultRef = useRef<SearchState>(EMPTY);

  const painter = useCallback((): SearchPainter => {
    painterRef.current ??= createSearchPainter();
    return painterRef.current;
  }, []);

  const commit = useCallback((next: SearchState) => {
    resultRef.current = next;
    setResult(next);
  }, []);

  const focusInput = useCallback(() => {
    const input = inputRef.current;
    if (input === null) return;
    input.focus();
    input.select();
  }, []);

  useLayoutEffect(() => {
    focusInput();
  }, [focusInput]);

  const runSearch = useCallback(
    (text: string, matchCase: boolean) => {
      if (container === null || text === '') {
        commit(EMPTY);
        return;
      }
      const content = container.querySelector('.markdown-body') ?? container;
      const found = findMatches(content, text, {
        caseSensitive: matchCase,
        limit: DEFAULT_MATCH_LIMIT,
      });
      const previous = resultRef.current;
      // Same query → only the DOM changed (re-render, highlighting): keep position.
      const refresh = previous.query === text && previous.caseSensitive === matchCase;
      // A new query starts at the first match in view, like browser find.
      const wanted = refresh ? previous.current : firstRangeInView(found.ranges, container);
      const current =
        found.ranges.length === 0 ? -1 : Math.min(Math.max(wanted, 0), found.ranges.length - 1);
      commit({
        query: text,
        caseSensitive: matchCase,
        ranges: found.ranges,
        limitReached: found.limitReached,
        current,
        reveal: !refresh,
      });
    },
    [commit, container],
  );

  // Search when the query or options change (debounced) and whenever the
  // document content changes.
  useEffect(() => {
    const previous = resultRef.current;
    const delay = previous.query === query ? 0 : DEBOUNCE_MS;
    const timer = setTimeout(() => {
      runSearch(query, caseSensitive);
    }, delay);
    return () => clearTimeout(timer);
  }, [query, caseSensitive, contentVersion, runSearch]);

  // Paint and reveal.
  useEffect(() => {
    const active = result.ranges[result.current] ?? null;
    painter().paint(result.ranges, active);
    if (result.reveal && active !== null && container !== null) {
      scrollRangeIntoView(active, container);
    }
  }, [result, container, painter]);

  useEffect(() => () => painterRef.current?.clear(), []);

  const step = useCallback(
    (delta: number) => {
      const state = resultRef.current;
      const total = state.ranges.length;
      if (total === 0) return;
      commit({ ...state, current: (state.current + delta + total) % total, reveal: true });
    },
    [commit],
  );

  const close = useCallback(() => {
    painter().clear();
    setSearchOpen(false);
    container?.focus({ preventScroll: true });
  }, [container, painter, setSearchOpen]);

  // Global keys while the bar is open: F3 / Shift+F3, Mod+F refocuses, and
  // Escape closes while focus is anywhere inside the bar.
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'F3') {
        event.preventDefault();
        step(event.shiftKey ? -1 : 1);
      } else if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        event.key.toLowerCase() === 'f'
      ) {
        focusInput();
      } else if (
        event.key === 'Escape' &&
        panelRef.current?.contains(document.activeElement) === true
      ) {
        event.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [close, focusInput, step]);

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (query !== result.query || caseSensitive !== result.caseSensitive) {
        runSearch(query, caseSensitive);
        return;
      }
      step(event.shiftKey ? -1 : 1);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  };

  const total = result.ranges.length;
  const pendingQuery = query !== result.query;
  const status =
    result.query === '' ? '' : formatMatchCount(result.current, total, result.limitReached);

  return (
    <div
      ref={panelRef}
      role="search"
      className={clsx(
        'absolute top-3 right-5 z-20 flex items-center gap-0.5 rounded-lg border p-1 pl-2.5',
        'border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--fg)] shadow-[var(--shadow-popover)] focus-within:border-[var(--focus-ring)]',
      )}
      aria-label="Find in document"
    >
      <Search aria-hidden="true" className="size-3.5 shrink-0 text-[var(--fg-subtle)]" />
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
        }}
        onKeyDown={onInputKeyDown}
        placeholder="Find in document"
        aria-label="Find in document"
        aria-describedby="md-search-status"
        spellCheck={false}
        autoComplete="off"
        className={clsx(
          'h-7 w-52 min-w-0 bg-transparent px-1.5 text-[13px] outline-none',
          'placeholder:text-[var(--fg-subtle)] [&::-webkit-search-cancel-button]:hidden',
        )}
      />
      <span
        id="md-search-status"
        role="status"
        aria-live="polite"
        className={clsx(
          'min-w-[4.5rem] px-1.5 text-right text-[12px] whitespace-nowrap tabular-nums',
          total === 0 && result.query !== '' ? 'text-[var(--danger)]' : 'text-[var(--fg-muted)]',
          pendingQuery && 'opacity-60',
        )}
      >
        {status}
      </span>
      <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-[var(--border)]" />
      <IconButton
        label="Match case"
        icon={<CaseSensitive />}
        active={caseSensitive}
        aria-pressed={caseSensitive}
        onClick={() => {
          setCaseSensitive((value) => !value);
        }}
      />
      <IconButton
        label="Previous match"
        shortcut="Shift+Enter"
        icon={<ChevronUp />}
        disabled={total === 0}
        onClick={() => {
          step(-1);
        }}
      />
      <IconButton
        label="Next match"
        shortcut="Enter"
        icon={<ChevronDown />}
        disabled={total === 0}
        onClick={() => {
          step(1);
        }}
      />
      <IconButton label="Close" shortcut="Esc" icon={<X />} onClick={close} />
    </div>
  );
}
