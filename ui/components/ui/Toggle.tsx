"use client";

import { cn } from "@/lib/cn";

interface ToggleProps {
  value: "long" | "short";
  onChange: (value: "long" | "short") => void;
}

export function Toggle({ value, onChange }: ToggleProps) {
  return (
    <div className="flex gap-2">
      <button
        onClick={() => onChange("long")}
        className={cn(
          "flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all",
          value === "long"
            ? "bg-[var(--green)] text-black"
            : "bg-[var(--gray-900)] text-[var(--gray-500)] hover:text-white"
        )}
      >
        Long
      </button>
      <button
        onClick={() => onChange("short")}
        className={cn(
          "flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all",
          value === "short"
            ? "bg-[var(--red)] text-white"
            : "bg-[var(--gray-900)] text-[var(--gray-500)] hover:text-white"
        )}
      >
        Short
      </button>
    </div>
  );
}
