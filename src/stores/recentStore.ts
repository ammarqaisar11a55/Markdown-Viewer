import { create } from 'zustand';
import { basename, samePath } from '@/lib/paths';
import { loadPersisted, savePersisted } from '@/lib/platform/storage';
import type { RecentFile } from '@/types';
import { useSettings } from './settingsStore';

export const RECENT_KEY = 'recent';
export const MAX_RECENT = 20;

export const useRecent = create<{ items: RecentFile[] }>()(() => ({ items: [] }));

function setItems(items: RecentFile[]): void {
  useRecent.setState({ items });
  savePersisted(RECENT_KEY, items);
}

export function addRecent(path: string): void {
  if (!useSettings.getState().rememberRecent) return;
  const entry: RecentFile = { path, name: basename(path), openedAt: Date.now() };
  const rest = useRecent.getState().items.filter((item) => !samePath(item.path, path));
  setItems([entry, ...rest].slice(0, MAX_RECENT));
}

export function removeRecent(path: string): void {
  const { items } = useRecent.getState();
  const next = items.filter((item) => !samePath(item.path, path));
  if (next.length !== items.length) setItems(next);
}

export function clearRecent(): void {
  setItems([]);
}

function sanitizeRecent(input: unknown): RecentFile[] {
  if (!Array.isArray(input)) return [];
  const out: RecentFile[] = [];
  for (const value of input as unknown[]) {
    if (typeof value !== 'object' || value === null) continue;
    const { path, openedAt } = value as Record<string, unknown>;
    if (typeof path !== 'string' || path === '') continue;
    if (out.some((item) => samePath(item.path, path))) continue;
    out.push({
      path,
      name: basename(path),
      openedAt: typeof openedAt === 'number' ? openedAt : 0,
    });
  }
  return out.slice(0, MAX_RECENT);
}

export async function hydrateRecent(): Promise<void> {
  if (!useSettings.getState().rememberRecent) {
    clearRecent();
    return;
  }
  const stored = await loadPersisted<unknown>(RECENT_KEY, []);
  useRecent.setState({ items: sanitizeRecent(stored) });
}
