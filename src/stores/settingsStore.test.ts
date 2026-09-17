import { flushPersisted, loadPersisted } from '@/lib/platform/storage';
import { resetAppState } from '@/test/state';
import {
  DEFAULT_SETTINGS,
  getSettings,
  hydrateSettings,
  resetSettings,
  sanitizeSettings,
  updateSettings,
  useSettings,
} from './settingsStore';

beforeEach(resetAppState);

describe('sanitizeSettings', () => {
  it('fills defaults and clamps numbers', () => {
    const result = sanitizeSettings({ fontSize: 99, codeFontSize: 2, theme: 'dark' });
    expect(result).toEqual({ ...DEFAULT_SETTINGS, fontSize: 24, codeFontSize: 11, theme: 'dark' });
  });

  it('rejects invalid values', () => {
    const result = sanitizeSettings({
      theme: 'neon',
      contentWidth: 42,
      autoReload: 'yes',
      fontSize: Number.NaN,
      extra: true,
    });
    expect(result).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings('garbage')).toEqual(DEFAULT_SETTINGS);
  });

  it('rounds fractional sizes', () => {
    expect(sanitizeSettings({ fontSize: 17.6 }).fontSize).toBe(18);
  });
});

describe('settings store', () => {
  it('updates, clamps and persists', async () => {
    updateSettings({ fontSize: 30, autoReload: true });
    expect(useSettings.getState().fontSize).toBe(24);
    expect(useSettings.getState().autoReload).toBe(true);
    await flushPersisted();
    expect(await loadPersisted('settings', null)).toEqual(getSettings());
  });

  it('resets to defaults', () => {
    updateSettings({ theme: 'dark' });
    resetSettings();
    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('hydrates from storage, sanitizing the stored value', async () => {
    window.localStorage.setItem('mdv:settings', JSON.stringify({ theme: 'light', fontSize: 5 }));
    await hydrateSettings();
    expect(getSettings()).toMatchObject({ theme: 'light', fontSize: 14 });
  });

  it('falls back to defaults when storage is corrupt', async () => {
    window.localStorage.setItem('mdv:settings', '{not json');
    await hydrateSettings();
    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
  });
});
