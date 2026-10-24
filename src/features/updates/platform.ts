// The only place that talks to the updater and process plugins. Keeping it
// here means the rest of the feature (and its tests) never depend on the
// plugin internals, and everything degrades to a no-op outside the desktop app.
import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { relaunch } from '@tauri-apps/plugin-process';
import { check, type DownloadEvent, type Update } from '@tauri-apps/plugin-updater';
import { isTauri } from '@/lib/platform/ipc';

export type { DownloadEvent };

/** Checking should not keep a connection open while someone is reading. */
export const CHECK_TIMEOUT_MS = 20_000;

/** The part of the plugin's `Update` this feature uses. */
export type PendingUpdate = Pick<Update, 'version' | 'body' | 'downloadAndInstall'>;

/** How this copy of the app was installed (see `install_flavor` in Rust). */
export type InstallFlavor = 'appImage' | 'deb' | 'snap' | 'other';

/** What handing a package to the system installer ended in. */
export type DebInstallOutcome = 'installed' | 'cancelled' | 'installerMissing';

export interface DebUpdateReport {
  outcome: DebInstallOutcome;
  /** Version of the package that was downloaded. */
  version: string;
  /** Where the package was written, so it can be revealed in the file manager. */
  path: string;
}

/** Event the Rust side emits while a package update downloads. */
export const UPDATE_PROGRESS_EVENT = 'update-progress';

/** The flavor cannot change while the app runs, so it is asked for once. */
let flavor: InstallFlavor | null = null;

function isInstallFlavor(value: unknown): value is InstallFlavor {
  return value === 'appImage' || value === 'deb' || value === 'snap' || value === 'other';
}

/**
 * How the running app was installed; `other` outside the desktop app, where
 * there is no installation to speak of.
 */
export async function installFlavor(): Promise<InstallFlavor> {
  if (!isTauri()) return 'other';
  if (flavor === null) {
    const answer: unknown = await invoke('install_flavor');
    flavor = isInstallFlavor(answer) ? answer : 'other';
  }
  return flavor;
}

/**
 * Downloads the signed `.deb` and hands it to the system package installer,
 * which asks the user for authorisation.
 *
 * Progress arrives in the same shape as the plugin's own download events, so
 * both install paths share one handler.
 */
export async function installDebUpdate(
  onProgress: (event: DownloadEvent) => void,
): Promise<DebUpdateReport> {
  const unlisten = await listen<DownloadEvent>(UPDATE_PROGRESS_EVENT, ({ payload }) => {
    onProgress(payload);
  });
  try {
    return await invoke<DebUpdateReport>('install_deb_update');
  } finally {
    unlisten();
  }
}

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

/** Test helper: forget the cached install flavor. */
export function resetUpdatePlatformForTests(): void {
  flavor = null;
}
