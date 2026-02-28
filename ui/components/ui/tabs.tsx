"use client";

interface TabsProps {
  tabs: string[];
  value: string;
  onChange: (value: string) => void;
}

export function Tabs({ tabs, value, onChange }: TabsProps) {
  return (
    <div className="flex gap-0.5">
      {tabs.map((tab) => {
        const active = tab === value;
        return (
          <button
            key={tab}
            onClick={() => onChange(tab)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-100"
            style={
              active
                ? { background: "var(--bg-overlay)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }
                : { background: "transparent", color: "var(--text-tertiary)", border: "1px solid transparent" }
            }
          >
            {tab}
          </button>
        );
      })}
    </div>
  );
}
