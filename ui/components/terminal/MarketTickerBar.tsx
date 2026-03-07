"use client";

import { useMarketData } from "@/hooks/useMarketData";
import { formatPrice } from "@/lib/format";
import { Regime } from "@/types";
import { AVAILABLE_TERMINAL_MARKETS, useTerminal } from "./TerminalContext";
import { AssetIcon } from "./AssetIcon";

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
  return <div aria-hidden="true" className="w-px shrink-0" style={{ height: 26, background: "var(--b1)" }} />;
}

function StatCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5 shrink-0">
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
    <div
      className="flex items-center gap-3.5 shrink-0 overflow-hidden"
      style={{
        height: "var(--h-market-header)",
        padding: "0 14px",
        background: "var(--surface)",
        borderBottom: "1px solid var(--b1)",
      }}
    >
      {/* Market selector */}
      <div className="flex gap-1 shrink-0">
        {AVAILABLE_TERMINAL_MARKETS.map((m) => {
          const active = m.id === market.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setMarket(m)}
              className="flex items-center gap-1.5 transition-colors"
              style={{
                padding: "4px 10px",
                borderRadius: "var(--radius-md)",
                fontSize: "var(--text-xs)",
                fontWeight: 600,
                background: active ? "var(--raised)" : "transparent",
                color: active ? "var(--t1)" : "var(--t3)",
                border: `1px solid ${active ? "var(--b3)" : "transparent"}`,
              }}
            >
              <AssetIcon symbol={m.symbol} color={m.color} size={16} />
              {m.pair}
            </button>
          );
        })}
      </div>

      <Sep />

      {/* Mark price + 24h change */}
      <div className="flex items-baseline gap-2 shrink-0">
        {isLoading || !markStr ? (
          <div className="animate-shimmer skel skel-sm" style={{ height: 22, width: 100 }} />
        ) : (
          <>
            <span
              className="tabular"
              style={{
                fontSize: "var(--text-xl)",
                fontWeight: 600,
                color: "var(--t1)",
                letterSpacing: "-0.04em",
              }}
            >
              ${markStr}
            </span>
            <span
              style={{
                fontSize: "var(--text-sm)",
                fontWeight: 500,
                color: cfg.changeUp ? "var(--long)" : "var(--short)",
              }}
            >
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

      <div className="flex-1" />

      {marketInfo && (
        <div
          className="shrink-0"
          style={{
            padding: "2px 8px",
            borderRadius: "var(--radius-sm)",
            fontSize: "var(--text-2xs)",
            fontWeight: 600,
            background: marketInfo.regime === Regime.OPEN ? "var(--long-dim)" : "var(--warning-dim)",
            color: marketInfo.regime === Regime.OPEN ? "var(--long)" : "var(--warning)",
            border: `1px solid ${marketInfo.regime === Regime.OPEN ? "var(--long-mid)" : "var(--warning-mid)"}`,
            letterSpacing: "0.06em",
          }}
        >
          {marketInfo.regime === Regime.OPEN ? "OPEN" : "OFF-HOURS"}
        </div>
      )}
    </div>
  );
}
