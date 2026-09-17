import { clsx } from 'clsx';
import { useRef, type KeyboardEvent } from 'react';
import { useUi } from '@/stores/uiStore';
import { SIDEBAR_VIEWS, sidebarPanelId, sidebarTabId } from './sidebarViews';

export function SidebarViewSwitcher() {
  const view = useUi((s) => s.sidebarView);
  const setSidebarView = useUi((s) => s.setSidebarView);
  const listRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = SIDEBAR_VIEWS.findIndex((v) => v.value === view);
    let next: number;
    if (event.key === 'ArrowRight') next = index + 1;
    else if (event.key === 'ArrowLeft') next = index - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = SIDEBAR_VIEWS.length - 1;
    else return;
    event.preventDefault();
    const wrapped = (next + SIDEBAR_VIEWS.length) % SIDEBAR_VIEWS.length;
    const target = SIDEBAR_VIEWS[wrapped];
    if (!target) return;
    setSidebarView(target.value);
    listRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')[wrapped]?.focus();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label="Sidebar views"
      className="border-border bg-bg-inset mx-3 flex h-7 shrink-0 items-center gap-0.5 rounded-md border p-0.5"
    >
      {SIDEBAR_VIEWS.map(({ value, label, icon: Icon }) => {
        const selected = value === view;
        return (
          <button
            key={value}
            id={sidebarTabId(value)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={sidebarPanelId(value)}
            tabIndex={selected ? 0 : -1}
            onKeyDown={onKeyDown}
            onClick={() => {
              setSidebarView(value);
            }}
            className={clsx(
              'text-ui-sm flex h-full min-w-0 flex-1 items-center justify-center gap-1.5 rounded-sm font-medium',
              'transition-colors duration-100',
              selected
                ? 'bg-bg-elevated text-fg shadow-[0_0_0_1px_var(--border),0_1px_2px_rgb(0_0_0/0.06)]'
                : 'text-fg-muted hover:text-fg',
            )}
          >
            <Icon aria-hidden className="size-3.5 shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
