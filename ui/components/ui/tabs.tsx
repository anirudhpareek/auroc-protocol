"use client";

import { cn } from "@/lib/cn";

interface TabsProps {
  tabs: string[];
  value: string;
  onChange: (value: string) => void;
}

export function Tabs({ tabs, value, onChange }: TabsProps) {
  return (
    <div className="flex gap-1">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={cn(
            "px-3 py-1.5 text-sm font-medium rounded-md transition-all",
            value === tab
              ? "bg-[var(--gray-800)] text-white"
              : "text-[var(--gray-500)] hover:text-white"
          )}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
