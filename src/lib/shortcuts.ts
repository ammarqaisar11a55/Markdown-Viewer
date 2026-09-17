// Keyboard shortcut parsing, matching and formatting. `Mod` is Ctrl on
// Windows/Linux and Cmd on macOS.

export type Platform = 'mac' | 'windows' | 'linux';

export interface Shortcut {
  /** Lower-case single character (`o`, `+`, `/`) or a named key (`Tab`, `F5`). */
  key: string;
  mod: boolean;
  shift: boolean;
  alt: boolean;
}

export interface KeyEventLike {
  key: string;
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'linux';
  const source = `${navigator.platform} ${navigator.userAgent}`.toLowerCase();
  if (/mac|iphone|ipad/.test(source)) return 'mac';
  if (source.includes('win')) return 'windows';
  return 'linux';
}

export const currentPlatform: Platform = detectPlatform();
export const isMac: boolean = currentPlatform === 'mac';

const NAMED_KEYS: Record<string, string> = {
  esc: 'Escape',
  escape: 'Escape',
  enter: 'Enter',
  return: 'Enter',
  tab: 'Tab',
  space: ' ',
  pageup: 'PageUp',
  pagedown: 'PageDown',
  home: 'Home',
  end: 'End',
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  backspace: 'Backspace',
  delete: 'Delete',
  plus: '+',
  minus: '-',
};

function normalizeKey(key: string): string {
  if (key.length === 1) return key.toLowerCase();
  const named = NAMED_KEYS[key.toLowerCase()];
  if (named !== undefined) return named;
  if (/^f\d{1,2}$/i.test(key)) return key.toUpperCase();
  return key;
}

export function parseShortcut(value: string): Shortcut {
  const trimmed = value.trim();
  // A trailing "++" means the "+" key itself (e.g. "Mod++").
  const plusKey = trimmed.endsWith('++') || trimmed === '+';
  const parts = (plusKey ? trimmed.replace(/\+?\+$/, '') : trimmed).split('+').filter(Boolean);
  const keyPart = plusKey ? '+' : parts.pop();
  if (keyPart === undefined) throw new Error(`Invalid shortcut: "${value}"`);
  const shortcut: Shortcut = { key: normalizeKey(keyPart), mod: false, shift: false, alt: false };
  for (const part of parts) {
    switch (part.toLowerCase()) {
      case 'mod':
      case 'ctrl':
      case 'control':
      case 'cmd':
      case 'meta':
        shortcut.mod = true;
        break;
      case 'shift':
        shortcut.shift = true;
        break;
      case 'alt':
      case 'option':
        shortcut.alt = true;
        break;
      default:
        throw new Error(`Invalid modifier "${part}" in shortcut "${value}"`);
    }
  }
  return shortcut;
}

const ASCII_ALNUM = /^[a-z0-9]$/;

/** Letter/digit from a physical key code, for non-Latin layouts. */
function keyFromCode(code: string): string | null {
  const letter = /^Key([A-Z])$/.exec(code);
  if (letter?.[1] !== undefined) return letter[1].toLowerCase();
  const digit = /^(?:Digit|Numpad)(\d)$/.exec(code);
  return digit?.[1] ?? null;
}

function isPunctuation(key: string): boolean {
  return key.length === 1 && !ASCII_ALNUM.test(key);
}

export function matchesShortcut(
  event: KeyEventLike,
  shortcut: Shortcut,
  platform: Platform = currentPlatform,
): boolean {
  const modPressed = platform === 'mac' ? event.metaKey : event.ctrlKey;
  const otherPressed = platform === 'mac' ? event.ctrlKey : event.metaKey;
  if (modPressed !== shortcut.mod || otherPressed || event.altKey !== shortcut.alt) return false;

  const eventKey = normalizeKey(event.key);
  // Punctuation often needs Shift on some layouts ("+" on US, "=" on German).
  const shiftMatters = !(isPunctuation(shortcut.key) && !shortcut.shift);
  if (shiftMatters && event.shiftKey !== shortcut.shift) return false;

  if (eventKey === shortcut.key) return true;
  if (ASCII_ALNUM.test(shortcut.key) && !ASCII_ALNUM.test(eventKey)) {
    return keyFromCode(event.code) === shortcut.key;
  }
  return false;
}

const MAC_SYMBOLS: Record<string, string> = {
  Escape: '⎋',
  Enter: '↩',
  Tab: '⇥',
  Backspace: '⌫',
  Delete: '⌦',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  PageUp: '⇞',
  PageDown: '⇟',
};

const KEY_LABELS: Record<string, string> = {
  ' ': 'Space',
  '+': 'Plus',
  Escape: 'Esc',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
};

export function formatShortcut(
  shortcut: Shortcut | string,
  platform: Platform = currentPlatform,
): string {
  const parsed = typeof shortcut === 'string' ? parseShortcut(shortcut) : shortcut;
  const key = parsed.key.length === 1 ? parsed.key.toUpperCase() : parsed.key;
  if (platform === 'mac') {
    const symbols = `${parsed.alt ? '⌥' : ''}${parsed.shift ? '⇧' : ''}${parsed.mod ? '⌘' : ''}`;
    return symbols + (MAC_SYMBOLS[parsed.key] ?? KEY_LABELS[parsed.key] ?? key);
  }
  const parts: string[] = [];
  if (parsed.mod) parts.push('Ctrl');
  if (parsed.alt) parts.push('Alt');
  if (parsed.shift) parts.push('Shift');
  parts.push(KEY_LABELS[parsed.key] ?? key);
  return parts.join('+');
}
