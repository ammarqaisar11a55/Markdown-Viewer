import { useId, type ReactNode } from 'react';

export interface SettingRowProps {
  label: string;
  description?: string;
  /** Renders the control, given ids for labelling. */
  children: (ids: { labelId: string; descriptionId: string | undefined }) => ReactNode;
}

export function SettingRow({ label, description, children }: SettingRowProps) {
  const labelId = useId();
  const descriptionId = useId();
  return (
    <div className="flex min-h-12 items-center gap-6 py-2.5">
      <div className="min-w-0 flex-1">
        <p id={labelId} className="text-ui text-fg">
          {label}
        </p>
        {description && (
          <p id={descriptionId} className="text-ui-sm text-fg-subtle mt-0.5">
            {description}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center">
        {children({ labelId, descriptionId: description ? descriptionId : undefined })}
      </div>
    </div>
  );
}

export function SettingSection({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="px-5 pt-4 pb-2">
      <h3 id={id} className="text-ui-sm text-fg-muted pb-1 font-semibold">
        {title}
      </h3>
      <div className="divide-border divide-y">{children}</div>
    </section>
  );
}
