import { clsx } from 'clsx';
import type { ComponentPropsWithRef, ReactNode } from 'react';
import { Tooltip, type TooltipSide } from './Tooltip';

export interface IconButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'children'> {
  /** Accessible name; also shown as the tooltip. */
  label: string;
  icon: ReactNode;
  shortcut?: string | undefined;
  size?: 'sm' | 'md';
  /** Renders the pressed/selected look. */
  active?: boolean;
  tooltipSide?: TooltipSide;
}

const SIZES = {
  sm: 'size-6 rounded-sm [&_svg]:size-3.5',
  md: 'size-7 rounded-md [&_svg]:size-4',
} as const;

export function IconButton({
  label,
  icon,
  shortcut,
  size = 'md',
  active = false,
  tooltipSide = 'bottom',
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <Tooltip label={label} shortcut={shortcut} side={tooltipSide}>
      <button
        type={type}
        aria-label={label}
        className={clsx(
          'inline-flex shrink-0 items-center justify-center transition-colors duration-100',
          'disabled:pointer-events-none disabled:opacity-40',
          active
            ? 'bg-accent-subtle text-accent'
            : 'text-fg-muted hover:bg-bg-muted hover:text-fg active:bg-bg-muted',
          SIZES[size],
          className,
        )}
        {...rest}
      >
        {icon}
      </button>
    </Tooltip>
  );
}
