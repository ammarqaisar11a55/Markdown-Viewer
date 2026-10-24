import { checkForUpdates, installUpdate } from '@/features/updates/actions';
import { downloadPercent, formatUpdateStatus, installHint } from '@/features/updates/status';
import { useAppVersion } from '@/features/updates/useAppVersion';
import { useInstallFlavor } from '@/features/updates/useInstallFlavor';
import { useUpdates } from '@/stores/updatesStore';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { BooleanSetting } from './BooleanSetting';
import { ReleaseNotes } from './ReleaseNotes';
import { SettingRow } from './SettingRow';

const BUSY = new Set(['checking', 'downloading', 'installing']);

export function UpdatesSection() {
  const version = useAppVersion();
  const state = useUpdates();
  const busy = BUSY.has(state.status);
  const percent = state.status === 'downloading' ? downloadPercent(state) : null;
  // The hint joins the status line, so it also describes the button beside it.
  const hint = installHint(useInstallFlavor());
  const status = formatUpdateStatus(state);

  return (
    <>
      {state.status === 'available' && <ReleaseNotes version={state.version} notes={state.notes} />}
      <SettingRow
        label={version === null ? 'Markdown Viewer' : `Markdown Viewer ${version}`}
        description={hint === null ? status : `${status} ${hint}`}
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
          className="my-2 h-1 overflow-hidden bg-bg-inset"
        >
          <div className="h-full bg-accent transition-[width]" style={{ width: `${percent}%` }} />
        </div>
      )}
      <BooleanSetting
        setting="autoCheckUpdates"
        label="Check for updates automatically"
        description="Looks for a new version once a day, in the background."
      />
    </>
  );
}
