// The only place that talks to the updater and process plugins. Keeping it
// here means the rest of the feature (and its tests) never depend on the
// plugin internals, and everything degrades to a no-op outside the desktop app.
import { getVersion } from '@tauri-apps/api/app';
import { relaunch } from '@tauri-apps/plugin-process';
import { check, type DownloadEvent, type Update } from '@tauri-apps/plugin-updater';
import { isTauri } from '@/lib/platform/ipc';

export type { DownloadEvent };

/** Checking should not keep a connection open while someone is reading. */
export const CHECK_TIMEOUT_MS = 20_000;

/** The part of the plugin's `Update` this feature uses. */
export type PendingUpdate = Pick<Update, 'version' | 'body' | 'downloadAndInstall'>;

/**
 * Asks the configured endpoint for a newer release.
 *
 * Resolves to `null` when the running version is the latest one.
 */
export async function checkEndpoint(): Promise<PendingUpdate | null> {
  if (!isTauri()) return null;
  return check({ timeout: CHECK_TIMEOUT_MS });
}

/** Quits and starts the app again, so an installed update takes effect. */
export async function relaunchApp(): Promise<void> {
  if (!isTauri()) return;
  await relaunch();
}

/** The running version, or `null` outside the desktop app. */
export async function appVersion(): Promise<string | null> {
  if (!isTauri()) return null;
  return getVersion();
}
