// In-app updates. Reading is never interrupted: an automatic check is silent
// unless there is something to install, a manual check always answers, and
// nothing is downloaded or restarted without the user asking for it.
import { confirmQuit } from '@/features/documents/actions';
import { toAppError } from '@/lib/errors';
import { confirmDialog } from '@/lib/platform/dialogs';
import { isTauri } from '@/lib/platform/ipc';
import { logger } from '@/lib/platform/logger';
import { revealInFolder } from '@/lib/platform/system';
import { useSettings } from '@/stores/settingsStore';
import { dismissToast, toast } from '@/stores/toastStore';
import { useUi } from '@/stores/uiStore';
import { hydrateUpdates, useUpdates } from '@/stores/updatesStore';
import type { AppError } from '@/types';
import {
  checkEndpoint,
  installDebUpdate,
  installFlavor,
  relaunchApp,
  resetUpdatePlatformForTests,
  type DebUpdateReport,
  type DownloadEvent,
  type InstallFlavor,
  type PendingUpdate,
} from './platform';

/** Automatic checks run at most once a day. */
export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** Launching must stay fast, so the first check waits until the app is settled. */
export const STARTUP_CHECK_DELAY_MS = 5000;

export const UPDATE_TOAST_ID = 'update-available';
export const MANUAL_INSTALL_TOAST_ID = 'update-manual-install';

/** What the user is in for when they press Install, per kind of installation. */
const INSTALL_DESCRIPTION: Record<InstallFlavor, string> = {
  appImage: 'Installing it restarts Markdown Viewer.',
  deb: 'Installing it asks for your permission, then restarts Markdown Viewer.',
  snap: 'The Snap Store installs it for you.',
  other: 'Installing it restarts Markdown Viewer.',
};

export interface CheckForUpdatesOptions {
  /** The user asked; report the result either way. */
  manual?: boolean;
}

/** The update from the last check, kept until it is installed. */
let pending: PendingUpdate | null = null;
let checking = false;
let installing = false;
let startupTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * True when the endpoint has no release manifest for this platform yet.
 *
 * Until a release is published with updater artifacts, `latest.json` simply
 * does not exist and the plugin reports it as an error. There is nothing to
 * install and nothing the user could do about it, so it counts as "up to date".
 */
function isManifestMissing(err: unknown): boolean {
  const message = (typeof err === 'string' ? err : toAppError(err).technical).toLowerCase();
  return (
    message.includes('could not fetch a valid release json') ||
    message.includes('response `platforms` object')
  );
}

function appError(err: unknown, title: string, description: string): AppError {
  return { kind: 'unknown', title, description, technical: toAppError(err).technical };
}

function checkedRecently(): boolean {
  const { lastCheckedAt } = useUpdates.getState();
  return lastCheckedAt !== null && Date.now() - lastCheckedAt < CHECK_INTERVAL_MS;
}

/** How the app was installed; falls back to the updater's own path if unknown. */
async function currentFlavor(): Promise<InstallFlavor> {
  try {
    return await installFlavor();
  } catch (err) {
    logger.warn('Could not tell how Markdown Viewer was installed', err);
    return 'other';
  }
}

/** Opens the Settings dialog, where the notes and the install action live. */
function showWhatsNew(): void {
  dismissToast(UPDATE_TOAST_ID);
  useUi.getState().setSettingsOpen(true);
}

async function announce(update: PendingUpdate): Promise<void> {
  const notes = update.body?.trim() ?? '';
  useUpdates.getState().foundUpdate(update.version, notes === '' ? null : notes);
  toast({
    id: UPDATE_TOAST_ID,
    variant: 'info',
    title: `Version ${update.version} is available.`,
    description: INSTALL_DESCRIPTION[await currentFlavor()],
    durationMs: null,
    actions: [
      { label: 'Install', primary: true, onClick: () => void installUpdate() },
      // The release notes are in Settings; the dialog opens on that section
      // while an update is on offer.
      { label: 'What’s New', onClick: showWhatsNew },
      { label: 'Later', onClick: () => dismissToast(UPDATE_TOAST_ID) },
    ],
  });
}

/**
 * Looks for a newer release.
 *
 * An automatic check respects the setting and the 24 h interval and stays
 * quiet unless an update is waiting; a manual check always reports back.
 */
export async function checkForUpdates({
  manual = false,
}: CheckForUpdatesOptions = {}): Promise<void> {
  if (!isTauri()) {
    logger.info('Updates are only available in the desktop app');
    return;
  }
  // snapd refreshes a snap from the store on its own, and the app's files are
  // a read-only mount it could not replace anyway.
  if ((await currentFlavor()) === 'snap') {
    logger.info('Updates for this installation are handled by the Snap Store');
    useUpdates.getState().foundNoUpdate();
    if (manual) {
      toast({
        variant: 'info',
        title: 'The Snap Store keeps this app up to date.',
        description: 'New versions install automatically, usually within a day.',
      });
    }
    return;
  }
  if (!manual) {
    if (!useSettings.getState().autoCheckUpdates) return;
    await hydrateUpdates();
    if (checkedRecently()) {
      logger.debug('Skipping the automatic update check; it ran less than a day ago');
      return;
    }
  }
  if (checking) return;
  checking = true;
  const { startCheck, foundNoUpdate, failUpdate } = useUpdates.getState();
  startCheck();

  let update: PendingUpdate | null;
  try {
    update = await checkEndpoint();
  } catch (err) {
    checking = false;
    if (isManifestMissing(err)) {
      logger.info('No update manifest published yet', err);
      foundNoUpdate();
      if (manual) toast({ variant: 'success', title: 'You’re up to date.' });
      return;
    }
    const error = appError(
      err,
      'Could not check for updates.',
      'Markdown Viewer could not reach the update server. Please try again later.',
    );
    logger.warn('Update check failed', error.technical);
    failUpdate(error);
    if (manual) toast({ variant: 'error', title: error.title, description: error.description });
    return;
  }
  checking = false;

  if (update === null) {
    pending = null;
    foundNoUpdate();
    logger.info('No update available');
    if (manual) toast({ variant: 'success', title: 'You’re up to date.' });
    return;
  }

  pending = update;
  logger.info(`Update ${update.version} is available`);
  await announce(update);
}

/** Asks before the app restarts, and never while a draft is unsaved. */
async function confirmRestart(): Promise<boolean> {
  const restart = await confirmDialog('Restart Markdown Viewer to finish updating?', {
    title: 'Update Installed',
    okLabel: 'Restart Now',
    cancelLabel: 'Later',
  });
  // Unsaved changes always win: `confirmQuit` asks about every draft first.
  return restart && (await confirmQuit());
}

/** Feeds the store from the download progress of either install path. */
function trackProgress(event: DownloadEvent): void {
  const { startDownload, addDownloaded, startInstall } = useUpdates.getState();
  switch (event.event) {
    case 'Started':
      startDownload(event.data.contentLength ?? null);
      break;
    case 'Progress':
      addDownloaded(event.data.chunkLength);
      break;
    case 'Finished':
      startInstall();
      break;
  }
}

/**
 * Puts an update that was downloaded but not installed back on offer, so the
 * Settings dialog keeps showing it and the user can try again.
 */
function keepOnOffer(update: PendingUpdate): void {
  const { notes, foundUpdate } = useUpdates.getState();
  foundUpdate(update.version, notes);
}

/** The authorisation prompt was dismissed: nothing was installed, nothing broke. */
function reportCancelled(update: PendingUpdate): void {
  logger.info('The update was not authorised');
  keepOnOffer(update);
  toast({
    variant: 'info',
    title: 'Update cancelled.',
    description: `Version ${update.version} was not installed. You can install it any time.`,
  });
}

/** Nothing here can ask for permission, so the user finishes the job. */
function reportManualInstall(update: PendingUpdate, path: string): void {
  logger.warn('No authorisation helper is available; the package must be installed by hand');
  keepOnOffer(update);
  toast({
    id: MANUAL_INSTALL_TOAST_ID,
    variant: 'warning',
    title: `Version ${update.version} is downloaded.`,
    description:
      'Markdown Viewer cannot ask for permission to install it on this system. Open the downloaded package yourself to finish updating.',
    durationMs: null,
    actions: [
      { label: 'Show File', primary: true, onClick: () => void revealInFolder(path) },
      { label: 'Later', onClick: () => dismissToast(MANUAL_INSTALL_TOAST_ID) },
    ],
  });
}

/**
 * Installs the update found by the last check, then restarts.
 *
 * An AppImage or a Windows installation is replaced by the updater itself. A
 * `.deb` cannot be: its files belong to the system package manager, so the
 * signed package is handed to it instead (see `install_deb_update` in Rust),
 * which may well be declined — that is a cancellation, not a failure.
 */
export async function installUpdate(): Promise<void> {
  const update = pending;
  if (update === null) {
    logger.warn('Install was requested without an update to install');
    return;
  }
  if (installing) return;
  installing = true;
  dismissToast(UPDATE_TOAST_ID);
  dismissToast(MANUAL_INSTALL_TOAST_ID);
  const { startDownload, startInstall, failUpdate } = useUpdates.getState();
  startDownload(null);

  let report: DebUpdateReport | null = null;
  try {
    if ((await currentFlavor()) === 'deb') report = await installDebUpdate(trackProgress);
    else await update.downloadAndInstall(trackProgress);
  } catch (err) {
    installing = false;
    const error = appError(
      err,
      'Could not install the update.',
      'Something went wrong while installing it. Your documents are untouched.',
    );
    logger.error('Update installation failed', error.technical);
    failUpdate(error);
    toast({ variant: 'error', title: error.title, description: error.description });
    return;
  }

  installing = false;

  if (report !== null && report.outcome !== 'installed') {
    if (report.outcome === 'cancelled') reportCancelled(update);
    else reportManualInstall(update, report.path);
    return;
  }

  startInstall();
  pending = null;

  if (!(await confirmRestart())) {
    toast({
      variant: 'info',
      title: 'Update installed.',
      description: 'It takes effect the next time you start Markdown Viewer.',
    });
    return;
  }
  await relaunchApp();
}

/**
 * Starts the automatic check a few seconds after launch, so it never competes
 * with opening the first document.
 */
export function scheduleStartupUpdateCheck(): void {
  if (!isTauri() || startupTimer !== null) return;
  startupTimer = setTimeout(() => {
    startupTimer = null;
    void checkForUpdates();
  }, STARTUP_CHECK_DELAY_MS);
}

/** Test helper: forget module-level bookkeeping. */
export function resetUpdateActionsForTests(): void {
  if (startupTimer !== null) clearTimeout(startupTimer);
  resetUpdatePlatformForTests();
  startupTimer = null;
  pending = null;
  checking = false;
  installing = false;
}
