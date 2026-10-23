import { INITIAL_UPDATES_STATE, type UpdatesData } from '@/stores/updatesStore';
import { downloadPercent, formatUpdateStatus } from './status';

const state = (patch: Partial<UpdatesData>): UpdatesData => ({
  ...INITIAL_UPDATES_STATE,
  ...patch,
});

describe('formatUpdateStatus', () => {
  it('describes every stage', () => {
    expect(formatUpdateStatus(state({}))).toBe('Not checked yet.');
    expect(formatUpdateStatus(state({ status: 'checking' }))).toBe('Checking for updates…');
    expect(formatUpdateStatus(state({ status: 'upToDate' }))).toBe('You’re up to date.');
    expect(formatUpdateStatus(state({ status: 'available', version: '2.0.0' }))).toBe(
      'Version 2.0.0 is available.',
    );
    expect(formatUpdateStatus(state({ status: 'installing' }))).toBe('Installing the update…');
  });

  it('includes the download progress when the size is known', () => {
    const downloading = { status: 'downloading', downloaded: 25, contentLength: 50 } as const;
    expect(formatUpdateStatus(state(downloading))).toBe('Downloading the update… 50%');
    expect(formatUpdateStatus(state({ ...downloading, contentLength: null }))).toBe(
      'Downloading the update…',
    );
  });

  it('shows the time of the last check once there was one', () => {
    const text = formatUpdateStatus(state({ lastCheckedAt: Date.UTC(2026, 0, 2, 12, 0) }));
    expect(text).toMatch(/^Last checked .+\.$/);
  });

  it('falls back to a friendly title for a failed check', () => {
    expect(formatUpdateStatus(state({ status: 'error' }))).toBe('Could not check for updates.');
    expect(
      formatUpdateStatus(
        state({
          status: 'error',
          error: {
            kind: 'unknown',
            title: 'Could not install the update.',
            description: 'x',
            technical: 'y',
          },
        }),
      ),
    ).toBe('Could not install the update.');
  });

  it('reports no percentage without a known size', () => {
    expect(downloadPercent({ downloaded: 10, contentLength: null })).toBeNull();
    expect(downloadPercent({ downloaded: 10, contentLength: 0 })).toBeNull();
    expect(downloadPercent({ downloaded: 30, contentLength: 10 })).toBe(100);
  });
});
