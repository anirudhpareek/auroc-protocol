"use client";

import { TradeTicket } from "./TradeTicket";
import { OptionsTicket } from "./OptionsTicket";
import { useTerminal } from "./TerminalContext";
import type { Instrument } from "@/types";

const INSTRUMENTS: { key: Instrument; label: string }[] = [
  { key: "perp",    label: "Perp" },
  { key: "options", label: "Options" },
];

export function RightTradeStack() {
  const { activeInstrument, setActiveInstrument } = useTerminal();

  return (
    <div
      className="flex flex-col shrink-0 h-full"
      style={{
        width: 296,
        borderLeft: "1px solid var(--b1)",
        background: "var(--panel)",
      }}
    >
      {/* Instrument toggle */}
      <div
        className="flex shrink-0"
        style={{ borderBottom: "1px solid var(--b1)" }}
      >
        {INSTRUMENTS.map(({ key, label }) => {
          const active = activeInstrument === key;
          return (
            <button
              key={key}
              onClick={() => setActiveInstrument(key)}
              aria-pressed={active}
              className="flex-1 flex items-center justify-center gap-1 transition-[color,border-color] duration-100 border-b-2"
              style={{
                height: 34,
                fontSize: "var(--text-xs)",
                fontWeight: active ? "var(--fw-semibold)" as unknown as number : "var(--fw-regular)" as unknown as number,
                color: active ? "var(--t1)" : "var(--t3)",
                borderBottomColor: active ? "var(--gold)" : "transparent",
                background: "transparent",
              }}
            >
              {key === "options" && (
                <span
                  style={{
                    fontSize: "var(--text-2xs)",
                    fontWeight: 700,
                    padding: "1px 4px",
                    borderRadius: 3,
                    background: active ? "var(--gold)" : "var(--b2)",
                    color: active ? "#000" : "var(--t4)",
                    letterSpacing: "0.04em",
                  }}
                >
                  NEW
                </span>
              )}
              {label}
            </button>
          );
        })}
      </div>

      {/* Active panel */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeInstrument === "perp"    && <TradeTicket />}
        {activeInstrument === "options" && <OptionsTicket />}
      </div>
    </div>
  );
}
