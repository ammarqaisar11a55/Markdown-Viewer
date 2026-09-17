import { create } from 'zustand';
import { loadPersisted, savePersisted } from '@/lib/platform/storage';
import type { Settings } from '@/types';

export const SETTINGS_KEY = 'settings';
export const FONT_SIZE_RANGE = { min: 14, max: 24, step: 1 } as const;
export const CODE_FONT_SIZE_RANGE = { min: 11, max: 20, step: 1 } as const;

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  theme: 'system',
  fontSize: 16,
  contentWidth: 'medium',
  codeFontSize: 14,
  readingFont: 'sans',
  restoreSession: true,
  openInNewTab: true,
  autoReload: false,
  rememberRecent: true,
  showAllFiles: false,
  syntaxHighlighting: true,
  lineNumbers: false,
  renderHtml: true,
  externalLinks: 'open',
  loadRemoteImages: true,
});

const ENUMS = {
  theme: ['system', 'light', 'dark'],
  contentWidth: ['narrow', 'medium', 'wide', 'full'],
  readingFont: ['sans', 'serif'],
  externalLinks: ['open', 'ask'],
} as const satisfies Partial<Record<keyof Settings, readonly string[]>>;

type EnumKey = keyof typeof ENUMS;
type BooleanKey = {
  [K in keyof Settings]: Settings[K] extends boolean ? K : never;
}[keyof Settings];

const BOOLEAN_KEYS: readonly BooleanKey[] = [
  'restoreSession',
  'openInNewTab',
  'autoReload',
  'rememberRecent',
  'showAllFiles',
  'syntaxHighlighting',
  'lineNumbers',
  'renderHtml',
  'loadRemoteImages',
];

function clamp(value: unknown, range: { min: number; max: number }, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(range.max, Math.max(range.min, Math.round(value)));
}

/** Validates arbitrary (persisted or partial) input into a complete `Settings`. */
export function sanitizeSettings(input: unknown, base: Settings = DEFAULT_SETTINGS): Settings {
  const raw = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  const result: Settings = { ...base };
  for (const key of Object.keys(ENUMS) as EnumKey[]) {
    const value = raw[key];
    if (typeof value === 'string' && (ENUMS[key] as readonly string[]).includes(value)) {
      Object.assign(result, { [key]: value });
    }
  }
  for (const key of BOOLEAN_KEYS) {
    const value = raw[key];
    if (typeof value === 'boolean') result[key] = value;
  }
  if ('fontSize' in raw) result.fontSize = clamp(raw.fontSize, FONT_SIZE_RANGE, base.fontSize);
  if ('codeFontSize' in raw) {
    result.codeFontSize = clamp(raw.codeFontSize, CODE_FONT_SIZE_RANGE, base.codeFontSize);
  }
  return result;
}

function pickSettings(state: Settings): Settings {
  return sanitizeSettings(state);
}

export interface SettingsState extends Settings {
  updateSettings: (partial: Partial<Settings>) => void;
  resetSettings: () => void;
}

export const useSettings = create<SettingsState>()((set, get) => ({
  ...DEFAULT_SETTINGS,
  updateSettings: (partial) => {
    const next = sanitizeSettings(partial, pickSettings(get()));
    set(next);
    savePersisted(SETTINGS_KEY, next);
  },
  resetSettings: () => {
    set({ ...DEFAULT_SETTINGS });
    savePersisted(SETTINGS_KEY, { ...DEFAULT_SETTINGS });
  },
}));

export const { updateSettings, resetSettings } = useSettings.getState();

export function getSettings(): Settings {
  return pickSettings(useSettings.getState());
}

export async function hydrateSettings(): Promise<void> {
  const stored = await loadPersisted<unknown>(SETTINGS_KEY, null);
  useSettings.setState(sanitizeSettings(stored));
}
