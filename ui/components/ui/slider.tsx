"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  showValue?: boolean;
  formatValue?: (value: number) => string;
  marks?: number[];
}

export const Slider = forwardRef<HTMLInputElement, SliderProps>(
  (
    {
      value,
      onChange,
      min = 0,
      max = 100,
      step = 1,
      label,
      showValue = true,
      formatValue = (v) => `${v}`,
      marks,
      className,
      ...props
    },
    ref
  ) => {
    const percentage = ((value - min) / (max - min)) * 100;

    return (
      <div className={cn("flex flex-col gap-2", className)}>
        {(label || showValue) && (
          <div className="flex items-center justify-between">
            {label && (
              <span className="text-[var(--text-sm)] text-[var(--text-secondary)]">
                {label}
              </span>
            )}
            {showValue && (
              <span className="text-[var(--text-sm)] font-semibold tabular-nums text-white">
                {formatValue(value)}
              </span>
            )}
          </div>
        )}

        <div className="relative">
          <input
            ref={ref}
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className={cn(
              "w-full h-2 appearance-none cursor-pointer",
              "bg-[var(--bg-surface)] rounded-full",
              "focus:outline-none",
              "[&::-webkit-slider-thumb]:appearance-none",
              "[&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4",
              "[&::-webkit-slider-thumb]:rounded-full",
              "[&::-webkit-slider-thumb]:bg-white",
              "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[var(--bg-void)]",
              "[&::-webkit-slider-thumb]:cursor-pointer",
              "[&::-webkit-slider-thumb]:shadow-md",
              "[&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-150",
              "[&::-webkit-slider-thumb]:hover:scale-110",
              "[&::-moz-range-thumb]:appearance-none",
              "[&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4",
              "[&::-moz-range-thumb]:rounded-full",
              "[&::-moz-range-thumb]:bg-white",
              "[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[var(--bg-void)]",
              "[&::-moz-range-thumb]:cursor-pointer"
            )}
            style={{
              background: `linear-gradient(to right, var(--accent-primary) 0%, var(--accent-primary) ${percentage}%, var(--bg-surface) ${percentage}%, var(--bg-surface) 100%)`,
            }}
            {...props}
          />

          {marks && (
            <div className="relative h-6 mt-2">
              {marks.map((mark) => {
                const markPercent = ((mark - min) / (max - min)) * 100;
                const isActive = value >= mark;
                return (
                  <button
                    key={mark}
                    type="button"
                    onClick={() => onChange(mark)}
                    className={cn(
                      "absolute -translate-x-1/2",
                      "text-[var(--text-xs)] tabular-nums font-medium",
                      "transition-colors duration-150",
                      isActive
                        ? "text-[var(--accent-primary)]"
                        : "text-[var(--text-muted)] hover:text-white"
                    )}
                    style={{ left: `${markPercent}%` }}
                  >
                    {formatValue(mark)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }
);

Slider.displayName = "Slider";

interface LeverageSliderProps {
  value: number;
  onChange: (value: number) => void;
  maxLeverage?: number;
}

export function LeverageSlider({
  value,
  onChange,
  maxLeverage = 100,
}: LeverageSliderProps) {
  const marks = [1, 25, 50, 75, 100].filter(m => m <= maxLeverage);

  const handleIncrement = () => {
    const newValue = Math.min(value + 1, maxLeverage);
    onChange(newValue);
  };

  const handleDecrement = () => {
    const newValue = Math.max(value - 1, 1);
    onChange(newValue);
  };

  return (
    <div className="space-y-3">
      {/* Header with controls */}
      <div className="flex items-center justify-between">
        <span className="text-[var(--text-sm)] text-[var(--text-secondary)]">
          Leverage
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDecrement}
            className="w-7 h-7 flex items-center justify-center rounded-md bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-white transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <div className="min-w-[48px] text-center">
            <span className="text-[var(--text-md)] font-semibold tabular-nums text-white">
              {value}x
            </span>
          </div>
          <button
            type="button"
            onClick={handleIncrement}
            className="w-7 h-7 flex items-center justify-center rounded-md bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-white transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Slider */}
      <div className="relative">
        <input
          type="range"
          min={1}
          max={maxLeverage}
          step={1}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className={cn(
            "w-full h-2 appearance-none cursor-pointer",
            "bg-[var(--bg-surface)] rounded-full",
            "focus:outline-none",
            "[&::-webkit-slider-thumb]:appearance-none",
            "[&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4",
            "[&::-webkit-slider-thumb]:rounded-full",
            "[&::-webkit-slider-thumb]:bg-white",
            "[&::-webkit-slider-thumb]:shadow-md",
            "[&::-webkit-slider-thumb]:cursor-pointer",
            "[&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-150",
            "[&::-webkit-slider-thumb]:hover:scale-110",
            "[&::-moz-range-thumb]:appearance-none",
            "[&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4",
            "[&::-moz-range-thumb]:rounded-full",
            "[&::-moz-range-thumb]:bg-white",
            "[&::-moz-range-thumb]:cursor-pointer"
          )}
          style={{
            background: `linear-gradient(to right, var(--accent-primary) 0%, var(--accent-primary) ${((value - 1) / (maxLeverage - 1)) * 100}%, var(--bg-surface) ${((value - 1) / (maxLeverage - 1)) * 100}%, var(--bg-surface) 100%)`,
          }}
        />

        {/* Marks */}
        <div className="relative h-6 mt-2">
          {marks.map((mark) => {
            const markPercent = ((mark - 1) / (maxLeverage - 1)) * 100;
            const isActive = value >= mark;
            return (
              <button
                key={mark}
                type="button"
                onClick={() => onChange(mark)}
                className={cn(
                  "absolute -translate-x-1/2",
                  "text-[var(--text-xs)] tabular-nums font-medium",
                  "transition-colors duration-150",
                  isActive
                    ? "text-[var(--accent-primary)]"
                    : "text-[var(--text-muted)] hover:text-white"
                )}
                style={{ left: `${markPercent}%` }}
              >
                {mark}x
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
