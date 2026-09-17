import { clsx } from 'clsx';
import { ListTree } from 'lucide-react';
import { memo, useEffect, useMemo, useRef, type KeyboardEvent } from 'react';
import { selectActiveTab, useDocuments } from '@/stores/documentsStore';
import { scrollToHeading, useViewer } from '@/stores/viewerStore';
import type { Heading } from '@/types';
import { EmptyMessage } from '@/components/ui/EmptyMessage';
import { findByData } from '@/components/ui/dom';

const INDENT_PX = 12;

export function OutlinePanel() {
  const hasDocument = useDocuments((s) => (selectActiveTab(s)?.doc ?? null) !== null);
  const headings = useViewer((s) => s.headings);
  const activeId = useViewer((s) => s.activeHeadingId);
  const listRef = useRef<HTMLUListElement>(null);

  const minLevel = useMemo(
    () => headings.reduce((min, heading) => Math.min(min, heading.level), 6),
    [headings],
  );

  useEffect(() => {
    if (activeId === null) return;
    const list = listRef.current;
    const item = findByData(list, 'heading-id', activeId);
    item?.scrollIntoView({ block: 'nearest' });
  }, [activeId]);

  if (!hasDocument) {
    return (
      <EmptyMessage
        icon={<ListTree />}
        title="No outline"
        description="Open a document to see its headings."
      />
    );
  }
  if (headings.length === 0) {
    return (
      <EmptyMessage
        icon={<ListTree />}
        title="No headings"
        description="This document has no headings."
      />
    );
  }

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const buttons = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>('button[data-heading-id]') ?? [],
    );
    const index = buttons.findIndex((button) => button === document.activeElement);
    let next: number;
    if (event.key === 'ArrowDown') next = Math.min(buttons.length - 1, index + 1);
    else if (event.key === 'ArrowUp') next = Math.max(0, index - 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = buttons.length - 1;
    else return;
    event.preventDefault();
    buttons[next]?.focus();
  };

  return (
    <nav aria-label="Document outline" className="px-2 pb-3">
      {/* Arrow-key navigation between entries; each entry is a native button. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <ul ref={listRef} onKeyDown={onKeyDown} className="flex flex-col">
        {headings.map((heading) => (
          <OutlineItem
            key={heading.id}
            heading={heading}
            depth={heading.level - minLevel}
            active={heading.id === activeId}
          />
        ))}
      </ul>
    </nav>
  );
}

const OutlineItem = memo(function OutlineItem({
  heading,
  depth,
  active,
}: {
  heading: Heading;
  depth: number;
  active: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        data-heading-id={heading.id}
        aria-current={active ? 'location' : undefined}
        title={heading.text}
        onClick={() => {
          scrollToHeading(heading.id);
        }}
        style={{ paddingLeft: 8 + depth * INDENT_PX }}
        className={clsx(
          'focus-inset relative flex h-7 w-full min-w-0 items-center rounded-md pr-2 text-left',
          'transition-colors duration-100',
          active ? 'bg-accent-subtle text-accent' : 'hover:bg-bg-muted',
          !active && (depth === 0 ? 'text-fg' : 'text-fg-muted hover:text-fg'),
          depth === 0 && 'font-medium',
        )}
      >
        <span className="truncate">{heading.text}</span>
      </button>
    </li>
  );
});
