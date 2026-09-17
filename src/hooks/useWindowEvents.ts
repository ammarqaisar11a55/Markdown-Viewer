import { useEffect } from 'react';
import { ensureWindowTracking } from '@/features/window/tracking';

/**
 * Ensures window size / fullscreen / focus tracking is active. `bootstrap()`
 * already starts it; the hook makes components that rely on `useUi().windowWidth`
 * or `isFullscreen` self-sufficient (tracking is idempotent).
 */
export function useWindowEvents(): void {
  useEffect(() => {
    ensureWindowTracking();
  }, []);
}
