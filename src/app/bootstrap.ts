// Application start-up: hydrate state, restore the session, open paths from
// the command line and subscribe to native events. Never throws.
import { isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { homeDir } from '@tauri-apps/api/path';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { handleFileChanged, openPaths } from '@/features/documents/actions';
import { startWindowTitleSync } from '@/features/documents/windowTitle';
import { refreshRecentExistence } from '@/features/recent/actions';
import { restoreSession, startSessionPersistence } from '@/features/session/session';
import { startSettingsEffects } from '@/features/settings/effects';
import { ensureWindowTracking } from '@/features/window/tracking';
import { setHomeDir } from '@/lib/paths';
import { takeStartupPaths } from '@/lib/platform/ipc';
import { logger } from '@/lib/platform/logger';
import { flushPersisted } from '@/lib/platform/storage';
import { hydrateRecent } from '@/stores/recentStore';
import { hydrateSettings } from '@/stores/settingsStore';
import { hydrateUi, useUi } from '@/stores/uiStore';
import type { FileChangedPayload } from '@/types';
import { isCommandId, runCommand } from './commands';

async function step(name: string, task: () => unknown): Promise<void> {
  try {
    await task();
  } catch (err) {
    logger.error(`Startup step "${name}" failed`, err);
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

async function subscribeNativeEvents(): Promise<void> {
  if (!isTauri()) return;
  await Promise.all([
    listen<FileChangedPayload>('file-changed', (event) => {
      void handleFileChanged(event.payload);
    }),
    listen<unknown>('open-paths', (event) => {
      if (isStringArray(event.payload)) void openPaths(event.payload);
    }),
    listen<unknown>('menu-action', (event) => {
      if (isCommandId(event.payload)) void runCommand(event.payload);
      else logger.warn('Unknown menu action', event.payload);
    }),
    getCurrentWebview().onDragDropEvent((event) => {
      const { setDragActive } = useUi.getState();
      switch (event.payload.type) {
        case 'enter':
          setDragActive(true);
          break;
        case 'over':
          break;
        case 'drop':
          setDragActive(false);
          void openPaths(event.payload.paths);
          break;
        case 'leave':
          setDragActive(false);
          break;
      }
    }),
  ]);
}

async function loadHomeDir(): Promise<void> {
  if (isTauri()) setHomeDir(await homeDir());
}

export async function bootstrap(): Promise<void> {
  await step('hydrate', () => Promise.all([hydrateSettings(), hydrateUi()]));
  // Recent hydration depends on the `rememberRecent` setting.
  await step('hydrate recent', hydrateRecent);
  await step('home directory', loadHomeDir);
  await step('effects', () => {
    startSettingsEffects();
    startWindowTitleSync();
    ensureWindowTracking();
    window.addEventListener('pagehide', () => void flushPersisted());
  });
  await step('native events', subscribeNativeEvents);

  let startupPaths: string[] = [];
  await step('startup paths', async () => {
    startupPaths = await takeStartupPaths();
  });
  await step('restore session', restoreSession);
  await step('session persistence', startSessionPersistence);
  if (startupPaths.length > 0) {
    await step('open startup paths', () => {
      void openPaths(startupPaths);
    });
  }
  void refreshRecentExistence();
}
