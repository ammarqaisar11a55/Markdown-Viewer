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

/** A square-cornered track with a square knob; on, it fills with the accent. */
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
        'relative inline-block h-5 w-[38px] shrink-0 border transition-colors duration-150',
        'disabled:opacity-45',
        checked ? 'border-accent bg-accent' : 'border-border-strong bg-transparent',
      )}
    >
      <span
        aria-hidden
        className={clsx(
          'absolute top-[3px] left-[3px] block size-3 transition-transform duration-150',
          checked ? 'translate-x-[18px] bg-accent-fg' : 'bg-fg-muted',
        )}
      />
    </button>
  );
}
