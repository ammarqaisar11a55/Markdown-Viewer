// Asking about unsaved work before the window closes.
//
// Tauri only destroys the window after this handler resolves *without* calling
// `preventDefault`, so a handler that rejects would leave the app impossible to
// quit. Everything here therefore fails open: if the check itself breaks, the
// window closes.
import type { CloseRequestedEvent } from '@tauri-apps/api/window';
import { confirmQuit } from '@/features/documents/actions';
import { logger } from '@/lib/platform/logger';
import { flushPersisted } from '@/lib/platform/storage';

/** Handles one close request; never rejects. */
export async function handleCloseRequested(event: CloseRequestedEvent): Promise<void> {
  let allowed: boolean;
  try {
    allowed = await confirmQuit();
  } catch (err) {
    // Better to let someone quit than to trap them in the app.
    logger.error('Could not ask about unsaved changes while closing', err);
    return;
  }
  if (!allowed) {
    event.preventDefault();
    return;
  }
  try {
    await flushPersisted();
  } catch (err) {
    logger.warn('Could not save preferences before closing', err);
  }
}
