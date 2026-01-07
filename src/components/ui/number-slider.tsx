import * as React from "react";
import { cn } from "@/lib/utils";

interface NumberSliderProps {
  min?: number;
  max?: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  className?: string;
  disabled?: boolean;
}

const NumberSlider = React.forwardRef<HTMLDivElement, NumberSliderProps>(
  (
    {
      min = 1,
      max = 24,
      step = 1,
      value,
      onChange,
      className,
      disabled = false,
    },
    ref,
  ) => {
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange(Number(event.target.value));
    };

    const handleButtonAdjust = (delta: number) => {
      onChange(Math.min(max, Math.max(min, value + delta)));
    };

    return (
      <div ref={ref} className={cn("flex flex-col gap-3", className)}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-600 transition hover:border-emerald-300 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-emerald-400 dark:hover:text-emerald-300"
            onClick={() => handleButtonAdjust(-step)}
            disabled={disabled || value <= min}
          >
            −
          </button>
          <div className="flex min-w-[56px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
            {value}
          </div>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-600 transition hover:border-emerald-300 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-emerald-400 dark:hover:text-emerald-300"
            onClick={() => handleButtonAdjust(step)}
            disabled={disabled || value >= max}
          >
            +
          </button>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={handleChange}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-800 dark:accent-emerald-400"
        />
      </div>
    );
  },
);

NumberSlider.displayName = "NumberSlider";

export { NumberSlider };
