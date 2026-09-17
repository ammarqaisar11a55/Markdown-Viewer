import { create } from 'zustand';
import { setMenuVisible } from '@/lib/platform/ipc';
import { logger } from '@/lib/platform/logger';
import { loadPersisted, savePersisted } from '@/lib/platform/storage';
import type { SidebarView } from '@/types';

export const UI_KEY = 'ui';
export const SIDEBAR_WIDTH = { min: 200, max: 520, default: 280 } as const;
export const ZOOM = { min: 0.6, max: 2, step: 0.1, default: 1 } as const;
const SIDEBAR_VIEWS: readonly SidebarView[] = ['outline', 'files', 'recent'];

export interface UiState {
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  sidebarView: SidebarView;
  readingMode: boolean;
  searchOpen: boolean;
  quickOpenOpen: boolean;
  settingsOpen: boolean;
  shortcutsOpen: boolean;
  aboutOpen: boolean;
  zoom: number;
  isFullscreen: boolean;
  windowWidth: number;
  /** Files are being dragged over the window. */
  dragActive: boolean;

  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  setSidebarView: (view: SidebarView) => void;
  setReadingMode: (on: boolean) => void;
  toggleReadingMode: () => void;
  setSearchOpen: (open: boolean) => void;
  setQuickOpenOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  setAboutOpen: (open: boolean) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  setFullscreen: (on: boolean) => void;
  setWindowWidth: (width: number) => void;
  setDragActive: (active: boolean) => void;
}

type PersistedUi = Pick<UiState, 'sidebarCollapsed' | 'sidebarWidth' | 'sidebarView' | 'zoom'>;

export function clampSidebarWidth(width: number): number {
  if (!Number.isFinite(width)) return SIDEBAR_WIDTH.default;
  return Math.round(Math.min(SIDEBAR_WIDTH.max, Math.max(SIDEBAR_WIDTH.min, width)));
}

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return ZOOM.default;
  const rounded = Math.round(zoom * 10) / 10;
  return Math.min(ZOOM.max, Math.max(ZOOM.min, rounded));
}

export const useUi = create<UiState>()((set, get) => ({
  sidebarCollapsed: false,
  sidebarWidth: SIDEBAR_WIDTH.default,
  sidebarView: 'outline',
  readingMode: false,
  searchOpen: false,
  quickOpenOpen: false,
  settingsOpen: false,
  shortcutsOpen: false,
  aboutOpen: false,
  zoom: ZOOM.default,
  isFullscreen: false,
  windowWidth: typeof window === 'undefined' ? 1280 : window.innerWidth,
  dragActive: false,

  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
  setSidebarWidth: (width) => set({ sidebarWidth: clampSidebarWidth(width) }),
  setSidebarView: (sidebarView) => set({ sidebarView }),
  setReadingMode: (readingMode) => {
    if (get().readingMode === readingMode) return;
    set({ readingMode });
    setMenuVisible(!readingMode).catch((err: unknown) => {
      logger.warn('Could not toggle the native menu', err);
    });
  },
  toggleReadingMode: () => get().setReadingMode(!get().readingMode),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  setQuickOpenOpen: (quickOpenOpen) => set({ quickOpenOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  setAboutOpen: (aboutOpen) => set({ aboutOpen }),
  zoomIn: () => set({ zoom: clampZoom(get().zoom + ZOOM.step) }),
  zoomOut: () => set({ zoom: clampZoom(get().zoom - ZOOM.step) }),
  resetZoom: () => set({ zoom: ZOOM.default }),
  setFullscreen: (isFullscreen) => set({ isFullscreen }),
  setWindowWidth: (windowWidth) => set({ windowWidth }),
  setDragActive: (dragActive) => set({ dragActive }),
}));

export const {
  setSidebarCollapsed,
  toggleSidebar,
  setSidebarWidth,
  setSidebarView,
  setReadingMode,
  toggleReadingMode,
  setSearchOpen,
  setQuickOpenOpen,
  setSettingsOpen,
  setShortcutsOpen,
  setAboutOpen,
  zoomIn,
  zoomOut,
  resetZoom,
  setFullscreen,
  setWindowWidth,
  setDragActive,
} = useUi.getState();

function pickPersisted(state: UiState): PersistedUi {
  return {
    sidebarCollapsed: state.sidebarCollapsed,
    sidebarWidth: state.sidebarWidth,
    sidebarView: state.sidebarView,
    zoom: state.zoom,
  };
}

function sanitizeUi(input: unknown): Partial<PersistedUi> {
  if (typeof input !== 'object' || input === null) return {};
  const raw = input as Record<string, unknown>;
  const out: Partial<PersistedUi> = {};
  if (typeof raw.sidebarCollapsed === 'boolean') out.sidebarCollapsed = raw.sidebarCollapsed;
  if (typeof raw.sidebarWidth === 'number') out.sidebarWidth = clampSidebarWidth(raw.sidebarWidth);
  if (typeof raw.zoom === 'number') out.zoom = clampZoom(raw.zoom);
  const view = raw.sidebarView;
  if (typeof view === 'string' && (SIDEBAR_VIEWS as readonly string[]).includes(view)) {
    out.sidebarView = view as SidebarView;
  }
  return out;
}

let persistUnsubscribe: (() => void) | null = null;

/** Loads the persisted UI subset and keeps it saved from then on. */
export async function hydrateUi(): Promise<void> {
  const stored = await loadPersisted<unknown>(UI_KEY, null);
  useUi.setState(sanitizeUi(stored));
  persistUnsubscribe?.();
  persistUnsubscribe = useUi.subscribe((state, prev) => {
    const next = pickPersisted(state);
    const before = pickPersisted(prev);
    const changed = (Object.keys(next) as (keyof PersistedUi)[]).some((k) => next[k] !== before[k]);
    if (changed) savePersisted(UI_KEY, next);
  });
}
