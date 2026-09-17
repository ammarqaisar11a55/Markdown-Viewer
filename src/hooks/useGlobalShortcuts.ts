import { useEffect } from 'react';
import { commands, runCommand, type CommandId } from '@/app/commands';
import { matchesShortcut, parseShortcut, type KeyEventLike, type Shortcut } from '@/lib/shortcuts';

interface Binding {
  id: CommandId;
  shortcut: Shortcut;
  repeatable: boolean;
}

const BINDINGS: Binding[] = Object.values(commands).flatMap((command) =>
  command.shortcuts.map((value) => ({
    id: command.id,
    shortcut: parseShortcut(value),
    repeatable: command.repeatable === true,
  })),
);

/** Browser defaults that must never fire inside the app (reload, print, save…). */
const BLOCKED = [
  'F5',
  'Mod+R',
  'Mod+Shift+R',
  'Mod+P',
  'Mod+F',
  'Mod+S',
  'Mod+G',
  'Mod+Shift+G',
  'Mod+U',
].map(parseShortcut);

export function findBinding(event: KeyEventLike): Binding | undefined {
  return BINDINGS.find((binding) => matchesShortcut(event, binding.shortcut));
}

function isFunctionKey(key: string): boolean {
  return /^F\d{1,2}$/.test(key);
}

export function handleShortcutKeydown(event: KeyboardEvent): void {
  if (event.defaultPrevented || event.isComposing) return;
  // Plain typing (including inside inputs) is never intercepted; only
  // Ctrl/Cmd combinations and function keys are shortcuts.
  const hasModifier = event.ctrlKey || event.metaKey;
  if (!hasModifier && !isFunctionKey(event.key)) return;

  const binding = findBinding(event);
  if (binding === undefined) {
    if (BLOCKED.some((shortcut) => matchesShortcut(event, shortcut))) event.preventDefault();
    return;
  }
  event.preventDefault();
  if (event.repeat && !binding.repeatable) return;
  void runCommand(binding.id);
}

/** Routes global keyboard shortcuts to the command registry. */
export function useGlobalShortcuts(): void {
  useEffect(() => {
    window.addEventListener('keydown', handleShortcutKeydown);
    return () => {
      window.removeEventListener('keydown', handleShortcutKeydown);
    };
  }, []);
}
