"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftAddon?: ReactNode;
  rightAddon?: ReactNode;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      leftAddon,
      rightAddon,
      fullWidth = true,
      className,
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className={cn("flex flex-col gap-1.5", fullWidth && "w-full")}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-[var(--text-sm)] font-medium text-[var(--text-secondary)]"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftAddon && (
            <div className="absolute left-3 text-[var(--text-muted)]">
              {leftAddon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "w-full h-10",
              "bg-[var(--bg-elevated)]",
              "border rounded-[var(--radius-md)]",
              "text-[var(--text-primary)] text-[var(--text-base)]",
              "placeholder:text-[var(--text-muted)]",
              "transition-colors duration-[var(--transition-fast)]",
              "focus:outline-none",
              // Border colors based on state
              error
                ? "border-[var(--color-short)] focus:border-[var(--color-short)]"
                : "border-[var(--border-default)] hover:border-[var(--border-strong)] focus:border-[var(--accent-primary)]",
              // Padding adjustments for addons
              leftAddon ? "pl-10" : "pl-3",
              rightAddon ? "pr-10" : "pr-3",
              className
            )}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={
              error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
            }
            {...props}
          />
          {rightAddon && (
            <div className="absolute right-3 text-[var(--text-muted)]">
              {rightAddon}
            </div>
          )}
        </div>
        {error && (
          <p
            id={`${inputId}-error`}
            className="text-[var(--text-xs)] text-[var(--color-short)]"
          >
            {error}
          </p>
        )}
        {hint && !error && (
          <p
            id={`${inputId}-hint`}
            className="text-[var(--text-xs)] text-[var(--text-muted)]"
          >
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

// Specialized numeric input for trading
interface NumericInputProps extends Omit<InputProps, "type" | "onChange"> {
  value: string;
  onChange: (value: string) => void;
  decimals?: number;
  min?: number;
  max?: number;
}

export const NumericInput = forwardRef<HTMLInputElement, NumericInputProps>(
  ({ value, onChange, decimals = 2, min, max, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;

      // Allow empty string
      if (newValue === "") {
        onChange("");
        return;
      }

      // Validate numeric format
      const regex = new RegExp(`^\\d*\\.?\\d{0,${decimals}}$`);
      if (!regex.test(newValue)) {
        return;
      }

      // Check bounds
      const numValue = parseFloat(newValue);
      if (!isNaN(numValue)) {
        if (min !== undefined && numValue < min) return;
        if (max !== undefined && numValue > max) return;
      }

      onChange(newValue);
    };

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={handleChange}
        className="tabular-nums text-right"
        {...props}
      />
    );
  }
);

NumericInput.displayName = "NumericInput";
