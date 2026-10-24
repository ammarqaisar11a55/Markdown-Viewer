import { clsx } from 'clsx';
import { ListTree } from 'lucide-react';
import { memo, useEffect, useMemo, useRef, type KeyboardEvent } from 'react';
import { selectActiveTab, useDocuments } from '@/stores/documentsStore';
import { scrollToHeading, useViewer } from '@/stores/viewerStore';
import type { Heading } from '@/types';
import { EmptyMessage } from '@/components/ui/EmptyMessage';
import { findByData } from '@/components/ui/dom';
import { SidebarPanelHeader } from './SidebarPanelHeader';

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

  const count = headings.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SidebarPanelHeader title="Outline">
        {count > 0 && (
          <span className="shrink-0 pr-1 text-ui-xs text-fg-muted">
            {count === 1 ? '1 heading' : `${count} headings`}
          </span>
        )}
      </SidebarPanelHeader>

      {!hasDocument ? (
        <EmptyMessage
          icon={<ListTree />}
          title="No outline"
          description="Open a document to see its headings."
        />
      ) : count === 0 ? (
        <EmptyMessage
          icon={<ListTree />}
          title="No headings"
          description="This document has no headings."
        />
      ) : (
        <nav
          aria-label="Document outline"
          className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2 pt-2 pb-6"
        >
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
      )}
    </div>
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
        style={{ paddingLeft: 10 + depth * INDENT_PX }}
        className={clsx(
          'focus-inset relative flex min-h-7 w-full min-w-0 items-center py-[5px] pr-2 text-left',
          'transition-colors duration-100',
          active ? 'mv-bar-left bg-accent-subtle text-accent' : 'hover:bg-bg-muted',
          !active && (depth === 0 ? 'text-fg' : 'text-fg-muted hover:text-fg'),
          depth === 0 && 'font-medium',
        )}
      >
        <span className="truncate">{heading.text}</span>
      </button>
    </li>
  );
});
