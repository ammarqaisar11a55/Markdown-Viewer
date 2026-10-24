import { clsx } from 'clsx';
import { useRef, type KeyboardEvent } from 'react';

export interface SettingsNavSection {
  id: string;
  title: string;
}

export interface SettingsNavProps {
  sections: readonly SettingsNavSection[];
  active: string;
  onSelect: (id: string) => void;
  /** Id of the tab button for a section, so the pane can be labelled by it. */
  tabId: (id: string) => string;
  /** Id of the single pane the tabs drive. */
  panelId: string;
}

const pad2 = (index: number) => String(index + 1).padStart(2, '0');

/**
 * The numbered section list down the left of the Settings dialog: a vertical
 * tab list with roving focus, arrow keys and a 2px accent bar on the active
 * entry.
 */
export function SettingsNav({ sections, active, onSelect, tabId, panelId }: SettingsNavProps) {
  const listRef = useRef<HTMLDivElement>(null);

  const select = (index: number) => {
    const section = sections[index];
    if (!section) return;
    onSelect(section.id);
    listRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')[index]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = sections.findIndex((section) => section.id === active);
    let next = -1;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = index + 1;
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = index - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = sections.length - 1;
    else return;
    event.preventDefault();
    select((next + sections.length) % sections.length);
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-orientation="vertical"
      aria-label="Settings sections"
      className="w-50 shrink-0 border-r border-border px-2 py-3.5"
    >
      {sections.map((section, index) => {
        const selected = section.id === active;
        return (
          <button
            key={section.id}
            id={tabId(section.id)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            onKeyDown={onKeyDown}
            onClick={() => {
              onSelect(section.id);
            }}
            className={clsx(
              'focus-inset flex h-9 w-full items-center gap-2.5 px-3 text-left transition-colors duration-100',
              selected
                ? 'mv-bar-left bg-accent-subtle text-fg'
                : 'text-fg-muted hover:bg-bg-muted hover:text-fg',
            )}
          >
            <span
              aria-hidden
              className={clsx('mv-num text-ui-xs', selected ? 'text-accent' : 'text-fg-subtle')}
            >
              {pad2(index)}
            </span>
            <span className="truncate font-heading text-[16px] font-semibold">{section.title}</span>
          </button>
        );
      })}
    </div>
  );
}
