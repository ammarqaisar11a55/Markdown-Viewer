import { checkFiles } from '@/lib/platform/ipc';
import { logger } from '@/lib/platform/logger';
import { useRecent } from '@/stores/recentStore';
import type { RecentFile } from '@/types';

export { addRecent, clearRecent, removeRecent, useRecent } from '@/stores/recentStore';

/** Marks recent entries whose files no longer exist (and un-marks restored ones). */
export async function refreshRecentExistence(): Promise<void> {
  const paths = useRecent.getState().items.map((item) => item.path);
  if (paths.length === 0) return;
  let exists: boolean[];
  try {
    exists = await checkFiles(paths);
  } catch (err) {
    logger.warn('Could not check recent files', err);
    return;
  }
  const status = new Map(paths.map((path, i) => [path, exists[i] !== true]));
  const { items } = useRecent.getState();
  const next = items.map((item): RecentFile => {
    const missing = status.get(item.path);
    if (missing === undefined || missing === (item.missing === true)) return item;
    if (missing) return { ...item, missing: true };
    return { path: item.path, name: item.name, openedAt: item.openedAt };
  });
  if (next.some((item, i) => item !== items[i])) useRecent.setState({ items: next });
}
