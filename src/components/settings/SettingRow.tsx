import { useId, type ReactNode } from 'react';

export interface SettingRowProps {
  label: string;
  description?: string;
  /** Renders the control, given ids for labelling. */
  children: (ids: { labelId: string; descriptionId: string | undefined }) => ReactNode;
}

/* A row on a settings pane: label (plus optional description) left, control
   right, 60px tall, closed by a hairline rule. */
export function SettingRow({ label, description, children }: SettingRowProps) {
  const labelId = useId();
  const descriptionId = useId();
  return (
    <div className="flex min-h-15 items-center gap-6 border-b border-border py-2.5">
      <div className="min-w-0 flex-1">
        <p id={labelId} className="text-[14px] leading-5 text-fg">
          {label}
        </p>
        {description && (
          <p id={descriptionId} className="mt-0.5 text-ui-sm text-fg-muted">
            {description}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2.5">
        {children({ labelId, descriptionId: description ? descriptionId : undefined })}
      </div>
    </div>
  );
}
