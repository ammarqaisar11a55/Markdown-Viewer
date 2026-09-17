import { useEffect, useSyncExternalStore } from 'react';
import { getSystemTheme, resolveTheme, subscribeSystemTheme } from '@/lib/platform/theme';
import { useSettings } from '@/stores/settingsStore';
import { useUi } from '@/stores/uiStore';
import type { ContentWidth, ResolvedTheme } from '@/types';

export const CONTENT_WIDTHS: Record<ContentWidth, string> = {
  narrow: '640px',
  medium: '760px',
  wide: '960px',
  full: 'none',
};

export function useResolvedTheme(): ResolvedTheme {
  const preference = useSettings((s) => s.theme);
  const system = useSyncExternalStore(subscribeSystemTheme, getSystemTheme, () => 'light' as const);
  return resolveTheme(preference, system);
}

/** Applies theme and reading typography settings to the document root. */
export function useThemeEffect(): void {
  const theme = useResolvedTheme();
  const fontSize = useSettings((s) => s.fontSize);
  const codeFontSize = useSettings((s) => s.codeFontSize);
  const contentWidth = useSettings((s) => s.contentWidth);
  const readingFont = useSettings((s) => s.readingFont);
  const lineNumbers = useSettings((s) => s.lineNumbers);
  const zoom = useUi((s) => s.zoom);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--md-font-size', `${fontSize}px`);
    root.style.setProperty('--md-code-font-size', `${codeFontSize}px`);
    root.style.setProperty('--md-zoom', String(zoom));
    root.style.setProperty('--md-content-width', CONTENT_WIDTHS[contentWidth]);
    root.dataset.readingFont = readingFont;
    root.dataset.lineNumbers = String(lineNumbers);
  }, [fontSize, codeFontSize, zoom, contentWidth, readingFont, lineNumbers]);
}
