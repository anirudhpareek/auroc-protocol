"use client";

import { useMarketData } from "@/hooks/useMarketData";
import { formatPrice } from "@/lib/format";
import { Regime } from "@/types";
import { AVAILABLE_TERMINAL_MARKETS, useTerminal } from "./TerminalContext";

const MARKETS_CFG = [
  {
    id: AVAILABLE_TERMINAL_MARKETS[0].id,
    sym: "XAU", pair: "XAU/USD", name: "Gold",
    color: "#d4a017", oracleStr: "2,890.15", vol: "$287M", oi: "$124.7M",
    funding: "-0.0031%", fundingUp: false, change: "+0.45%", changeUp: true,
  },
  {
    id: AVAILABLE_TERMINAL_MARKETS[1].id,
    sym: "SPX", pair: "SPX/USD", name: "S&P 500",
    color: "#6366f1", oracleStr: "5,234.95", vol: "$156M", oi: "$89.4M",
    funding: "-0.0018%", fundingUp: false, change: "-0.12%", changeUp: false,
  },
] as const;

const sep = <div aria-hidden="true" style={{ width: 1, height: 22, background: "var(--b1)", flexShrink: 0 }} />;

export function MarketHeaderBar() {
  const { market, setMarket } = useTerminal();
  const cfg = MARKETS_CFG.find((m) => m.id === market.id) ?? MARKETS_CFG[0];
  const { marketInfo, isLoading } = useMarketData(market.id);
  const markStr = marketInfo && marketInfo.markPrice > 0n ? formatPrice(marketInfo.markPrice) : null;

  return (
    <div style={{
      height: "var(--h-market-header)",
      display: "flex", alignItems: "center", gap: 14,
      padding: "0 14px", background: "var(--surface)", borderBottom: "1px solid var(--b1)",
      flexShrink: 0, overflow: "hidden",
      boxShadow: "inset 0 1px 0 rgba(245,200,66,0.07)",
    }}>
      {/* Favourite */}
      <button aria-label="Add to watchlist" style={{ color: "var(--t3)", fontSize: "var(--text-md)", flexShrink: 0, transition: "color 0.1s" }}>☆</button>

      {/* Market selector */}
      <div style={{ display: "flex", gap: 6 }}>
        {AVAILABLE_TERMINAL_MARKETS.map((m) => (
          <button
            key={m.id}
            onClick={() => setMarket(m)}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "3px 9px", borderRadius: "var(--radius-md)",
              fontSize: "var(--text-xs)", fontWeight: 600,
              background: m.id === market.id ? "var(--raised)" : "transparent",
              color: m.id === market.id ? "var(--t1)" : "var(--t3)",
              border: `1px solid ${m.id === market.id ? "var(--b3)" : "transparent"}`,
              transition: "var(--transition-fast)",
            }}
          >
            <span style={{
              width: 18, height: 18, borderRadius: "50%", background: m.color,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 7, fontWeight: 800, color: "#fff", flexShrink: 0,
            }} aria-hidden="true">{m.symbol[0]}</span>
            {m.pair}
          </button>
        ))}
      </div>

      {sep}

      {/* Price */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
        {isLoading || !markStr ? (
          <div className="animate-shimmer skel skel-sm" />
        ) : (
          <span className="tabular" style={{ fontSize: "var(--text-xl)", fontWeight: "var(--fw-semibold)" as unknown as number, color: "var(--t1)", letterSpacing: "-0.04em" }}>
            ${markStr}
          </span>
        )}
        <span style={{ fontSize: "var(--text-sm)", fontWeight: "var(--fw-medium)" as unknown as number, color: cfg.changeUp ? "var(--long)" : "var(--short)" }}>
          {cfg.change}
        </span>
      </div>

      {sep}
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <span className="label-upper">Oracle</span>
        <span className="tabular" style={{ fontSize: "var(--text-xs)", color: "var(--t2)" }}>{cfg.oracleStr}</span>
      </div>
      {sep}
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <span className="label-upper">24h Vol</span>
        <span className="tabular" style={{ fontSize: "var(--text-xs)", color: "var(--t2)" }}>{cfg.vol}</span>
      </div>
      {sep}
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <span className="label-upper">Open Interest</span>
        <span className="tabular" style={{ fontSize: "var(--text-xs)", color: "var(--t2)" }}>{cfg.oi}</span>
      </div>
      {sep}
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <span className="label-upper">Funding</span>
        <span className="tabular" style={{ fontSize: "var(--text-xs)", color: cfg.fundingUp ? "var(--long)" : "var(--short)" }}>
          {cfg.funding}
        </span>
      </div>

      <div style={{ flex: 1 }} />

      {marketInfo && (
        <div style={{
          padding: "2px 8px", borderRadius: "var(--radius-sm)",
          fontSize: "var(--text-2xs)", fontWeight: "var(--fw-semibold)" as unknown as number,
          background: marketInfo.regime === Regime.OPEN ? "var(--long-dim)" : "var(--warning-dim)",
          color: marketInfo.regime === Regime.OPEN ? "var(--long)" : "var(--warning)",
          border: `1px solid ${marketInfo.regime === Regime.OPEN ? "var(--long-mid)" : "var(--warning-mid)"}`,
          letterSpacing: "0.06em",
        }}>
          {marketInfo.regime === Regime.OPEN ? "● OPEN" : "● OFF-HOURS"}
        </div>
      )}
    </div>
  );
}
