import { clsx } from 'clsx';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  /** Id of the visible label element. */
  labelledBy?: string;
  describedBy?: string;
  disabled?: boolean;
}

export function Switch({ checked, onChange, id, labelledBy, describedBy, disabled }: SwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => {
        onChange(!checked);
      }}
      className={clsx(
        'relative inline-flex h-[18px] w-8 shrink-0 items-center rounded-full border transition-colors duration-150',
        'focus-visible:rounded-full disabled:opacity-50',
        checked ? 'border-accent bg-accent' : 'border-border-strong bg-bg-muted',
      )}
    >
      <span
        aria-hidden
        className={clsx(
          'block size-3 rounded-full shadow-sm transition-transform duration-150',
          checked ? 'bg-accent-fg translate-x-[15px]' : 'bg-bg-elevated translate-x-[2px]',
        )}
      />
    </button>
  );
}
