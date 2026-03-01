"use client";

import { useMarketData } from "@/hooks/useMarketData";
import { formatPrice } from "@/lib/format";
import { AVAILABLE_TERMINAL_MARKETS, useTerminal } from "./TerminalContext";

export function InstrumentCard() {
  const { market, setMarket } = useTerminal();
  const { marketInfo, isLoading } = useMarketData(market.id);
  const markStr = marketInfo && marketInfo.markPrice > 0n ? formatPrice(marketInfo.markPrice) : null;

  const change = market.id === AVAILABLE_TERMINAL_MARKETS[0].id ? { str: "+0.45%", up: true } : { str: "-0.12%", up: false };

  return (
    <div style={{
      padding: "10px var(--sp-3)",
      background: "var(--panel)",
      flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Avatar */}
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          background: market.color,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 800, color: "#fff", flexShrink: 0,
          boxShadow: `0 0 10px ${market.color}44`,
        }} aria-hidden="true">
          {market.symbol[0]}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Pair name as market switcher */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
            {AVAILABLE_TERMINAL_MARKETS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMarket(m)}
                style={{
                  fontSize: "var(--text-2xs)", fontWeight: 700,
                  padding: "1px 6px", borderRadius: "var(--radius-sm)",
                  background: m.id === market.id ? "var(--raised)" : "transparent",
                  color: m.id === market.id ? "var(--t1)" : "var(--t3)",
                  border: `1px solid ${m.id === market.id ? "var(--b3)" : "transparent"}`,
                  transition: "var(--transition-fast)",
                }}
              >
                {m.symbol}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            {isLoading || !markStr ? (
              <div className="animate-shimmer skel skel-card" style={{ height: 20, width: 100 }} />
            ) : (
              <>
                <span className="tabular" style={{ fontSize: "var(--text-lg)", fontWeight: "var(--fw-semibold)" as unknown as number, color: "var(--t1)", letterSpacing: "-0.03em" }}>
                  ${markStr}
                </span>
                <span style={{
                  fontSize: "var(--text-xs)", fontWeight: "var(--fw-medium)" as unknown as number,
                  color: change.up ? "var(--long)" : "var(--short)",
                }}>
                  {change.str}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
