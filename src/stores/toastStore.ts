import { create } from 'zustand';

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export interface ToastAction {
  label: string;
  onClick: () => void;
  primary?: boolean;
}

export interface ToastOptions {
  title: string;
  description?: string;
  variant: ToastVariant;
  actions?: ToastAction[];
  /** Auto-dismiss delay; `null` keeps the toast until dismissed. */
  durationMs?: number | null;
  /** Reusing an id replaces the existing toast. */
  id?: string;
}

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  actions: ToastAction[];
  durationMs: number | null;
  createdAt: number;
}

export const MAX_TOASTS = 5;
const DEFAULT_DURATION: Record<ToastVariant, number> = {
  info: 5000,
  success: 4000,
  warning: 7000,
  error: 8000,
};

export const useToasts = create<{ toasts: Toast[] }>()(() => ({ toasts: [] }));

export function toast(options: ToastOptions): string {
  const id = options.id ?? crypto.randomUUID();
  const next: Toast = {
    id,
    title: options.title,
    variant: options.variant,
    actions: options.actions ?? [],
    durationMs:
      options.durationMs === undefined ? DEFAULT_DURATION[options.variant] : options.durationMs,
    createdAt: Date.now(),
    ...(options.description === undefined ? {} : { description: options.description }),
  };
  useToasts.setState(({ toasts }) => {
    const index = toasts.findIndex((t) => t.id === id);
    if (index !== -1) return { toasts: toasts.map((t, i) => (i === index ? next : t)) };
    return { toasts: [...toasts, next].slice(-MAX_TOASTS) };
  });
  return id;
}

export function dismissToast(id: string): void {
  useToasts.setState(({ toasts }) =>
    toasts.some((t) => t.id === id) ? { toasts: toasts.filter((t) => t.id !== id) } : {},
  );
}
