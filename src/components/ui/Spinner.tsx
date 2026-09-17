import { clsx } from 'clsx';

export interface SpinnerProps {
  /** Accessible label; omit when the spinner is decorative. */
  label?: string;
  className?: string;
}

export function Spinner({ label, className }: SpinnerProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className={clsx('animate-spinner size-4 text-fg-subtle', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
