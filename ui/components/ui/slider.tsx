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
              <span className="text-[var(--text-sm)] font-medium tabular-nums">
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
              "bg-[var(--bg-elevated)] rounded-full",
              "focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:ring-offset-2 focus:ring-offset-[var(--bg-base)]",
              // Webkit slider thumb
              "[&::-webkit-slider-thumb]:appearance-none",
              "[&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4",
              "[&::-webkit-slider-thumb]:rounded-full",
              "[&::-webkit-slider-thumb]:bg-[var(--accent-primary)]",
              "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white",
              "[&::-webkit-slider-thumb]:shadow-md",
              "[&::-webkit-slider-thumb]:cursor-pointer",
              "[&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-100",
              "[&::-webkit-slider-thumb]:hover:scale-110",
              // Firefox slider thumb
              "[&::-moz-range-thumb]:appearance-none",
              "[&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4",
              "[&::-moz-range-thumb]:rounded-full",
              "[&::-moz-range-thumb]:bg-[var(--accent-primary)]",
              "[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white",
              "[&::-moz-range-thumb]:cursor-pointer"
            )}
            style={{
              background: `linear-gradient(to right, var(--accent-primary) 0%, var(--accent-primary) ${percentage}%, var(--bg-elevated) ${percentage}%, var(--bg-elevated) 100%)`,
            }}
            {...props}
          />

          {/* Marks */}
          {marks && (
            <div className="relative h-4 mt-1">
              {marks.map((mark) => {
                const markPercent = ((mark - min) / (max - min)) * 100;
                return (
                  <button
                    key={mark}
                    type="button"
                    onClick={() => onChange(mark)}
                    className={cn(
                      "absolute -translate-x-1/2",
                      "text-[var(--text-xs)] tabular-nums",
                      "hover:text-[var(--text-primary)] transition-colors",
                      value === mark
                        ? "text-[var(--accent-primary)]"
                        : "text-[var(--text-muted)]"
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

// Leverage slider specifically for trading
interface LeverageSliderProps {
  value: number;
  onChange: (value: number) => void;
  maxLeverage?: number;
}

export function LeverageSlider({
  value,
  onChange,
  maxLeverage = 10,
}: LeverageSliderProps) {
  const marks = [1, Math.floor(maxLeverage / 4), Math.floor(maxLeverage / 2), Math.floor(maxLeverage * 3 / 4), maxLeverage];

  return (
    <Slider
      value={value}
      onChange={onChange}
      min={1}
      max={maxLeverage}
      step={0.1}
      label="Leverage"
      formatValue={(v) => `${v.toFixed(1)}x`}
      marks={marks}
    />
  );
}
