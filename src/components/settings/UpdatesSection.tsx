import { checkForUpdates, installUpdate } from '@/features/updates/actions';
import { downloadPercent, formatUpdateStatus } from '@/features/updates/status';
import { useAppVersion } from '@/features/updates/useAppVersion';
import { useUpdates } from '@/stores/updatesStore';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { BooleanSetting } from './BooleanSetting';
import { SettingRow, SettingSection } from './SettingRow';

const BUSY = new Set(['checking', 'downloading', 'installing']);

export function UpdatesSection() {
  const version = useAppVersion();
  const state = useUpdates();
  const busy = BUSY.has(state.status);
  const percent = state.status === 'downloading' ? downloadPercent(state) : null;

  return (
    <SettingSection title="Updates">
      <SettingRow
        label={version === null ? 'Markdown Viewer' : `Markdown Viewer ${version}`}
        description={formatUpdateStatus(state)}
      >
        {() =>
          state.status === 'available' ? (
            <Button variant="primary" size="sm" onClick={() => void installUpdate()}>
              Install Update
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={busy}
              icon={busy ? <Spinner /> : undefined}
              onClick={() => void checkForUpdates({ manual: true })}
            >
              Check for Updates
            </Button>
          )
        }
      </SettingRow>
      {percent !== null && (
        <div
          role="progressbar"
          aria-label="Download progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="my-2 h-1 overflow-hidden rounded-full bg-bg-inset"
        >
          <div className="h-full bg-accent transition-[width]" style={{ width: `${percent}%` }} />
        </div>
      )}
      {state.status === 'available' && state.notes !== null && (
        <p className="selectable max-h-24 overflow-y-auto py-2 text-ui-sm whitespace-pre-line text-fg-muted">
          {state.notes}
        </p>
      )}
      <BooleanSetting
        setting="autoCheckUpdates"
        label="Check for updates automatically"
        description="Looks for a new version once a day, in the background."
      />
    </SettingSection>
  );
}
