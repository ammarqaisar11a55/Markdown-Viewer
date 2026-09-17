import { flushPersisted } from '@/lib/platform/storage';
import { resetAppState } from '@/test/state';
import { mockBackend } from '@/test/state';
import { setTauriRuntime } from '@/test/tauri';
import { hydrateUi, SIDEBAR_WIDTH, useUi, ZOOM } from './uiStore';

beforeEach(resetAppState);

describe('uiStore', () => {
  it('clamps zoom to its range in 0.1 steps', () => {
    const ui = useUi.getState();
    for (let i = 0; i < 30; i += 1) ui.zoomIn();
    expect(useUi.getState().zoom).toBe(ZOOM.max);
    for (let i = 0; i < 30; i += 1) ui.zoomOut();
    expect(useUi.getState().zoom).toBe(ZOOM.min);
    ui.resetZoom();
    ui.zoomIn();
    ui.zoomIn();
    ui.zoomIn();
    expect(useUi.getState().zoom).toBe(1.3);
  });

  it('clamps the sidebar width', () => {
    const ui = useUi.getState();
    ui.setSidebarWidth(50);
    expect(useUi.getState().sidebarWidth).toBe(SIDEBAR_WIDTH.min);
    ui.setSidebarWidth(9000);
    expect(useUi.getState().sidebarWidth).toBe(SIDEBAR_WIDTH.max);
    ui.setSidebarWidth(Number.NaN);
    expect(useUi.getState().sidebarWidth).toBe(SIDEBAR_WIDTH.default);
  });

  it('toggles the sidebar and reading mode', () => {
    useUi.getState().toggleSidebar();
    expect(useUi.getState().sidebarCollapsed).toBe(true);
    useUi.getState().toggleReadingMode();
    expect(useUi.getState().readingMode).toBe(true);
  });

  it('hides the native menu in reading mode and restores it after', () => {
    setTauriRuntime(true);
    const backend = mockBackend({});
    useUi.getState().setReadingMode(true);
    useUi.getState().setReadingMode(true);
    useUi.getState().setReadingMode(false);
    expect(backend.callsOf('set_menu_visible').map((c) => c.args)).toEqual([
      { visible: false },
      { visible: true },
    ]);
  });

  it('hydrates and persists the UI subset', async () => {
    window.localStorage.setItem(
      'mdv:ui',
      JSON.stringify({ sidebarWidth: 10, zoom: 1.25, sidebarView: 'files', readingMode: true }),
    );
    await hydrateUi();
    const state = useUi.getState();
    expect(state.sidebarWidth).toBe(SIDEBAR_WIDTH.min);
    expect(state.zoom).toBe(1.3);
    expect(state.sidebarView).toBe('files');
    expect(state.readingMode).toBe(false);

    state.setSidebarView('recent');
    state.setSearchOpen(true);
    await flushPersisted();
    expect(JSON.parse(window.localStorage.getItem('mdv:ui') ?? 'null')).toEqual({
      sidebarCollapsed: false,
      sidebarWidth: SIDEBAR_WIDTH.min,
      sidebarView: 'recent',
      zoom: 1.3,
    });
  });
});
