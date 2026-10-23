import { flushPersisted } from '@/lib/platform/storage';
import { resetAppState } from '@/test/state';
import type { AppError } from '@/types';
import { hydrateUpdates, INITIAL_UPDATES_STATE, useUpdates } from './updatesStore';

const ERROR: AppError = {
  kind: 'unknown',
  title: 'Could not check for updates.',
  description: 'Please try again later.',
  technical: 'timeout',
};

beforeEach(() => {
  resetAppState();
  useUpdates.setState({ ...INITIAL_UPDATES_STATE });
});

describe('updates store', () => {
  it('walks from a check to an installed update', () => {
    const actions = useUpdates.getState();
    actions.startCheck();
    expect(useUpdates.getState()).toMatchObject({ status: 'checking', error: null });

    actions.foundUpdate('1.2.0', 'Notes.');
    expect(useUpdates.getState()).toMatchObject({
      status: 'available',
      version: '1.2.0',
      notes: 'Notes.',
    });
    expect(useUpdates.getState().lastCheckedAt).not.toBeNull();

    actions.startDownload(300);
    actions.addDownloaded(100);
    actions.addDownloaded(50);
    expect(useUpdates.getState()).toMatchObject({
      status: 'downloading',
      downloaded: 150,
      contentLength: 300,
    });

    actions.startInstall();
    expect(useUpdates.getState().status).toBe('installing');
  });

  it('clears a stale update when the app turns out to be current', () => {
    const actions = useUpdates.getState();
    actions.foundUpdate('1.2.0', 'Notes.');
    actions.foundNoUpdate();
    expect(useUpdates.getState()).toMatchObject({
      status: 'upToDate',
      version: null,
      notes: null,
      error: null,
    });
  });

  it('keeps the error of a failed check', () => {
    const actions = useUpdates.getState();
    actions.startCheck();
    actions.failUpdate(ERROR);
    expect(useUpdates.getState()).toMatchObject({ status: 'error', error: ERROR });
    actions.startCheck();
    expect(useUpdates.getState().error).toBeNull();
  });

  it('persists and restores the time of the last check', async () => {
    useUpdates.getState().foundNoUpdate();
    const checkedAt = useUpdates.getState().lastCheckedAt;
    await flushPersisted();
    expect(JSON.parse(window.localStorage.getItem('mdv:updates') ?? '{}')).toEqual({
      lastCheckedAt: checkedAt,
    });

    useUpdates.setState({ lastCheckedAt: null });
    await hydrateUpdates();
    expect(useUpdates.getState().lastCheckedAt).toBe(checkedAt);
  });

  it('ignores a corrupt stored timestamp', async () => {
    for (const stored of ['{not json', JSON.stringify({ lastCheckedAt: 'soon' }), '{}']) {
      window.localStorage.setItem('mdv:updates', stored);
      await hydrateUpdates();
      expect(useUpdates.getState().lastCheckedAt).toBeNull();
    }
  });
});
