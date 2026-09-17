import type { ReactNode } from 'react';

export interface EmptyMessageProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
}

/** Quiet, centered placeholder used inside sidebar panels. */
export function EmptyMessage({ icon, title, description, children }: EmptyMessageProps) {
  return (
    <div className="flex flex-col items-center px-6 pt-10 pb-6 text-center">
      {icon && <div className="text-fg-subtle mb-3 [&_svg]:size-5">{icon}</div>}
      <p className="text-ui text-fg-muted font-medium">{title}</p>
      {description && <p className="text-ui-sm text-fg-subtle mt-1">{description}</p>}
      {children && <div className="mt-4 flex flex-col items-center gap-2">{children}</div>}
    </div>
  );
}
