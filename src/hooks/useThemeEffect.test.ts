import { act, renderHook } from '@testing-library/react';
import { updateSettings } from '@/stores/settingsStore';
import { useUi } from '@/stores/uiStore';
import { resetAppState } from '@/test/state';
import { useResolvedTheme, useThemeEffect } from './useThemeEffect';

type Listener = () => void;

function mockSystemDark(initial: boolean) {
  let matches = initial;
  const listeners = new Set<Listener>();
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        get matches() {
          return matches;
        },
        media: query,
        addEventListener: (_: string, cb: Listener) => listeners.add(cb),
        removeEventListener: (_: string, cb: Listener) => listeners.delete(cb),
      }) as unknown as MediaQueryList,
  );
  return (value: boolean) => {
    matches = value;
    listeners.forEach((cb) => {
      cb();
    });
  };
}

beforeEach(() => {
  resetAppState();
  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = () => {
      throw new Error('replaced by spy');
    };
  }
});

describe('useResolvedTheme', () => {
  it('follows the system theme when set to system', () => {
    const setDark = mockSystemDark(false);
    const { result } = renderHook(() => useResolvedTheme());
    expect(result.current).toBe('light');
    act(() => {
      setDark(true);
    });
    expect(result.current).toBe('dark');
    act(() => {
      updateSettings({ theme: 'light' });
    });
    expect(result.current).toBe('light');
  });
});

describe('useThemeEffect', () => {
  it('applies theme and typography to the root element', () => {
    mockSystemDark(true);
    renderHook(() => {
      useThemeEffect();
    });
    const root = document.documentElement;
    expect(root.dataset.theme).toBe('dark');
    expect(root.style.colorScheme).toBe('dark');
    expect(root.style.getPropertyValue('--md-font-size')).toBe('16px');
    expect(root.style.getPropertyValue('--md-code-font-size')).toBe('14px');
    expect(root.style.getPropertyValue('--md-zoom')).toBe('1');
    expect(root.style.getPropertyValue('--md-content-width')).toBe('760px');
    expect(root.dataset.readingFont).toBe('sans');
    expect(root.dataset.lineNumbers).toBe('false');

    act(() => {
      updateSettings({
        contentWidth: 'full',
        readingFont: 'serif',
        lineNumbers: true,
        fontSize: 20,
      });
      useUi.getState().zoomIn();
    });
    expect(root.style.getPropertyValue('--md-content-width')).toBe('none');
    expect(root.style.getPropertyValue('--md-font-size')).toBe('20px');
    expect(root.style.getPropertyValue('--md-zoom')).toBe('1.1');
    expect(root.dataset.readingFont).toBe('serif');
    expect(root.dataset.lineNumbers).toBe('true');
  });
});
