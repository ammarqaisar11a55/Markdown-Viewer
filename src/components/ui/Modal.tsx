import { clsx } from 'clsx';
import { X } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { getFocusable, trapTab } from './focus';
import { IconButton } from './IconButton';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Visually hide the title (it still labels the dialog). */
  hideTitle?: boolean;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Scale of the visible title; `lg` is the Settings header. */
  titleSize?: 'md' | 'lg';
  /** Element focused when the dialog opens; defaults to the first tabbable. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Align the dialog towards the top (command-palette style). */
  placement?: 'center' | 'top';
  className?: string;
}

const WIDTHS = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' } as const;
const TITLE_SIZES = { md: 'text-[22px]', lg: 'text-[26px]' } as const;

export function Modal(props: ModalProps) {
  if (!props.open) return null;
  return createPortal(<ModalContent {...props} />, document.body);
}

function ModalContent({
  onClose,
  title,
  hideTitle = false,
  description,
  children,
  footer,
  size = 'md',
  titleSize = 'md',
  initialFocusRef,
  placement = 'center',
  className,
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    if (dialog) {
      const target = initialFocusRef?.current ?? getFocusable(dialog)[0] ?? dialog;
      target.focus({ preventScroll: true });
    }
    return () => {
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [initialFocusRef]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      trapTab(event, dialog);
    };
    dialog.addEventListener('keydown', onKeyDown);
    return () => {
      dialog.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <div
      className={clsx(
        'animate-fade-in fixed inset-0 z-50 flex justify-center bg-scrim p-6',
        placement === 'top' ? 'items-start pt-[12vh]' : 'items-center',
      )}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCloseRef.current();
      }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={clsx(
          // The frame draws its registration marks outside the box, so the
          // dialog itself must not clip; its body scrolls instead.
          'animate-pop-in mv-marks flex max-h-full w-full flex-col',
          'border border-border bg-bg-elevated text-fg shadow-(--shadow-modal)',
          WIDTHS[size],
          className,
        )}
      >
        {hideTitle ? (
          <h2 id={titleId} className="sr-only">
            {title}
          </h2>
        ) : (
          <header className="flex shrink-0 items-start gap-3 border-b border-border py-3.5 pr-4 pl-5">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className={clsx('leading-none uppercase', TITLE_SIZES[titleSize])}>
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className="mt-0.5 text-ui-sm text-fg-muted">
                  {description}
                </p>
              )}
            </div>
            <IconButton
              label="Close"
              shortcut="Esc"
              icon={<X />}
              onClick={() => {
                onCloseRef.current();
              }}
              className="-mr-1.5"
            />
          </header>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && (
          <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
