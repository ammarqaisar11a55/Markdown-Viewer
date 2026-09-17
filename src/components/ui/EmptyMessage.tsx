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
      {icon && <div className="mb-3 text-fg-subtle [&_svg]:size-5">{icon}</div>}
      <p className="text-ui font-medium text-fg-muted">{title}</p>
      {description && <p className="mt-1 text-ui-sm text-fg-subtle">{description}</p>}
      {children && <div className="mt-4 flex flex-col items-center gap-2">{children}</div>}
    </div>
  );
}
