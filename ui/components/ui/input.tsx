"use client";

import { cn } from "@/lib/cn";
import { type InputHTMLAttributes, type ReactNode } from "react";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  label?: string;
  suffix?: ReactNode;
  value: string;
  onChange: (value: string) => void;
}

export function Input({
  label,
  suffix,
  value,
  onChange,
  className,
  ...props
}: InputProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex justify-between text-xs">
          <span className="text-[var(--gray-400)]">{label}</span>
        </div>
      )}
      <div className="relative">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "w-full rounded-xl px-3 py-2.5 text-sm tabular",
            "focus:outline-none transition-all duration-150",
            "placeholder:text-[var(--text-muted)]",
            suffix && "pr-16",
            className
          )}
          style={{
            background: "var(--bg-elevated)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-default)",
          }}
          {...props}
        />
        {suffix && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: "var(--text-tertiary)" }}>
            {suffix}
          </div>
        )}
      </div>
    </div>
  );
}
