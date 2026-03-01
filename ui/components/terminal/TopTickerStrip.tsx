"use client";

import { useAllMarkets } from "@/hooks/useMarketData";
import { formatPrice } from "@/lib/format";
import { AVAILABLE_TERMINAL_MARKETS, useTerminal, type TerminalMarket } from "./TerminalContext";

const STATIC_CHIPS: Array<{ sym: string; pair: string; price: string; chg: string; up: boolean; color: string }> = [
  { sym: "BTC", pair: "BTC/USD", price: "97,432.5", chg: "+2.34%", up: true,  color: "#f7931a" },
  { sym: "ETH", pair: "ETH/USD", price: "3,421.05", chg: "+1.82%", up: true,  color: "#627eea" },
  { sym: "SOL", pair: "SOL/USD", price: "187.34",   chg: "+3.21%", up: true,  color: "#9945ff" },
  { sym: "ARB", pair: "ARB/USD", price: "1.24",     chg: "-1.05%", up: false, color: "#12aaff" },
];

export function TopTickerStrip() {
  const { market, setMarket } = useTerminal();
  const { markets } = useAllMarkets();

  return (
    <div style={{
      height: "var(--h-ticker-strip)",
      display: "flex", alignItems: "center",
      background: "var(--surface)", borderBottom: "1px solid var(--b1)",
      overflowX: "auto", flexShrink: 0,
      /* Hide scrollbar */
    }}
    className="ticker-strip"
    >
      {/* Live market chips from AVAILABLE_TERMINAL_MARKETS */}
      {AVAILABLE_TERMINAL_MARKETS.map((m) => {
        const liveInfo = markets.find((mi) => mi.id === m.id);
        const priceStr = liveInfo && liveInfo.markPrice > 0n ? formatPrice(liveInfo.markPrice) : "—";
        const isActive = market.id === m.id;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => setMarket(m)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "0 14px", height: "100%", flexShrink: 0,
              cursor: "pointer", borderRight: "1px solid var(--b1)",
              borderBottom: isActive ? `2px solid ${m.color}` : "2px solid transparent",
              background: isActive ? "var(--raised)" : "transparent",
              transition: "background-color 0.1s, border-color 0.1s",
            }}
          >
            <span style={{
              width: 14, height: 14, borderRadius: "50%",
              background: m.color,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 7, fontWeight: 800, color: "#fff", flexShrink: 0,
            }} aria-hidden="true">{m.symbol[0]}</span>
            <span style={{
              fontSize: "var(--text-xs)",
              fontWeight: "var(--fw-medium)" as unknown as number,
              color: isActive ? "var(--t1)" : "var(--t2)",
            }}>{m.pair}</span>
            <span className="tabular" style={{
              fontSize: "var(--text-xs)",
              color: isActive ? "var(--t1)" : "var(--t2)",
            }}>${priceStr}</span>
          </button>
        );
      })}

      {/* Static chips (non-selectable) */}
      {STATIC_CHIPS.map((chip) => (
        <div
          key={chip.sym}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "0 14px", height: "100%", flexShrink: 0,
            borderRight: "1px solid var(--b1)",
            opacity: 0.65,
          }}
        >
          <span style={{
            width: 14, height: 14, borderRadius: "50%",
            background: chip.color,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 7, fontWeight: 800, color: "#fff", flexShrink: 0,
          }} aria-hidden="true">{chip.sym[0]}</span>
          <span style={{ fontSize: "var(--text-xs)", fontWeight: 500, color: "var(--t2)" }}>{chip.pair}</span>
          <span className="tabular" style={{ fontSize: "var(--text-xs)", color: "var(--t2)" }}>${chip.price}</span>
          <span style={{
            fontSize: "var(--text-2xs)", fontWeight: 500,
            color: chip.up ? "var(--long)" : "var(--short)",
          }}>{chip.chg}</span>
        </div>
      ))}

      <div style={{ flex: 1 }} />
    </div>
  );
}
