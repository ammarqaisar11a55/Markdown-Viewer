// Tracks window width, fullscreen state and focus. Idempotent.
import { logger } from '@/lib/platform/logger';
import { isWindowFullscreen } from '@/lib/platform/system';
import { useUi } from '@/stores/uiStore';
import { refreshRecentExistence } from '../recent/actions';

const RESIZE_SETTLE_MS = 120;
let started = false;

function syncFullscreen(): void {
  isWindowFullscreen()
    .then((on) => {
      if (useUi.getState().isFullscreen !== on) useUi.getState().setFullscreen(on);
    })
    .catch((err: unknown) => {
      logger.debug('Could not read fullscreen state', err);
    });
}

export function ensureWindowTracking(): void {
  if (started) return;
  started = true;
  let timer: ReturnType<typeof setTimeout> | null = null;
  window.addEventListener('resize', () => {
    useUi.getState().setWindowWidth(window.innerWidth);
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(syncFullscreen, RESIZE_SETTLE_MS);
  });
  document.addEventListener('fullscreenchange', syncFullscreen);
  window.addEventListener('focus', () => {
    void refreshRecentExistence();
  });
  useUi.getState().setWindowWidth(window.innerWidth);
  syncFullscreen();
}
