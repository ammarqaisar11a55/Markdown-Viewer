import { clsx } from 'clsx';
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { SIDEBAR_WIDTH, useUi } from '@/stores/uiStore';

const STEP = 16;
const LARGE_STEP = 64;

/** Vertical splitter on the sidebar's right edge (pointer + keyboard). */
export function ResizeHandle({ controls }: { controls: string }) {
  const width = useUi((s) => s.sidebarWidth);
  const setSidebarWidth = useUi((s) => s.setSidebarWidth);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startX: event.clientX, startWidth: width };
    setDragging(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    setSidebarWidth(drag.startWidth + event.clientX - drag.startX);
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? LARGE_STEP : STEP;
    let next: number;
    switch (event.key) {
      case 'ArrowLeft':
        next = width - step;
        break;
      case 'ArrowRight':
        next = width + step;
        break;
      case 'Home':
        next = SIDEBAR_WIDTH.min;
        break;
      case 'End':
        next = SIDEBAR_WIDTH.max;
        break;
      case 'Enter':
        next = SIDEBAR_WIDTH.default;
        break;
      default:
        return;
    }
    event.preventDefault();
    setSidebarWidth(next);
  };

  return (
    // A focusable separator is the ARIA pattern for a keyboard-resizable splitter.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-controls={controls}
      aria-valuenow={width}
      aria-valuemin={SIDEBAR_WIDTH.min}
      aria-valuemax={SIDEBAR_WIDTH.max}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={() => {
        setSidebarWidth(SIDEBAR_WIDTH.default);
      }}
      onKeyDown={onKeyDown}
      className={clsx(
        'group absolute inset-y-0 -right-[3px] z-10 w-[6px] cursor-col-resize touch-none focus-visible:outline-none',
      )}
    >
      <div
        className={clsx(
          'mx-auto h-full w-[2px] transition-colors duration-150',
          dragging
            ? 'bg-accent'
            : 'group-hover:bg-accent/60 group-focus-visible:bg-accent bg-transparent',
        )}
      />
    </div>
  );
}
