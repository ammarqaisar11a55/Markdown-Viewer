import { renderHook } from '@testing-library/react';
import { currentPlatform } from '@/lib/shortcuts';
import { useUi } from '@/stores/uiStore';
import { resetAppState } from '@/test/state';
import { useGlobalShortcuts } from './useGlobalShortcuts';

const mod = currentPlatform === 'mac' ? { metaKey: true } : { ctrlKey: true };

function press(init: KeyboardEventInit, target: EventTarget = window): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  resetAppState();
  vi.useFakeTimers({ toFake: ['performance'] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useGlobalShortcuts', () => {
  it('runs matching commands and prevents the default action', () => {
    const { unmount } = renderHook(() => {
      useGlobalShortcuts();
    });
    const event = press({ key: 'b', ...mod });
    expect(event.defaultPrevented).toBe(true);
    expect(useUi.getState().sidebarCollapsed).toBe(true);
    unmount();
    vi.advanceTimersByTime(1000);
    press({ key: 'b', ...mod });
    expect(useUi.getState().sidebarCollapsed).toBe(true);
  });

  it('blocks browser reload, print and save even without a runnable command', () => {
    renderHook(() => {
      useGlobalShortcuts();
    });
    expect(press({ key: 'F5' }).defaultPrevented).toBe(true);
    expect(press({ key: 's', ...mod }).defaultPrevented).toBe(true);
    expect(press({ key: 'r', ...mod }).defaultPrevented).toBe(true);
  });

  it('ignores key repeat for toggles but not for zoom', () => {
    renderHook(() => {
      useGlobalShortcuts();
    });
    press({ key: 'b', repeat: true, ...mod });
    expect(useUi.getState().sidebarCollapsed).toBe(false);
    press({ key: '=', repeat: true, ...mod });
    expect(useUi.getState().zoom).toBe(1.1);
  });

  it('never intercepts plain typing in inputs', () => {
    renderHook(() => {
      useGlobalShortcuts();
    });
    const input = document.createElement('input');
    document.body.append(input);
    const event = press({ key: 'b' }, input);
    expect(event.defaultPrevented).toBe(false);
    const zoom = press({ key: '+', shiftKey: true, ...mod }, input);
    expect(zoom.defaultPrevented).toBe(true);
    expect(useUi.getState().zoom).toBe(1.1);
    input.remove();
  });

  it('skips events already handled by a component', () => {
    renderHook(() => {
      useGlobalShortcuts();
    });
    const event = new KeyboardEvent('keydown', { key: 'b', cancelable: true, ...mod });
    event.preventDefault();
    window.dispatchEvent(event);
    expect(useUi.getState().sidebarCollapsed).toBe(false);
  });
});
