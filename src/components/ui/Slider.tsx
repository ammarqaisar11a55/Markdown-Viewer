import type { CSSProperties } from 'react';

export interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  id?: string;
  labelledBy?: string;
  /** Formats the value readout and `aria-valuetext`. */
  format?: (value: number) => string;
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  id,
  labelledBy,
  format,
}: SliderProps) {
  const text = format ? format(value) : String(value);
  const percent = max === min ? 0 : ((value - min) / (max - min)) * 100;
  return (
    <div className="flex items-center gap-3">
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-labelledby={labelledBy}
        aria-valuetext={text}
        onChange={(event) => {
          onChange(Number(event.target.value));
        }}
        style={{ '--fill': `${percent}%` } as CSSProperties}
        className="mv-slider h-5 w-36 cursor-pointer appearance-none bg-transparent"
      />
      <output htmlFor={id} className="tabular w-11 text-right text-ui-sm text-fg-muted" aria-hidden>
        {text}
      </output>
    </div>
  );
}
