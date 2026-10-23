// Status line shown in the Settings dialog, derived from the updates store.
import type { UpdatesData } from '@/stores/updatesStore';

const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' });

/** Download progress in percent, or `null` while the size is unknown. */
export function downloadPercent(
  state: Pick<UpdatesData, 'downloaded' | 'contentLength'>,
): number | null {
  const { downloaded, contentLength } = state;
  if (contentLength === null || contentLength <= 0) return null;
  return Math.min(100, Math.round((downloaded / contentLength) * 100));
}

export function formatUpdateStatus(state: UpdatesData): string {
  switch (state.status) {
    case 'checking':
      return 'Checking for updates…';
    case 'available':
      return state.version === null
        ? 'An update is available.'
        : `Version ${state.version} is available.`;
    case 'downloading': {
      const percent = downloadPercent(state);
      return percent === null ? 'Downloading the update…' : `Downloading the update… ${percent}%`;
    }
    case 'installing':
      return 'Installing the update…';
    case 'upToDate':
      return 'You’re up to date.';
    case 'error':
      return state.error?.title ?? 'Could not check for updates.';
    case 'idle':
      return state.lastCheckedAt === null
        ? 'Not checked yet.'
        : `Last checked ${dateFormat.format(state.lastCheckedAt)}.`;
  }
}
