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

/*
 * Buttons are wireframe objects: square, hairline-bordered, condensed label.
 * The primary is the one solid object on the board — an accent fill that keeps
 * the square corners and wears the `+` registration marks.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'mv-marks border border-accent-solid bg-accent-solid text-accent-solid-fg hover:bg-accent-solid-hover active:bg-accent-solid-active',
  secondary:
    'border border-border bg-transparent text-fg hover:bg-bg-muted hover:border-border-strong active:bg-bg-inset',
  ghost: 'border border-transparent bg-transparent text-accent hover:bg-accent-subtle',
  danger:
    'border border-border bg-transparent text-danger hover:bg-danger-subtle hover:border-danger/50',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-7 gap-1.5 px-2.5 text-ui [&_svg]:size-3.5',
  md: 'h-8 gap-2 px-3.5 text-ui-lg [&_svg]:size-4',
};

const buttonClassName = (variant: ButtonVariant, size: ButtonSize) =>
  clsx(
    'inline-flex shrink-0 items-center justify-center font-heading font-semibold whitespace-nowrap',
    'transition-[background-color,border-color,color] duration-100',
    'disabled:pointer-events-none disabled:opacity-45',
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
