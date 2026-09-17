// Desktop integration: external links, clipboard, window & notifications.
import { convertFileSrc, isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { isPermissionGranted, sendNotification } from '@tauri-apps/plugin-notification';
import { openUrl, revealItemInDir } from '@tauri-apps/plugin-opener';
import { useSettings } from '@/stores/settingsStore';
import { confirmDialog } from './dialogs';
import { logger } from './logger';

const EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

export function isExternalUrl(url: string): boolean {
  try {
    return EXTERNAL_PROTOCOLS.has(new URL(url).protocol);
  } catch {
    return false;
  }
}

export async function openExternalUrl(url: string): Promise<void> {
  if (!isExternalUrl(url)) {
    logger.warn('Blocked opening a non-http(s)/mailto URL', url);
    return;
  }
  if (useSettings.getState().externalLinks === 'ask') {
    const ok = await confirmDialog(`Open this link in your browser?\n\n${url}`, {
      title: 'Open External Link',
      okLabel: 'Open',
      cancelLabel: 'Cancel',
    });
    if (!ok) return;
  }
  if (isTauri()) {
    await openUrl(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

export async function revealInFolder(path: string): Promise<void> {
  if (!isTauri()) {
    logger.info('Reveal in folder is only available in the desktop app', path);
    return;
  }
  await revealItemInDir(path);
}

export async function copyText(text: string): Promise<void> {
  if (isTauri()) {
    try {
      await writeText(text);
      return;
    } catch (err) {
      logger.warn('Clipboard plugin failed, falling back to navigator.clipboard', err);
    }
  }
  await navigator.clipboard.writeText(text);
}

function toFileUrl(path: string): string {
  const forward = path.replace(/\\/g, '/');
  return `file://${forward.startsWith('/') ? '' : '/'}${encodeURI(forward)}`;
}

/** URL for a local image served through the `mdasset` protocol. */
export function toAssetUrl(absPath: string): string {
  try {
    return convertFileSrc(absPath, 'mdasset');
  } catch {
    return toFileUrl(absPath);
  }
}

/** Toggles fullscreen and resolves to the new state. */
export async function toggleFullscreen(): Promise<boolean> {
  if (isTauri()) {
    const win = getCurrentWindow();
    const next = !(await win.isFullscreen());
    await win.setFullscreen(next);
    return next;
  }
  if (document.fullscreenElement) {
    await document.exitFullscreen();
    return false;
  }
  await document.documentElement.requestFullscreen();
  return true;
}

export async function isWindowFullscreen(): Promise<boolean> {
  if (isTauri()) return getCurrentWindow().isFullscreen();
  return document.fullscreenElement !== null;
}

export async function setWindowTitle(title: string): Promise<void> {
  document.title = title;
  if (isTauri()) await getCurrentWindow().setTitle(title);
}

/** Native notification, only when the window is unfocused and permission is granted. */
export async function notify(title: string, body: string): Promise<void> {
  if (!isTauri() || document.hasFocus()) return;
  try {
    if (!(await isPermissionGranted())) return;
    sendNotification({ title, body });
  } catch (err) {
    logger.warn('Could not show a notification', err);
  }
}

export async function quitApp(): Promise<void> {
  if (isTauri()) {
    await getCurrentWindow().close();
    return;
  }
  window.close();
}
