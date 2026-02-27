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
              <span className="text-[var(--text-2xs)] text-[var(--text-muted)] uppercase tracking-widest font-medium">
                {label}
              </span>
            )}
            {showValue && (
              <span className="text-[var(--text-sm)] font-bold tabular-nums text-[var(--accent-primary)]">
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
              "w-full h-1.5 appearance-none cursor-pointer",
              "bg-[var(--bg-void)] rounded-full",
              "border border-[var(--border-subtle)]",
              "focus:outline-none",
              // Webkit slider thumb
              "[&::-webkit-slider-thumb]:appearance-none",
              "[&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4",
              "[&::-webkit-slider-thumb]:rounded-full",
              "[&::-webkit-slider-thumb]:bg-[var(--accent-primary)]",
              "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[var(--bg-void)]",
              "[&::-webkit-slider-thumb]:shadow-[0_0_8px_var(--accent-primary-glow)]",
              "[&::-webkit-slider-thumb]:cursor-pointer",
              "[&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:duration-150",
              "[&::-webkit-slider-thumb]:hover:scale-110",
              "[&::-webkit-slider-thumb]:hover:shadow-[0_0_12px_var(--accent-primary-glow)]",
              // Firefox slider thumb
              "[&::-moz-range-thumb]:appearance-none",
              "[&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4",
              "[&::-moz-range-thumb]:rounded-full",
              "[&::-moz-range-thumb]:bg-[var(--accent-primary)]",
              "[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[var(--bg-void)]",
              "[&::-moz-range-thumb]:cursor-pointer"
            )}
            style={{
              background: `linear-gradient(to right, var(--accent-primary) 0%, var(--accent-primary) ${percentage}%, var(--bg-void) ${percentage}%, var(--bg-void) 100%)`,
            }}
            {...props}
          />

          {/* Marks */}
          {marks && (
            <div className="relative h-5 mt-2">
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
                      "text-[var(--text-2xs)] tabular-nums font-semibold",
                      "transition-all duration-150",
                      "hover:scale-110",
                      isActive
                        ? "text-[var(--accent-primary)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
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

  // Determine color based on leverage risk
  const getRiskLevel = () => {
    const ratio = value / maxLeverage;
    if (ratio < 0.4) return "low";
    if (ratio < 0.7) return "medium";
    return "high";
  };

  const riskLevel = getRiskLevel();

  return (
    <div className="space-y-2">
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
      <div className="flex items-center justify-between">
        <span className="text-[var(--text-2xs)] text-[var(--text-muted)]">
          Risk Level
        </span>
        <span className={cn(
          "text-[var(--text-2xs)] font-semibold uppercase tracking-wider",
          riskLevel === "low" && "text-[var(--color-long)]",
          riskLevel === "medium" && "text-[var(--color-warning)]",
          riskLevel === "high" && "text-[var(--color-short)]"
        )}>
          {riskLevel}
        </span>
      </div>
    </div>
  );
}
