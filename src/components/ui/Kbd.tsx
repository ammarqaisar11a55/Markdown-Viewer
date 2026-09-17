import { clsx } from 'clsx';

export interface KbdProps {
  /** A formatted shortcut such as "Ctrl+Shift+O"; each key is rendered separately. */
  shortcut: string;
  className?: string;
}

function splitKeys(shortcut: string): string[] {
  // "Ctrl++" → ["Ctrl", "+"]; "⌘⇧O" (macOS symbols) stays a single key cap.
  const keys: string[] = [];
  for (const part of shortcut.split('+')) {
    if (part === '') {
      if (keys.at(-1) !== '+') keys.push('+');
    } else {
      keys.push(part);
    }
  }
  return keys;
}

export function Kbd({ shortcut, className }: KbdProps) {
  return (
    <kbd className={clsx('inline-flex items-center gap-0.5 font-sans', className)}>
      {splitKeys(shortcut).map((key, index) => (
        <kbd
          // Keys may repeat ("Ctrl++"), so the position is part of the identity.
          key={`${key}-${index}`}
          className={clsx(
            'inline-flex h-5 min-w-5 items-center justify-center rounded-sm px-1',
            'border border-border border-b-border-strong bg-bg-inset',
            'tabular text-ui-xs font-medium text-fg-muted',
          )}
        >
          {key}
        </kbd>
      ))}
    </kbd>
  );
}
