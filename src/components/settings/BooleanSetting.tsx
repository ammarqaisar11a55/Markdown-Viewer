import { updateSettings, useSettings } from '@/stores/settingsStore';
import type { Settings } from '@/types';
import { Switch } from '@/components/ui/Switch';
import { SettingRow } from './SettingRow';

type BooleanKey = {
  [K in keyof Settings]: Settings[K] extends boolean ? K : never;
}[keyof Settings];

export interface BooleanSettingProps {
  setting: BooleanKey;
  label: string;
  description?: string;
}

export function BooleanSetting({ setting, label, description }: BooleanSettingProps) {
  const value = useSettings((s) => s[setting]);
  return (
    <SettingRow label={label} {...(description ? { description } : {})}>
      {({ labelId, descriptionId }) => (
        <Switch
          checked={value}
          labelledBy={labelId}
          {...(descriptionId ? { describedBy: descriptionId } : {})}
          onChange={(checked) => {
            const patch: Partial<Settings> = {};
            patch[setting] = checked;
            updateSettings(patch);
          }}
        />
      )}
    </SettingRow>
  );
}
