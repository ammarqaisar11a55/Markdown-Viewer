// Status line shown in the Settings dialog, derived from the updates store.
import type { UpdatesData } from '@/stores/updatesStore';
import type { InstallFlavor } from './platform';

const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' });

/** Download progress in percent, or `null` while the size is unknown. */
export function downloadPercent(
  state: Pick<UpdatesData, 'downloaded' | 'contentLength'>,
): number | null {
  const { downloaded, contentLength } = state;
  if (contentLength === null || contentLength <= 0) return null;
  return Math.min(100, Math.round((downloaded / contentLength) * 100));
}

/**
 * How an update installs itself on this kind of installation, or `null` while
 * it is unknown and when there is nothing worth saying — the updater simply
 * replaces a Windows installation, and a browser has nothing to install.
 */
export function installHint(flavor: InstallFlavor | null): string | null {
  switch (flavor) {
    case 'deb':
      return 'Updates install through your system package manager, which asks for your permission.';
    case 'appImage':
      return 'Updates replace the AppImage this app runs from.';
    case 'other':
    case null:
      return null;
  }
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
