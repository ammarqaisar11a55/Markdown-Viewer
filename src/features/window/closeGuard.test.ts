import type { CloseRequestedEvent } from '@tauri-apps/api/window';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { confirmQuit } from '@/features/documents/actions';
import { flushPersisted } from '@/lib/platform/storage';
import { handleCloseRequested } from './closeGuard';

vi.mock('@/features/documents/actions', () => ({ confirmQuit: vi.fn() }));
vi.mock('@/lib/platform/storage', () => ({ flushPersisted: vi.fn() }));

const confirm = vi.mocked(confirmQuit);
const flush = vi.mocked(flushPersisted);

function closeEvent(): CloseRequestedEvent & { preventDefault: ReturnType<typeof vi.fn> } {
  return { preventDefault: vi.fn() } as unknown as CloseRequestedEvent & {
    preventDefault: ReturnType<typeof vi.fn>;
  };
}

describe('handleCloseRequested', () => {
  beforeEach(() => {
    confirm.mockResolvedValue(true);
    flush.mockResolvedValue(undefined);
  });

  it('lets the window close and saves preferences first', async () => {
    const event = closeEvent();
    await handleCloseRequested(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('keeps the window open when the user cancels', async () => {
    confirm.mockResolvedValue(false);
    const event = closeEvent();
    await handleCloseRequested(event);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(flush).not.toHaveBeenCalled();
  });

  // Tauri destroys the window only after this handler resolves without
  // preventing the default, so a rejection would make the app unquittable.
  it('closes anyway when the unsaved-changes check fails', async () => {
    confirm.mockRejectedValue(new Error('dialog unavailable'));
    const event = closeEvent();
    await expect(handleCloseRequested(event)).resolves.toBeUndefined();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('closes anyway when preferences cannot be saved', async () => {
    flush.mockRejectedValue(new Error('store unavailable'));
    const event = closeEvent();
    await expect(handleCloseRequested(event)).resolves.toBeUndefined();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});
