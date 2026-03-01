"use client";

import { useMarketData } from "@/hooks/useMarketData";
import { formatPrice } from "@/lib/format";
import { Regime } from "@/types";
import { AVAILABLE_TERMINAL_MARKETS, useTerminal } from "./TerminalContext";

const MARKETS_CFG = [
  {
    id: AVAILABLE_TERMINAL_MARKETS[0].id,
    oracleStr: "2,890.15", vol: "$287M", oi: "$124.7M",
    funding: "-0.0031%", fundingUp: false, change: "+0.45%", changeUp: true,
  },
  {
    id: AVAILABLE_TERMINAL_MARKETS[1].id,
    oracleStr: "5,234.95", vol: "$156M", oi: "$89.4M",
    funding: "-0.0018%", fundingUp: false, change: "-0.12%", changeUp: false,
  },
] as const;

function Sep() {
  return <div aria-hidden="true" style={{ width: 1, height: 26, background: "var(--b1)", flexShrink: 0 }} />;
}

function StatCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
      <span className="label-upper">{label}</span>
      <span className="tabular" style={{ fontSize: "var(--text-xs)", color: color ?? "var(--t2)" }}>
        {value}
      </span>
    </div>
  );
}

export function MarketTickerBar() {
  const { market, setMarket } = useTerminal();
  const cfg = MARKETS_CFG.find((m) => m.id === market.id) ?? MARKETS_CFG[0];
  const { marketInfo, isLoading } = useMarketData(market.id);
  const markStr = marketInfo && marketInfo.markPrice > 0n ? formatPrice(marketInfo.markPrice) : null;

  return (
    <div style={{
      height: "var(--h-market-header)",
      display: "flex", alignItems: "center", gap: 14,
      padding: "0 14px",
      background: "var(--surface)", borderBottom: "1px solid var(--b1)",
      flexShrink: 0, overflow: "hidden",
    }}>
      {/* Market selector */}
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        {AVAILABLE_TERMINAL_MARKETS.map((m) => {
          const active = m.id === market.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setMarket(m)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "4px 10px", borderRadius: "var(--radius-md)",
                fontSize: "var(--text-xs)", fontWeight: 600,
                background: active ? "var(--raised)" : "transparent",
                color: active ? "var(--t1)" : "var(--t3)",
                border: `1px solid ${active ? "var(--b3)" : "transparent"}`,
                transition: "var(--transition-fast)",
              }}
            >
              <span style={{
                width: 16, height: 16, borderRadius: "50%", background: m.color,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 7, fontWeight: 800, color: "#fff", flexShrink: 0,
              }} aria-hidden="true">{m.symbol[0]}</span>
              {m.pair}
            </button>
          );
        })}
      </div>

      <Sep />

      {/* Mark price + 24h change */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexShrink: 0 }}>
        {isLoading || !markStr ? (
          <div className="animate-shimmer skel skel-sm" style={{ height: 22, width: 100 }} />
        ) : (
          <>
            <span className="tabular" style={{
              fontSize: "var(--text-xl)",
              fontWeight: "var(--fw-semibold)" as unknown as number,
              color: "var(--t1)", letterSpacing: "-0.04em",
            }}>
              ${markStr}
            </span>
            <span style={{
              fontSize: "var(--text-sm)",
              fontWeight: "var(--fw-medium)" as unknown as number,
              color: cfg.changeUp ? "var(--long)" : "var(--short)",
            }}>
              {cfg.change}
            </span>
          </>
        )}
      </div>

      <Sep />
      <StatCell label="Mark" value={markStr ? `$${markStr}` : "—"} />
      <Sep />
      <StatCell label="Oracle" value={`$${cfg.oracleStr}`} />
      <Sep />
      <StatCell
        label="Funding"
        value={cfg.funding}
        color={cfg.fundingUp ? "var(--long)" : "var(--short)"}
      />
      <Sep />
      <StatCell label="24h Vol" value={cfg.vol} />
      <Sep />
      <StatCell label="Open Interest" value={cfg.oi} />

      <div style={{ flex: 1 }} />

      {marketInfo && (
        <div style={{
          padding: "2px 8px", borderRadius: "var(--radius-sm)",
          fontSize: "var(--text-2xs)",
          fontWeight: "var(--fw-semibold)" as unknown as number,
          background: marketInfo.regime === Regime.OPEN ? "var(--long-dim)" : "var(--warning-dim)",
          color: marketInfo.regime === Regime.OPEN ? "var(--long)" : "var(--warning)",
          border: `1px solid ${marketInfo.regime === Regime.OPEN ? "var(--long-mid)" : "var(--warning-mid)"}`,
          letterSpacing: "0.06em", flexShrink: 0,
        }}>
          {marketInfo.regime === Regime.OPEN ? "● OPEN" : "● OFF-HOURS"}
        </div>
      )}
    </div>
  );
}
