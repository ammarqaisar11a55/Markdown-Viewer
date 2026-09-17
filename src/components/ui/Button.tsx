import { clsx } from 'clsx';
import type { ComponentPropsWithRef, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Optional leading icon (sized by the button). */
  icon?: ReactNode;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-accent-fg hover:brightness-[1.06] active:brightness-95 border border-transparent',
  secondary:
    'bg-bg-elevated text-fg border border-border-strong/80 hover:bg-bg-muted active:bg-bg-muted',
  ghost: 'text-fg-muted border border-transparent hover:bg-bg-muted hover:text-fg',
  danger:
    'bg-bg-elevated text-danger border border-border-strong/80 hover:bg-danger-subtle hover:border-danger/40',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-7 gap-1.5 px-2.5 text-ui-sm [&_svg]:size-3.5',
  md: 'h-8 gap-2 px-3 text-ui [&_svg]:size-4',
};

const buttonClassName = (variant: ButtonVariant, size: ButtonSize) =>
  clsx(
    'inline-flex shrink-0 items-center justify-center rounded-md font-medium whitespace-nowrap',
    'transition-[background-color,border-color,color,filter] duration-100',
    'disabled:pointer-events-none disabled:opacity-50',
    VARIANTS[variant],
    SIZES[size],
  );

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={clsx(buttonClassName(variant, size), className)} {...rest}>
      {icon}
      {children}
    </button>
  );
}
