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
    <div className="flex flex-col items-center px-6 pt-12 pb-6 text-center">
      {icon && <div className="text-fg-subtle [&_svg]:size-7">{icon}</div>}
      <p className="mt-3 font-heading text-[17px] leading-tight font-semibold text-fg">{title}</p>
      {description && <p className="mt-1 text-ui-sm text-fg-muted">{description}</p>}
      {children && <div className="mt-4 flex flex-col items-center gap-2">{children}</div>}
    </div>
  );
}
