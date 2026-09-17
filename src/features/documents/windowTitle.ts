import { logger } from '@/lib/platform/logger';
import { setWindowTitle } from '@/lib/platform/system';
import { selectActiveTab, useDocuments } from '@/stores/documentsStore';

export const APP_NAME = 'Markdown Viewer';

export function windowTitleFor(fileName: string | null): string {
  return fileName === null ? APP_NAME : `${fileName} — ${APP_NAME}`;
}

/** Keeps the native window title in sync with the active document. */
export function startWindowTitleSync(): () => void {
  let current: string | null = null;
  const sync = () => {
    const title = windowTitleFor(selectActiveTab(useDocuments.getState())?.name ?? null);
    if (title === current) return;
    current = title;
    setWindowTitle(title).catch((err: unknown) => {
      logger.warn('Could not set the window title', err);
    });
  };
  sync();
  return useDocuments.subscribe(sync);
}
