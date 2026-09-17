// Small persistence layer: the Tauri store plugin (`preferences.json`) inside
// the app, localStorage elsewhere. Writes are debounced and batched.
import { isTauri } from '@tauri-apps/api/core';
import { load, type Store } from '@tauri-apps/plugin-store';
import { logger } from './logger';

const STORE_FILE = 'preferences.json';
const LOCAL_PREFIX = 'mdv:';
const SAVE_DELAY_MS = 250;

const pending = new Map<string, unknown>();
let storePromise: Promise<Store> | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

function getStore(): Promise<Store> {
  storePromise ??= load(STORE_FILE, { autoSave: false, defaults: {} });
  return storePromise;
}

export async function loadPersisted<T>(key: string, fallback: T): Promise<T> {
  if (pending.has(key)) return pending.get(key) as T;
  try {
    if (isTauri()) {
      const value = await (await getStore()).get<T>(key);
      return value ?? fallback;
    }
    const raw = window.localStorage.getItem(LOCAL_PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch (err) {
    logger.warn(`Could not load persisted "${key}"`, err);
    return fallback;
  }
}

export async function flushPersisted(): Promise<void> {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  if (pending.size === 0) return;
  const entries = [...pending];
  pending.clear();
  try {
    if (isTauri()) {
      const store = await getStore();
      await Promise.all(entries.map(([key, value]) => store.set(key, value)));
      await store.save();
      return;
    }
    for (const [key, value] of entries) {
      window.localStorage.setItem(LOCAL_PREFIX + key, JSON.stringify(value));
    }
  } catch (err) {
    logger.error('Could not save preferences', err);
  }
}

export function savePersisted(key: string, value: unknown): void {
  pending.set(key, value);
  if (timer !== null) clearTimeout(timer);
  timer = setTimeout(() => {
    void flushPersisted();
  }, SAVE_DELAY_MS);
}

/** Test helper: forget the cached store handle and any pending writes. */
export function resetStorageForTests(): void {
  if (timer !== null) clearTimeout(timer);
  timer = null;
  pending.clear();
  storePromise = null;
}
