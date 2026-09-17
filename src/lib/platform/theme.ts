import type { ResolvedTheme, ThemePreference } from '@/types';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function darkQuery(): MediaQueryList | null {
  return typeof window.matchMedia === 'function' ? window.matchMedia(DARK_QUERY) : null;
}

export function getSystemTheme(): ResolvedTheme {
  return darkQuery()?.matches === true ? 'dark' : 'light';
}

export function subscribeSystemTheme(onChange: () => void): () => void {
  const query = darkQuery();
  if (query === null) return () => undefined;
  query.addEventListener('change', onChange);
  return () => {
    query.removeEventListener('change', onChange);
  };
}

export function resolveTheme(
  preference: ThemePreference,
  system: ResolvedTheme = getSystemTheme(),
): ResolvedTheme {
  return preference === 'system' ? system : preference;
}
