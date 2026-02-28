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
            "w-full bg-[var(--gray-900)] border border-[var(--gray-800)]",
            "rounded-lg px-3 py-2.5 text-white text-sm",
            "focus:outline-none focus:border-[var(--gray-600)]",
            "placeholder:text-[var(--gray-600)]",
            suffix && "pr-16",
            className
          )}
          {...props}
        />
        {suffix && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--gray-400)]">
            {suffix}
          </div>
        )}
      </div>
    </div>
  );
}
