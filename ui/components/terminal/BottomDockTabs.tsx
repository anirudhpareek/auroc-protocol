"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { CONTRACTS, PerpEngineAbi } from "@/lib/contracts";
import { usePositions } from "@/hooks/usePositions";
import { formatPrice, formatPnl, formatUsdc, formatLeverage } from "@/lib/format";
import { useTerminal } from "./TerminalContext";

const TABS = ["Positions", "Active Orders", "Fills", "Funding", "Activity"] as const;

const FUNDING_HISTORY = [
  { market: "XAU/USD", rate: "-0.0031%", up: false, time: "08:00 UTC", interval: "8h" },
  { market: "SPX/USD", rate: "-0.0018%", up: false, time: "08:00 UTC", interval: "8h" },
  { market: "XAU/USD", rate: "+0.0012%", up: true,  time: "00:00 UTC", interval: "8h" },
];

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
        padding: "2px 9px", borderRadius: "var(--radius-sm)",
        fontSize: "var(--text-2xs)", fontWeight: "var(--fw-semibold)",
        background: "var(--short-btn)", color: "var(--short)",
        border: "1px solid var(--short-mid)",
        cursor: busy ? "not-allowed" : "pointer",
        opacity: busy ? 0.4 : 1,
        transition: "var(--transition-fast)",
      }}
    >
      {busy ? "…" : "Close"}
    </button>
  );
}

const TH_STYLE: React.CSSProperties = {
  padding: "5px 10px",
  fontSize: "var(--text-2xs)",
  fontWeight: "var(--fw-medium)" as unknown as number,
  color: "var(--t3)",
  textAlign: "left",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const TD_STYLE: React.CSSProperties = {
  padding: "0 10px",
  fontSize: "var(--text-xs)",
  color: "var(--t2)",
  fontFamily: "var(--mono)",
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
  height: "var(--cell-h, 28px)",
};

const TD_NUM: React.CSSProperties = {
  ...TD_STYLE,
  textAlign: "right",
};

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

function PositionRow({ pos }: { pos: PosEntry }) {
  const { str: pnlStr, isPositive } = formatPnl(pos.unrealizedPnL);
  const rawSize = pos.size < 0n ? -pos.size : pos.size;
  const market = pos.position?.assetId ? formatMarketId(pos.position.assetId) : "—";
  const [hovered, setHovered] = useState(false);

  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "var(--hover)" : "transparent",
        transition: "background-color 0.1s",
        cursor: "default",
      }}
    >
      <td style={{ ...TD_STYLE, paddingLeft: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            fontSize: "var(--text-2xs)", fontWeight: "var(--fw-semibold)" as unknown as number,
            padding: "1px 5px", borderRadius: "var(--radius-sm)",
            background: pos.isLong ? "var(--long-dim)" : "var(--short-dim)",
            color: pos.isLong ? "var(--long)" : "var(--short)",
          }}>
            {pos.isLong ? "L" : "S"}
          </span>
          <span style={{ fontSize: "var(--text-xs)", fontWeight: "var(--fw-medium)" as unknown as number, color: "var(--t1)" }}>{market}</span>
          <span style={{ fontSize: "var(--text-2xs)", color: "var(--t3)" }}>{formatLeverage(pos.size, pos.margin)}</span>
        </div>
      </td>
      <td style={TD_NUM}>${formatUsdc(rawSize)}</td>
      <td style={TD_NUM}>${formatUsdc(rawSize)}</td>
      <td style={TD_NUM}>${formatPrice(pos.entryPrice)}</td>
      <td style={{ ...TD_NUM, color: "var(--t3)" }}>—</td>
      <td style={{ ...TD_NUM, color: isPositive ? "var(--long)" : "var(--short)", fontWeight: "var(--fw-medium)" as unknown as number }}>{pnlStr}</td>
      <td style={{ ...TD_NUM, color: "var(--t3)" }}>—</td>
      <td style={TD_NUM}>${formatUsdc(pos.margin)}</td>
      <td style={{ ...TD_STYLE, paddingRight: 14, textAlign: "right" }}>
        <CloseBtn positionId={pos.id} />
      </td>
    </tr>
  );
}

const TABLE_HEADERS = [
  { label: "Symbol",         align: "left"  as const },
  { label: "Size",           align: "right" as const },
  { label: "Position Value", align: "right" as const },
  { label: "Entry Price",    align: "right" as const },
  { label: "Mark Price",     align: "right" as const },
  { label: "PnL",            align: "right" as const },
  { label: "Liq. Price",     align: "right" as const },
  { label: "Margin",         align: "right" as const },
  { label: "Close",          align: "right" as const },
];

function EmptyState({ icon, label, sub }: { icon: string; label: string; sub?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 4 }}>
      <span style={{ fontSize: "var(--text-xl)", opacity: 0.1 }}>{icon}</span>
      <span style={{ fontSize: "var(--text-xs)", color: "var(--t3)" }}>{label}</span>
      {sub && <span style={{ fontSize: "var(--text-2xs)", color: "var(--t4)" }}>{sub}</span>}
    </div>
  );
}

export function BottomDockTabs() {
  const { bottomTab, setBottomTab } = useTerminal();
  const { address } = useAccount();
  const { positions, isLoading } = usePositions();
  const [height, setHeight] = useState(200);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    dragRef.current = { startY: e.clientY, startH: height };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "ns-resize";
  }, [height]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = dragRef.current.startY - e.clientY;
      const next = Math.max(120, Math.min(window.innerHeight * 0.5, dragRef.current.startH + delta));
      setHeight(next);
    };
    const onUp = () => {
      dragRef.current = null;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  return (
    <div
      className="bottom-dock-tabs"
      style={{
        height, flexShrink: 0,
        borderTop: "1px solid var(--b1)",
        display: "flex", flexDirection: "column",
        background: "var(--surface)",
        position: "relative",
      }}
    >
      {/* Drag handle */}
      <div
        onMouseDown={onDragStart}
        title="Drag to resize"
        style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 4,
          cursor: "ns-resize", zIndex: 10,
          transition: "background-color 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--gold)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      />

      {/* Tab bar */}
      <div style={{
        display: "flex", alignItems: "center",
        borderBottom: "1px solid var(--b1)", flexShrink: 0,
        padding: "0 4px", height: 34,
      }}>
        {TABS.map((t) => {
          const active = t === bottomTab;
          return (
            <button key={t} onClick={() => setBottomTab(t)} style={{
              padding: "0 11px", height: 34,
              fontSize: "var(--text-xs)",
              fontWeight: active ? "var(--fw-medium)" as unknown as number : "var(--fw-regular)" as unknown as number,
              color: active ? "var(--t1)" : "var(--t3)",
              borderBottom: active ? "2px solid var(--gold)" : "2px solid transparent",
              background: "none",
              transition: "color 0.1s, border-color 0.1s",
              display: "flex", alignItems: "center", gap: 5,
            }}>
              {t}
              {t === "Positions" && positions.length > 0 && (
                <span style={{
                  fontSize: "var(--text-2xs)", fontWeight: "var(--fw-semibold)" as unknown as number,
                  padding: "1px 4px", borderRadius: 10,
                  background: "var(--raised)", color: "var(--t3)",
                }}>
                  {positions.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowX: "auto", overflowY: "auto", minHeight: 0 }}>

        {bottomTab === "Positions" && (
          !address ? (
            <EmptyState icon="◇" label="Connect wallet to view positions" />
          ) : isLoading ? (
            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 5 }}>
              {[0, 1].map(i => <div key={i} className="animate-shimmer" style={{ height: 28, borderRadius: 4 }} />)}
            </div>
          ) : positions.length === 0 ? (
            <EmptyState icon="◇" label="No Open Positions" sub="You don't have any open perpetual positions." />
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "auto" }}>
              <thead className="sticky-th">
                <tr>
                  {TABLE_HEADERS.map((h, i) => (
                    <th key={i} style={{
                      ...TH_STYLE,
                      paddingLeft: i === 0 ? 14 : 10,
                      paddingRight: i === TABLE_HEADERS.length - 1 ? 14 : 10,
                      textAlign: h.align,
                    }}>
                      {h.label}
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

        {bottomTab === "Active Orders" && (
          <EmptyState icon="◈" label="No Active Orders" sub="Limit orders will appear here." />
        )}

        {bottomTab === "Fills" && (
          <EmptyState icon="◉" label="No Fills" sub="Filled orders will appear here." />
        )}

        {bottomTab === "Funding" && (
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "auto" }}>
            <thead className="sticky-th">
              <tr>
                {["Market", "Funding Rate", "Time", "Interval"].map((h, i) => (
                  <th key={i} style={{
                    ...TH_STYLE,
                    paddingLeft: i === 0 ? 14 : 10,
                    textAlign: i === 0 ? "left" : "right",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FUNDING_HISTORY.map((row, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--b1)" }}>
                  <td style={{ ...TD_STYLE, paddingLeft: 14, color: "var(--t1)", fontFamily: "inherit" }}>{row.market}</td>
                  <td style={{ ...TD_NUM, color: row.up ? "var(--long)" : "var(--short)" }}>{row.rate}</td>
                  <td style={TD_NUM}>{row.time}</td>
                  <td style={{ ...TD_NUM, paddingRight: 14, color: "var(--t3)" }}>{row.interval}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {bottomTab === "Activity" && (
          <EmptyState icon="◌" label="No Activity" sub="Recent protocol activity will appear here." />
        )}
      </div>
    </div>
  );
}
