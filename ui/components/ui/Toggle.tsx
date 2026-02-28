"use client";

import { cn } from "@/lib/cn";

interface ToggleProps {
  value: "long" | "short";
  onChange: (value: "long" | "short") => void;
}

export function Toggle({ value, onChange }: ToggleProps) {
  return (
    <div
      className="flex gap-1.5 p-1 rounded-xl"
      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
    >
      {(["long", "short"] as const).map((d) => {
        const active = value === d;
        const isLong = d === "long";
        return (
          <button
            key={d}
            onClick={() => onChange(d)}
            className="flex-1 py-2 rounded-lg text-xs font-bold tracking-wide transition-all duration-200 active:scale-[0.97] relative overflow-hidden"
            style={
              active
                ? {
                    background: isLong
                      ? "linear-gradient(135deg, #009f5e 0%, var(--long) 100%)"
                      : "linear-gradient(135deg, #a01f36 0%, var(--short) 100%)",
                    color: "#000",
                    boxShadow: isLong
                      ? "0 0 18px var(--long-glow), inset 0 1px 0 rgba(255,255,255,0.18)"
                      : "0 0 18px var(--short-glow), inset 0 1px 0 rgba(255,255,255,0.10)",
                  }
                : { background: "transparent", color: "var(--text-muted)" }
            }
          >
            {active && (
              <span
                className="absolute inset-0 pointer-events-none"
                style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.12) 0%, transparent 55%)" }}
              />
            )}
            <span className="relative">{isLong ? "▲ Long" : "▼ Short"}</span>
          </button>
        );
      })}
    </div>
  );
}
