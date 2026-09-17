import { clsx } from 'clsx';
import { FileText, Search } from 'lucide-react';
import {
  memo,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { openDocument } from '@/features/documents/actions';
import { getFolderMarkdownFiles } from '@/features/folder/actions';
import { useRecent } from '@/features/recent/actions';
import { fuzzyFilter, type FuzzyResult } from '@/lib/fuzzy';
import { useDocuments } from '@/stores/documentsStore';
import { useUi } from '@/stores/uiStore';
import { HighlightedText } from '@/components/ui/HighlightedText';
import { Kbd } from '@/components/ui/Kbd';
import { Modal } from '@/components/ui/Modal';
import { buildQuickOpenItems, type QuickOpenItem } from './buildItems';

const MAX_RESULTS = 100;

export function QuickOpenDialog() {
  const open = useUi((s) => s.quickOpenOpen);
  const setOpen = useUi((s) => s.setQuickOpenOpen);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <Modal
      open={open}
      onClose={() => {
        setOpen(false);
      }}
      title="Quick Open"
      hideTitle
      placement="top"
      initialFocusRef={inputRef}
      className="max-w-[600px]!"
    >
      <QuickOpenPanel
        inputRef={inputRef}
        onDone={() => {
          setOpen(false);
        }}
      />
    </Modal>
  );
}

function QuickOpenPanel({
  inputRef,
  onDone,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  onDone: () => void;
}) {
  const listId = useId();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  // Candidates are captured when the dialog opens so background updates never reshuffle them.
  const [items] = useState(() =>
    buildQuickOpenItems(
      useDocuments.getState().tabs,
      useRecent.getState().items,
      getFolderMarkdownFiles(),
    ),
  );
  const results = useMemo(
    () => fuzzyFilter(query, items, (item) => item.text, MAX_RESULTS),
    [query, items],
  );
  const grouped = query.trim() === '';

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${selected}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const choose = (result: FuzzyResult<QuickOpenItem> | undefined) => {
    if (!result) return;
    onDone();
    void openDocument(result.item.path);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const count = results.length;
    switch (event.key) {
      case 'ArrowDown':
        setSelected((i) => (count === 0 ? 0 : (i + 1) % count));
        break;
      case 'ArrowUp':
        setSelected((i) => (count === 0 ? 0 : (i - 1 + count) % count));
        break;
      case 'PageDown':
        setSelected((i) => Math.min(count - 1, i + 8));
        break;
      case 'PageUp':
        setSelected((i) => Math.max(0, i - 8));
        break;
      case 'Enter':
        choose(results[selected]);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  const optionId = (index: number) => `${listId}-option-${index}`;

  return (
    <div className="flex max-h-[min(520px,70vh)] flex-col">
      <div className="flex h-11 shrink-0 items-center gap-2.5 border-b border-border px-3.5">
        <Search aria-hidden className="size-4 shrink-0 text-fg-subtle" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label="Search files"
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={results.length > 0 ? optionId(selected) : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder="Search open tabs, recent files and folder files"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelected(0);
          }}
          onKeyDown={onKeyDown}
          className="h-full min-w-0 flex-1 bg-transparent text-ui-lg text-fg outline-none placeholder:text-fg-subtle focus-visible:outline-none"
        />
      </div>
      <div
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label="Files"
        className="min-h-0 flex-1 overflow-y-auto p-1.5"
      >
        {results.length === 0 && (
          <p className="px-3 py-8 text-center text-ui text-fg-muted">
            {items.length === 0 ? 'Open a file or folder to search it here.' : 'No matching files.'}
          </p>
        )}
        {results.map((result, index) => {
          const previous = results[index - 1];
          const showHeader = grouped && previous?.item.group !== result.item.group;
          return (
            <div key={result.item.path} role="presentation">
              {showHeader && (
                <div
                  role="presentation"
                  className="px-2.5 pt-2 pb-1 text-ui-xs font-medium text-fg-subtle"
                >
                  {result.item.group}
                </div>
              )}
              <QuickOpenOption
                id={optionId(index)}
                index={index}
                result={result}
                selected={index === selected}
                showGroup={!grouped}
                onHover={setSelected}
                onChoose={() => {
                  choose(result);
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex h-8 shrink-0 items-center gap-4 border-t border-border px-3.5 text-ui-xs text-fg-subtle">
        <span className="flex items-center gap-1.5">
          <Kbd shortcut="↑" />
          <Kbd shortcut="↓" />
          to navigate
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd shortcut="Enter" />
          to open
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd shortcut="Esc" />
          to close
        </span>
      </div>
    </div>
  );
}

const QuickOpenOption = memo(function QuickOpenOption({
  id,
  index,
  result,
  selected,
  showGroup,
  onHover,
  onChoose,
}: {
  id: string;
  index: number;
  result: FuzzyResult<QuickOpenItem>;
  selected: boolean;
  showGroup: boolean;
  onHover: (index: number) => void;
  onChoose: () => void;
}) {
  const { item, indices } = result;
  const nameStart = item.text.length - item.name.length;
  const dir = item.text.slice(0, nameStart).replace(/[\\/]$/, '');
  const nameIndices = indices.filter((i) => i >= nameStart).map((i) => i - nameStart);
  const dirIndices = indices.filter((i) => i < dir.length);

  return (
    <div
      id={id}
      role="option"
      aria-selected={selected}
      data-index={index}
      tabIndex={-1}
      onPointerMove={() => {
        if (!selected) onHover(index);
      }}
      onClick={onChoose}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onChoose();
      }}
      className={clsx(
        'flex h-9 items-center gap-2.5 rounded-md px-2.5',
        selected ? 'bg-accent-subtle' : '',
        item.missing && 'opacity-60',
      )}
    >
      <FileText
        aria-hidden
        className={clsx('size-4 shrink-0', selected ? 'text-accent' : 'text-fg-subtle')}
      />
      <HighlightedText
        text={item.name}
        indices={nameIndices}
        className="shrink-0 truncate text-ui text-fg"
      />
      <HighlightedText
        text={dir}
        indices={dirIndices}
        className="min-w-0 flex-1 truncate text-ui-sm text-fg-subtle"
      />
      {showGroup && <span className="shrink-0 text-ui-xs text-fg-subtle">{item.group}</span>}
    </div>
  );
});
