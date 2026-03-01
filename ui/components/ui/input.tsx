"use client";

import { cn } from "@/lib/cn";
import { type InputHTMLAttributes, type ReactNode, useId } from "react";

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
  id: idProp,
  ...props
}: InputProps) {
  const generatedId = useId();
  const id = idProp ?? generatedId;

  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex justify-between text-xs">
          <label htmlFor={id} className="text-[var(--gray-400)]">{label}</label>
        </div>
      )}
      <div className="relative">
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "w-full rounded-xl px-3 py-2.5 text-sm tabular",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(244,197,61,0.5)] focus-visible:ring-offset-0",
            "transition-[border-color] duration-150",
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
