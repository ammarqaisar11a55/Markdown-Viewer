import { mockBackend } from '@/test/state';
import { setTauriRuntime } from '@/test/tauri';
import { flushPersisted, loadPersisted, resetStorageForTests, savePersisted } from './storage';

beforeEach(() => {
  resetStorageForTests();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('storage (browser fallback)', () => {
  it('debounces writes to localStorage', async () => {
    savePersisted('k', { a: 1 });
    savePersisted('k', { a: 2 });
    expect(window.localStorage.getItem('mdv:k')).toBeNull();
    expect(await loadPersisted('k', null)).toEqual({ a: 2 });
    await vi.advanceTimersByTimeAsync(300);
    expect(window.localStorage.getItem('mdv:k')).toBe('{"a":2}');
  });

  it('returns the fallback for missing or corrupt values', async () => {
    expect(await loadPersisted('missing', 7)).toBe(7);
    window.localStorage.setItem('mdv:bad', '{');
    expect(await loadPersisted('bad', 'x')).toBe('x');
  });
});

describe('storage (Tauri store plugin)', () => {
  it('reads and writes preferences.json through the store plugin', async () => {
    setTauriRuntime(true);
    const values = new Map<string, unknown>([['theme', 'dark']]);
    const backend = mockBackend({
      'plugin:store|load': () => 1,
      'plugin:store|get': ({ key }) => [values.get(key as string), values.has(key as string)],
      'plugin:store|set': ({ key, value }) => {
        values.set(key as string, value);
      },
    });
    expect(await loadPersisted('theme', 'light')).toBe('dark');
    expect(await loadPersisted('other', 'fallback')).toBe('fallback');
    expect(backend.callsOf('plugin:store|load')[0]?.args).toMatchObject({
      path: 'preferences.json',
    });

    savePersisted('zoom', 1.2);
    await flushPersisted();
    expect(values.get('zoom')).toBe(1.2);
    expect(backend.callsOf('plugin:store|save')).toHaveLength(1);
  });
});
