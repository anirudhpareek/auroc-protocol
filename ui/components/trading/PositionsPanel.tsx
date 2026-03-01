"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { CONTRACTS, PerpEngineAbi } from "@/lib/contracts";
import { usePositions } from "@/hooks/usePositions";
import { formatPrice, formatPnl, formatUsdc, formatLeverage } from "@/lib/format";

const TABS = ["Positions", "Active Orders", "Trade History"] as const;
type Tab = (typeof TABS)[number];

function formatMarketId(id: `0x${string}`): string {
  try {
    const hex = id.replace("0x", "").replace(/00+$/, "");
    return Buffer.from(hex, "hex").toString("utf-8");
  } catch {
    return "—";
  }
}

function CloseBtn({ positionId }: { positionId: `0x${string}` }) {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: confirming } = useWaitForTransactionReceipt({ hash });
  const busy = isPending || confirming;
  return (
    <button
      onClick={() => writeContract({ address: CONTRACTS.perpEngine, abi: PerpEngineAbi, functionName: "closePosition", args: [positionId] })}
      disabled={busy}
      style={{
        padding: "3px 10px", borderRadius: 5, fontSize: 11, fontWeight: 600,
        background: "rgba(239,68,68,0.10)", color: "var(--short)",
        border: "1px solid rgba(239,68,68,0.16)", cursor: busy ? "not-allowed" : "pointer",
        opacity: busy ? 0.4 : 1, transition: "all 0.1s",
      }}
    >
      {busy ? "…" : "Close"}
    </button>
  );
}

interface PosEntry {
  id: `0x${string}`;
  size: bigint;
  entryPrice: bigint;
  margin: bigint;
  isLong: boolean;
  unrealizedPnL: bigint;
  marginRatio: bigint;
  position?: { assetId?: `0x${string}` } | undefined;
}

const TH: React.CSSProperties = {
  padding: "0 12px", fontSize: 10, fontWeight: 500, color: "var(--t3)",
  textAlign: "left", letterSpacing: "0.04em", textTransform: "uppercase",
  whiteSpace: "nowrap",
};
const TD: React.CSSProperties = {
  padding: "0 12px", fontSize: 11, color: "var(--t2)",
  fontFamily: "JetBrains Mono, monospace", whiteSpace: "nowrap",
};

function PositionRow({ pos }: { pos: PosEntry }) {
  const { str: pnlStr, isPositive } = formatPnl(pos.unrealizedPnL);
  const rawSize = pos.size < 0n ? -pos.size : pos.size;
  const market = pos.position?.assetId ? formatMarketId(pos.position.assetId) : "—";
  const [hovered, setHovered] = useState(false);

  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ background: hovered ? "var(--hover)" : "transparent", transition: "background 0.1s", cursor: "default" }}
    >
      <td style={{ ...TD, paddingLeft: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
            background: pos.isLong ? "var(--long-dim)" : "var(--short-dim)",
            color: pos.isLong ? "var(--long)" : "var(--short)",
          }}>
            {pos.isLong ? "LONG" : "SHORT"}
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--t1)", fontFamily: "Inter, sans-serif" }}>{market}</span>
          <span style={{ fontSize: 10, color: "var(--t3)" }}>{formatLeverage(pos.size, pos.margin)}</span>
        </div>
      </td>
      <td style={TD}>${formatUsdc(rawSize)}</td>
      <td style={{ ...TD, color: "var(--t2)" }}>${formatUsdc(rawSize)}</td>
      <td style={TD}>${formatPrice(pos.entryPrice)}</td>
      <td style={{ ...TD, color: "var(--t2)" }}>—</td>
      <td style={{ ...TD, color: isPositive ? "var(--long)" : "var(--short)", fontWeight: 600 }}>{pnlStr}</td>
      <td style={{ ...TD, color: "var(--t3)" }}>—</td>
      <td style={TD}>${formatUsdc(pos.margin)}</td>
      <td style={{ ...TD, paddingRight: 16 }}>
        <CloseBtn positionId={pos.id} />
      </td>
    </tr>
  );
}

const TABLE_HEADERS = ["Symbol", "Size", "Position Value", "Entry Price", "Mark Price", "PnL", "Liq. Price", "Margin", "Close"];

export function PositionsPanel() {
  const { address } = useAccount();
  const [tab, setTab] = useState<Tab>("Positions");
  const { positions, isLoading } = usePositions();

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--surface)", overflow: "hidden" }}>

      {/* ── Tab bar ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid var(--b1)", flexShrink: 0, padding: "0 4px",
        height: 36,
      }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          {TABS.map((t) => {
            const active = t === tab;
            return (
              <button key={t} onClick={() => setTab(t)}
                style={{
                  padding: "0 12px", height: 36, fontSize: 11, fontWeight: active ? 500 : 400,
                  color: active ? "var(--t1)" : "var(--t3)",
                  borderBottom: active ? "2px solid var(--t1)" : "2px solid transparent",
                  background: "none", transition: "all 0.1s", display: "flex", alignItems: "center", gap: 5,
                }}
              >
                {t}
                {t === "Positions" && positions.length > 0 && (
                  <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 10, background: "var(--raised)", color: "var(--t2)" }}>
                    {positions.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Order Book button */}
        <button style={{
          display: "flex", alignItems: "center", gap: 5, marginRight: 8,
          padding: "4px 10px", borderRadius: 5, fontSize: 11, fontWeight: 500,
          color: "var(--t2)", border: "1px solid var(--b2)", background: "var(--raised)",
        }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect x="1" y="1" width="4" height="1.5" rx="0.5" fill="currentColor" opacity="0.4"/>
            <rect x="1" y="3.5" width="6" height="1.5" rx="0.5" fill="currentColor" opacity="0.6"/>
            <rect x="1" y="6" width="5" height="1.5" rx="0.5" fill="currentColor" opacity="0.8"/>
            <rect x="1" y="8.5" width="8" height="1.5" rx="0.5" fill="currentColor"/>
          </svg>
          Order Book
        </button>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflowX: "auto", overflowY: "auto" }}>
        {tab === "Positions" && (
          !address ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 6 }}>
              <span style={{ fontSize: 18, opacity: 0.15 }}>◇</span>
              <span style={{ fontSize: 11, color: "var(--t3)" }}>Connect wallet to view positions</span>
            </div>
          ) : isLoading ? (
            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              {[0, 1].map(i => <div key={i} className="animate-shimmer" style={{ height: 32, borderRadius: 6 }} />)}
            </div>
          ) : positions.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 5 }}>
              <span style={{ fontSize: 18, opacity: 0.12 }}>◇</span>
              <span style={{ fontSize: 11, color: "var(--t3)" }}>No Open Positions</span>
              <span style={{ fontSize: 10, color: "var(--t4)" }}>You don&apos;t have any open perpetual positions.</span>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "auto" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--b1)" }}>
                  {TABLE_HEADERS.map((h, i) => (
                    <th key={i} style={{ ...TH, paddingLeft: i === 0 ? 16 : 12, paddingRight: i === TABLE_HEADERS.length - 1 ? 16 : 12, paddingTop: 6, paddingBottom: 6 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {positions.map(p => <PositionRow key={p.id} pos={p} />)}
              </tbody>
            </table>
          )
        )}
        {tab === "Active Orders" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 5 }}>
            <span style={{ fontSize: 18, opacity: 0.12 }}>◈</span>
            <span style={{ fontSize: 11, color: "var(--t3)" }}>No Active Orders</span>
            <span style={{ fontSize: 10, color: "var(--t4)" }}>Limit orders will appear here.</span>
          </div>
        )}
        {tab === "Trade History" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 5 }}>
            <span style={{ fontSize: 18, opacity: 0.12 }}>◉</span>
            <span style={{ fontSize: 11, color: "var(--t3)" }}>No Trade History</span>
            <span style={{ fontSize: 10, color: "var(--t4)" }}>Closed positions will appear here.</span>
          </div>
        )}
      </div>
    </div>
  );
}
