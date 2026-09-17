import { clsx } from 'clsx';
import { useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  /** Accessible name of the group. */
  label?: string;
  labelledBy?: string;
  id?: string;
  className?: string;
}

/** Radio group styled as a compact segmented control (roving tab index). */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
  labelledBy,
  id,
  className,
}: SegmentedControlProps<T>) {
  const groupRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = options.findIndex((option) => option.value === value);
    let next = -1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = index + 1;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = index - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = options.length - 1;
    else return;
    event.preventDefault();
    const wrapped = (next + options.length) % options.length;
    const option = options[wrapped];
    if (!option) return;
    onChange(option.value);
    groupRef.current?.querySelectorAll<HTMLElement>('[role="radio"]')[wrapped]?.focus();
  };

  return (
    <div
      ref={groupRef}
      id={id}
      role="radiogroup"
      aria-label={label}
      aria-labelledby={labelledBy}
      className={clsx(
        'inline-flex h-7 items-center gap-0.5 rounded-md border border-border bg-bg-inset p-0.5',
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onKeyDown={onKeyDown}
            onClick={() => {
              onChange(option.value);
            }}
            className={clsx(
              'inline-flex h-full items-center gap-1.5 rounded-sm px-2.5 text-ui-sm font-medium',
              'transition-colors duration-100 [&_svg]:size-3.5',
              selected
                ? 'bg-bg-elevated text-fg shadow-[0_0_0_1px_var(--border),0_1px_2px_rgb(0_0_0/0.06)]'
                : 'text-fg-muted hover:text-fg',
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
