import { clsx } from 'clsx';
import { CircleCheck, CircleX, Info, TriangleAlert, X } from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import { dismissToast, useToasts, type Toast, type ToastVariant } from '@/stores/toastStore';

const ICONS: Record<ToastVariant, typeof Info> = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  error: CircleX,
};

const ICON_COLORS: Record<ToastVariant, string> = {
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-danger',
};

/** Renders active toasts in the bottom-right corner. */
export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <section
      aria-label="Notifications"
      className="pointer-events-none fixed right-4 bottom-10 z-[80] flex w-[360px] max-w-[calc(100vw-32px)] flex-col items-stretch gap-2"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </section>
  );
}

const ToastItem = memo(function ToastItem({ toast }: { toast: Toast }) {
  const [paused, setPaused] = useState(false);
  const remainingRef = useRef(toast.durationMs);

  useEffect(() => {
    remainingRef.current = toast.durationMs;
  }, [toast.durationMs, toast.createdAt]);

  useEffect(() => {
    const remaining = remainingRef.current;
    if (paused || remaining === null) return;
    const startedAt = Date.now();
    const timer = window.setTimeout(() => {
      dismissToast(toast.id);
    }, remaining);
    return () => {
      window.clearTimeout(timer);
      remainingRef.current = Math.max(1000, remaining - (Date.now() - startedAt));
    };
  }, [paused, toast.id, toast.createdAt]);

  const Icon = ICONS[toast.variant];
  const isError = toast.variant === 'error' || toast.variant === 'warning';

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      aria-atomic="true"
      onPointerEnter={() => {
        setPaused(true);
      }}
      onPointerLeave={() => {
        setPaused(false);
      }}
      onFocus={() => {
        setPaused(true);
      }}
      onBlur={() => {
        setPaused(false);
      }}
      className={clsx(
        'animate-toast-in theme-surface pointer-events-auto flex gap-2.5 rounded-lg border border-border',
        'bg-bg-elevated py-2.5 pr-2 pl-3 text-ui text-fg shadow-(--shadow-popover)',
      )}
    >
      <Icon aria-hidden className={clsx('mt-0.5 size-4 shrink-0', ICON_COLORS[toast.variant])} />
      <div className="min-w-0 flex-1">
        <p className="font-medium break-words">{toast.title}</p>
        {toast.description && (
          <p className="selectable mt-0.5 text-ui-sm break-words text-fg-muted">
            {toast.description}
          </p>
        )}
        {toast.actions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {toast.actions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => {
                  dismissToast(toast.id);
                  action.onClick();
                }}
                className={clsx(
                  'h-6 rounded-sm px-2 text-ui-sm font-medium transition-colors duration-100',
                  action.primary
                    ? 'bg-accent text-accent-fg hover:brightness-[1.06]'
                    : 'border border-border-strong/80 text-fg hover:bg-bg-muted',
                )}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => {
          dismissToast(toast.id);
        }}
        className="flex size-6 shrink-0 items-center justify-center rounded-sm text-fg-subtle transition-colors duration-100 hover:bg-bg-muted hover:text-fg"
      >
        <X aria-hidden className="size-3.5" />
      </button>
    </div>
  );
});
