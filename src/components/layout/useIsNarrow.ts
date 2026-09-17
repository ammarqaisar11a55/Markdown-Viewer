import { useUi } from '@/stores/uiStore';

/** Below this window width the sidebar overlays the content instead of pushing it. */
export const NARROW_BREAKPOINT = 900;

export function useIsNarrow(): boolean {
  return useUi((s) => s.windowWidth < NARROW_BREAKPOINT);
}
