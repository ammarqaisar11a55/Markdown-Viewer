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
            'inline-flex h-[19px] min-w-5 items-center justify-center px-[5px]',
            // A drawn key cap: hairline box with a doubled bottom rule.
            'border border-b-2 border-border bg-transparent',
            'tabular text-ui-xs font-medium text-fg-muted',
          )}
        >
          {key}
        </kbd>
      ))}
    </kbd>
  );
}
