import { clsx } from 'clsx';

export interface AppMarkProps {
  className?: string;
}

/** The application mark: an "M↓" on the accent square (matches the app icon). */
export function AppMark({ className }: AppMarkProps) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={clsx('shrink-0', className)}>
      <rect width="64" height="64" rx="14" fill="#2f6fde" />
      <g fill="none" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 43V21l9.5 11L32 21v22" />
        <path d="M45 21v21" />
        <path d="M38 35l7 7 7-7" />
      </g>
    </svg>
  );
}
