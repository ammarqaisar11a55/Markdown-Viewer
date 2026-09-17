import { clsx } from 'clsx';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

export type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  label: string;
  /** Keyboard shortcut shown next to the label, e.g. "Ctrl+O". */
  shortcut?: string | undefined;
  side?: TooltipSide;
  /** Suppress the tooltip (e.g. when the element's text is fully visible). */
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

const OPEN_DELAY_MS = 400;
/** After a tooltip closes, the next one within this window opens instantly. */
const WARM_WINDOW_MS = 300;
const GAP = 6;
const MARGIN = 6;

let lastClosedAt = 0;

/** Initial style; the layout effect positions and reveals the bubble. */
const HIDDEN: CSSProperties = { visibility: 'hidden' };

function computePosition(
  anchor: DOMRect,
  tip: { width: number; height: number },
  side: TooltipSide,
): { left: number; top: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let resolved = side;
  if (side === 'bottom' && anchor.bottom + GAP + tip.height > vh - MARGIN) resolved = 'top';
  else if (side === 'top' && anchor.top - GAP - tip.height < MARGIN) resolved = 'bottom';
  else if (side === 'right' && anchor.right + GAP + tip.width > vw - MARGIN) resolved = 'left';
  else if (side === 'left' && anchor.left - GAP - tip.width < MARGIN) resolved = 'right';

  let left: number;
  let top: number;
  switch (resolved) {
    case 'top':
      top = anchor.top - GAP - tip.height;
      left = anchor.left + anchor.width / 2 - tip.width / 2;
      break;
    case 'bottom':
      top = anchor.bottom + GAP;
      left = anchor.left + anchor.width / 2 - tip.width / 2;
      break;
    case 'left':
      left = anchor.left - GAP - tip.width;
      top = anchor.top + anchor.height / 2 - tip.height / 2;
      break;
    case 'right':
      left = anchor.right + GAP;
      top = anchor.top + anchor.height / 2 - tip.height / 2;
      break;
  }
  left = Math.max(MARGIN, Math.min(left, vw - tip.width - MARGIN));
  top = Math.max(MARGIN, Math.min(top, vh - tip.height - MARGIN));
  return { left, top };
}

/**
 * Lightweight hover/focus tooltip. Wraps its trigger in an inline-flex span and
 * renders the bubble in a portal so it is never clipped by scroll containers.
 */
export function Tooltip({
  label,
  shortcut,
  side = 'bottom',
  disabled = false,
  className,
  children,
}: TooltipProps) {
  const id = useId();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const [open, setOpen] = useState(false);

  const clearTimer = () => {
    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  };

  const show = useCallback(() => {
    if (disabled) return;
    clearTimer();
    if (Date.now() - lastClosedAt < WARM_WINDOW_MS) {
      setOpen(true);
      return;
    }
    timerRef.current = window.setTimeout(() => {
      setOpen(true);
    }, OPEN_DELAY_MS);
  }, [disabled]);

  const hide = useCallback(() => {
    clearTimer();
    setOpen((wasOpen) => {
      if (wasOpen) lastClosedAt = Date.now();
      return false;
    });
  }, []);

  useEffect(() => clearTimer, []);

  const visible = open && !disabled;

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const tip = tipRef.current;
    if (!visible || !anchor || !tip) return;
    const { left, top } = computePosition(
      anchor.getBoundingClientRect(),
      { width: tip.offsetWidth, height: tip.offsetHeight },
      side,
    );
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
    tip.style.visibility = 'visible';
  }, [visible, side, label, shortcut]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide();
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('blur', hide);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('blur', hide);
    };
  }, [visible, hide]);

  return (
    <span
      ref={anchorRef}
      className={clsx('inline-flex', className)}
      aria-describedby={visible ? id : undefined}
      onPointerEnter={(event) => {
        if (event.pointerType !== 'touch') show();
      }}
      onPointerLeave={hide}
      onPointerDown={hide}
      onFocus={(event) => {
        if (event.target instanceof HTMLElement && event.target.matches(':focus-visible')) show();
      }}
      onBlur={hide}
    >
      {children}
      {visible &&
        createPortal(
          <div
            ref={tipRef}
            id={id}
            role="tooltip"
            style={HIDDEN}
            className={clsx(
              'animate-fade-in pointer-events-none fixed z-[100] flex max-w-80 items-center gap-2',
              'border-border bg-bg-elevated text-ui-sm text-fg rounded-md border px-2 py-1',
              'shadow-(--shadow-popover)',
            )}
          >
            <span className="break-words">{label}</span>
            {shortcut && (
              <span className="text-ui-xs text-fg-subtle tabular shrink-0 font-sans">
                {shortcut}
              </span>
            )}
          </div>,
          document.body,
        )}
    </span>
  );
}
