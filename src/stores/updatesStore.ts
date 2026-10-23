import { create } from 'zustand';
import { loadPersisted, savePersisted } from '@/lib/platform/storage';
import type { AppError } from '@/types';

export const UPDATES_KEY = 'updates';

/**
 * Where the updater is in its life cycle.
 *
 * `upToDate` and `error` are results of the last check. `available` outlives the
 * toast, so the Settings dialog can still offer the update afterwards.
 */
export type UpdateStatus =
  'idle' | 'checking' | 'available' | 'downloading' | 'installing' | 'upToDate' | 'error';

export interface UpdatesData {
  status: UpdateStatus;
  /** Version announced by the update server. */
  version: string | null;
  /** Release notes, when the server provided them. */
  notes: string | null;
  /** Bytes downloaded so far. */
  downloaded: number;
  /** Size of the download, when the server announced one. */
  contentLength: number | null;
  error: AppError | null;
  /** When the last completed check ran; throttles automatic checks. */
  lastCheckedAt: number | null;
}

export interface UpdatesState extends UpdatesData {
  startCheck: () => void;
  foundUpdate: (version: string, notes: string | null) => void;
  foundNoUpdate: () => void;
  startDownload: (contentLength: number | null) => void;
  addDownloaded: (bytes: number) => void;
  startInstall: () => void;
  failUpdate: (error: AppError) => void;
}

export const INITIAL_UPDATES_STATE: Readonly<UpdatesData> = Object.freeze({
  status: 'idle',
  version: null,
  notes: null,
  downloaded: 0,
  contentLength: null,
  error: null,
  lastCheckedAt: null,
});

/** Records a completed check and remembers when it happened. */
function stamp(): { lastCheckedAt: number } {
  const lastCheckedAt = Date.now();
  savePersisted(UPDATES_KEY, { lastCheckedAt });
  return { lastCheckedAt };
}

export const useUpdates = create<UpdatesState>()((set, get) => ({
  ...INITIAL_UPDATES_STATE,

  startCheck: () => set({ status: 'checking', error: null }),
  foundUpdate: (version, notes) =>
    set({ status: 'available', version, notes, error: null, ...stamp() }),
  // A failed check keeps the previous timestamp, so the next launch retries.
  foundNoUpdate: () =>
    set({ status: 'upToDate', version: null, notes: null, error: null, ...stamp() }),
  startDownload: (contentLength) =>
    set({ status: 'downloading', downloaded: 0, contentLength, error: null }),
  addDownloaded: (bytes) => set({ downloaded: get().downloaded + bytes }),
  startInstall: () => set({ status: 'installing' }),
  failUpdate: (error) => set({ status: 'error', error }),
}));

function storedTimestamp(value: unknown): number | null {
  if (typeof value !== 'object' || value === null) return null;
  const { lastCheckedAt } = value as Record<string, unknown>;
  if (typeof lastCheckedAt !== 'number' || !Number.isFinite(lastCheckedAt)) return null;
  return lastCheckedAt > 0 ? lastCheckedAt : null;
}

/**
 * Loads the persisted check timestamp; never throws.
 *
 * The most recent check wins, so hydrating again later never forgets a check
 * this session already made.
 */
export async function hydrateUpdates(): Promise<void> {
  const stored = await loadPersisted<unknown>(UPDATES_KEY, null);
  const lastCheckedAt = storedTimestamp(stored);
  if (lastCheckedAt === null) return;
  if (lastCheckedAt > (useUpdates.getState().lastCheckedAt ?? 0)) {
    useUpdates.setState({ lastCheckedAt });
  }
}
