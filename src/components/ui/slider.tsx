import React from "react";
import { cn } from "@/lib/utils";

interface SliderProps {
  min: number;
  max: number;
  step: number;
  value: number;
  onValueChange: (value: number) => void;
  className?: string;
  showValue?: boolean;
  valueFormatter?: (value: number) => string;
  activeColor?: string;
  inactiveColor?: string;
  thumbClassName?: string;
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  (
    {
      min,
      max,
      step,
      value,
      onValueChange,
      className,
      showValue = true,
      valueFormatter,
      activeColor = "var(--coral)",
      inactiveColor = "rgba(229, 231, 235, 1)",
      thumbClassName,
      ...props
    },
    ref,
  ) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onValueChange(Number(e.target.value));
    };

    const displayValue = valueFormatter
      ? valueFormatter(value)
      : value.toString();

    // Calculate thumb position as percentage
    const thumbPosition = ((value - min) / (max - min)) * 100;

    // Create paw SVG based on the current value - simple paw shape
    const createPawIcon = () => (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="inline-block flex-shrink-0"
      >
        {/* 4-toe paw with heel pad */}
        <ellipse cx="12" cy="16" rx="3.2" ry="2.6" fill="white" />
        <ellipse cx="8.2" cy="10.2" rx="1.7" ry="2.2" fill="white" />
        <ellipse cx="10.8" cy="8.4" rx="1.7" ry="2.2" fill="white" />
        <ellipse cx="13.2" cy="8.4" rx="1.7" ry="2.2" fill="white" />
        <ellipse cx="15.8" cy="10.2" rx="1.7" ry="2.2" fill="white" />
        <ellipse cx="12" cy="18.2" rx="1.6" ry="1.1" fill="white" />
      </svg>
    );

    // Create paw icons based on the current value
    const pawPrints = Array.from({ length: value }, (_, i) => (
      <span key={i} className="inline-block mx-0.5">
        {createPawIcon()}
      </span>
    ));

    return (
      <div className={cn("w-full", className)}>
        <div className="relative">
          <input
            ref={ref}
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={handleChange}
            className={cn(
              "w-full h-2 rounded-lg appearance-none cursor-pointer slider bg-transparent",
              "focus:outline-none focus:ring-2 focus:ring-[rgba(20,92,69,0.35)] focus:ring-offset-0 md:focus:ring-[#145c45]/30",
            )}
            style={{
              background: `linear-gradient(to right, ${activeColor} 0%, ${activeColor} ${thumbPosition}%, ${inactiveColor} ${thumbPosition}%, ${inactiveColor} 100%)`,
            }}
            {...props}
          />

          {/* Custom Paw Thumb Overlay */}
          <div
            className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 pointer-events-none transition-all duration-200 hover:scale-110"
            style={{
              left: `${thumbPosition}%`,
              zIndex: 10,
            }}
          >
            <div
              className={cn(
                "rounded-full border-2 border-white shadow-lg flex items-center justify-center text-sm font-medium overflow-hidden bg-gradient-to-r from-[#145c45] to-[#0f4733]",
                thumbClassName,
                value === 1
                  ? "w-9 h-9"
                  : value === 2
                    ? "w-14 h-9"
                    : value === 3
                      ? "w-18 h-9"
                      : value === 4
                        ? "w-24 h-10"
                        : "w-9 h-9",
              )}
            >
              <div className="flex items-center justify-center">
                {pawPrints}
              </div>
            </div>
          </div>

          {showValue && (
            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2">
              <div className="text-white text-sm font-medium px-2 py-1 rounded shadow-sm hero-button-gradient text-brand-deep">
                {displayValue}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  },
);

Slider.displayName = "Slider";

export { Slider };
