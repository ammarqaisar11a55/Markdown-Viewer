import { clsx } from 'clsx';
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { clampMenuPosition } from './menuPosition';
import { closeContextMenu, useContextMenu, type ContextMenuItem } from '@/stores/contextMenuStore';

type ActionItem = Exclude<ContextMenuItem, { type: 'separator' }>;

function isAction(item: ContextMenuItem): item is ActionItem {
  return item.type !== 'separator';
}

/** Renders the global context menu from `useContextMenu`. */
export function ContextMenu() {
  const open = useContextMenu((s) => s.open);
  if (!open) return null;
  return createPortal(<ContextMenuPanel />, document.body);
}

function ContextMenuPanel() {
  const x = useContextMenu((s) => s.x);
  const y = useContextMenu((s) => s.y);
  const items = useContextMenu((s) => s.items);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    setPosition(
      clampMenuPosition(
        x,
        y,
        menu.offsetWidth,
        menu.offsetHeight,
        window.innerWidth,
        window.innerHeight,
      ),
    );
    setActiveIndex(-1);
    menu.focus({ preventScroll: true });
  }, [x, y, items]);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) closeContextMenu();
    };
    const onScroll = (event: Event) => {
      if (!menuRef.current?.contains(event.target as Node)) closeContextMenu();
    };
    const close = () => {
      closeContextMenu();
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('wheel', onScroll, { capture: true, passive: true });
    window.addEventListener('resize', close);
    window.addEventListener('blur', close);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('wheel', onScroll, { capture: true });
      window.removeEventListener('resize', close);
      window.removeEventListener('blur', close);
      const active = document.activeElement;
      if (previous?.isConnected && (active === null || active === document.body)) {
        previous.focus({ preventScroll: true });
      }
    };
  }, []);

  const move = (from: number, delta: 1 | -1) => {
    const count = items.length;
    for (let step = 1; step <= count; step++) {
      const index = (((from + delta * step) % count) + count) % count;
      const item = items[index];
      if (item && isAction(item) && !item.disabled) return index;
    }
    return from;
  };

  const select = (item: ContextMenuItem | undefined) => {
    if (!item || !isAction(item) || item.disabled) return;
    closeContextMenu();
    item.onSelect();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        setActiveIndex((index) => move(index < 0 ? -1 : index, 1));
        break;
      case 'ArrowUp':
        setActiveIndex((index) => move(index < 0 ? items.length : index, -1));
        break;
      case 'Home':
        setActiveIndex(move(-1, 1));
        break;
      case 'End':
        setActiveIndex(move(items.length, -1));
        break;
      case 'Enter':
      case ' ':
        select(items[activeIndex]);
        break;
      case 'Escape':
      case 'Tab':
        closeContextMenu();
        break;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  const activeId = activeIndex >= 0 ? `context-menu-item-${activeIndex}` : undefined;

  return (
    <div
      ref={menuRef}
      role="menu"
      tabIndex={-1}
      aria-activedescendant={activeId}
      aria-orientation="vertical"
      onKeyDown={onKeyDown}
      onContextMenu={(event) => {
        event.preventDefault();
      }}
      style={
        position
          ? { left: position.left, top: position.top }
          : { left: x, top: y, visibility: 'hidden' }
      }
      className={clsx(
        'animate-pop-in fixed z-[90] max-h-[calc(100vh-8px)] max-w-80 min-w-48 overflow-y-auto',
        'rounded-md border border-border bg-bg-elevated p-1 text-ui text-fg',
        'shadow-(--shadow-popover) focus-visible:outline-none',
      )}
    >
      {items.map((item, index) => {
        if (!isAction(item)) {
          return (
            <div
              // Separators have no identity of their own.
              key={`separator-${index}`}
              role="separator"
              className="mx-1 my-1 h-px bg-border"
            />
          );
        }
        const active = index === activeIndex;
        return (
          <div
            key={item.id}
            id={`context-menu-item-${index}`}
            role="menuitem"
            aria-disabled={item.disabled ?? undefined}
            tabIndex={-1}
            onPointerMove={() => {
              if (!item.disabled && activeIndex !== index) setActiveIndex(index);
            }}
            onPointerLeave={() => {
              setActiveIndex(-1);
            }}
            onClick={() => {
              select(item);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                select(item);
              }
            }}
            className={clsx(
              'flex h-7 items-center gap-6 rounded-sm px-2',
              item.disabled && 'cursor-default text-fg-subtle',
              !item.disabled && item.danger && 'text-danger',
              active && (item.danger ? 'bg-danger-subtle' : 'bg-accent text-accent-fg'),
            )}
          >
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.shortcut && (
              <span
                className={clsx(
                  'tabular shrink-0 text-ui-sm',
                  active && !item.danger ? 'text-accent-fg/80' : 'text-fg-subtle',
                )}
              >
                {item.shortcut}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
