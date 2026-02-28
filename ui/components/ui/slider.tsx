"use client";

import { cn } from "@/lib/cn";

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  marks?: number[];
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  marks = [0, 25, 50, 75, 100],
}: SliderProps) {
  const percent = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-2">
      <div className="relative h-1.5">
        <div className="absolute inset-0 bg-[var(--gray-800)] rounded-full" />
        <div
          className="absolute left-0 top-0 h-full bg-[var(--yellow)] rounded-full"
          style={{ width: `${percent}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md pointer-events-none"
          style={{ left: `calc(${percent}% - 6px)` }}
        />
      </div>
      <div className="flex justify-between">
        {marks.map((mark) => (
          <button
            key={mark}
            onClick={() => onChange(mark)}
            className={cn(
              "text-xs transition-colors",
              value >= mark ? "text-[var(--yellow)]" : "text-[var(--gray-600)]"
            )}
          >
            {mark}
          </button>
        ))}
      </div>
    </div>
  );
}
