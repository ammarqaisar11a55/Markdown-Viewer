import { flushPersisted } from '@/lib/platform/storage';
import { hydrateRecent, MAX_RECENT } from '@/stores/recentStore';
import { updateSettings } from '@/stores/settingsStore';
import { mockBackend, resetAppState } from '@/test/state';
import { startSettingsEffects } from '../settings/effects';
import { addRecent, clearRecent, refreshRecentExistence, removeRecent, useRecent } from './actions';

const paths = () => useRecent.getState().items.map((item) => item.path);

beforeEach(resetAppState);

describe('recent files', () => {
  it('adds newest first and dedupes', () => {
    addRecent('/a.md');
    addRecent('/b.md');
    addRecent('/./a.md');
    expect(paths()).toEqual(['/./a.md', '/b.md']);
    expect(useRecent.getState().items[0]?.name).toBe('a.md');
  });

  it('dedupes Windows paths case-insensitively', () => {
    addRecent('C:\\Docs\\A.md');
    addRecent('c:\\docs\\a.md');
    expect(paths()).toEqual(['c:\\docs\\a.md']);
  });

  it(`keeps at most ${MAX_RECENT} entries`, () => {
    for (let i = 0; i < MAX_RECENT + 5; i += 1) addRecent(`/f${i}.md`);
    expect(paths()).toHaveLength(MAX_RECENT);
    expect(paths()[0]).toBe(`/f${MAX_RECENT + 4}.md`);
  });

  it('removes and clears entries, persisting the result', async () => {
    addRecent('/a.md');
    addRecent('/b.md');
    removeRecent('/a.md');
    expect(paths()).toEqual(['/b.md']);
    await flushPersisted();
    expect(JSON.parse(window.localStorage.getItem('mdv:recent') ?? '[]')).toHaveLength(1);
    clearRecent();
    expect(paths()).toEqual([]);
  });

  it('does nothing when remembering is disabled, and clears when it gets disabled', () => {
    const stop = startSettingsEffects();
    addRecent('/a.md');
    updateSettings({ rememberRecent: false });
    expect(paths()).toEqual([]);
    addRecent('/b.md');
    expect(paths()).toEqual([]);
    stop();
  });

  it('hydrates valid entries only', async () => {
    window.localStorage.setItem(
      'mdv:recent',
      JSON.stringify([{ path: '/a.md', openedAt: 5 }, { nope: true }, { path: '/a.md' }, 'x']),
    );
    await hydrateRecent();
    expect(useRecent.getState().items).toEqual([{ path: '/a.md', name: 'a.md', openedAt: 5 }]);
  });

  it('marks missing files and clears the mark when they return', async () => {
    const existing = new Set(['/a.md']);
    mockBackend({ check_files: ({ paths: p }) => (p as string[]).map((x) => existing.has(x)) });
    addRecent('/b.md');
    addRecent('/a.md');
    await refreshRecentExistence();
    expect(useRecent.getState().items.map((i) => i.missing === true)).toEqual([false, true]);
    existing.add('/b.md');
    await refreshRecentExistence();
    expect(useRecent.getState().items[1]).not.toHaveProperty('missing');
  });

  it('survives a failing existence check', async () => {
    mockBackend({
      check_files: () => {
        throw new Error('ipc down');
      },
    });
    addRecent('/a.md');
    await expect(refreshRecentExistence()).resolves.toBeUndefined();
    expect(useRecent.getState().items[0]).not.toHaveProperty('missing');
  });
});
