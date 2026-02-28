"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { cn } from "@/lib/cn";
import { CONTRACTS, PerpEngineAbi } from "@/lib/contracts";
import { usePositions } from "@/hooks/usePositions";
import { formatPrice, formatPnl, formatUsdc, formatLeverage } from "@/lib/format";

/* ── Tabs ── */
const TABS = ["Positions", "Orders", "History"] as const;
type Tab = (typeof TABS)[number];

/* ── Decode marketId bytes32 → readable string ── */
function formatMarketId(id: `0x${string}`): string {
  try {
    const hex = id.replace("0x", "").replace(/00+$/, "");
    return Buffer.from(hex, "hex").toString("utf-8");
  } catch {
    return "—";
  }
}

/* ── Close Position Button ── */
function CloseBtn({ positionId }: { positionId: `0x${string}` }) {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: confirming } = useWaitForTransactionReceipt({ hash });
  const busy = isPending || confirming;

  return (
    <button
      onClick={() =>
        writeContract({
          address: CONTRACTS.perpEngine,
          abi: PerpEngineAbi,
          functionName: "closePosition",
          args: [positionId],
        })
      }
      disabled={busy}
      className="text-xs font-bold px-2.5 py-1 rounded-lg transition-all active:scale-95 disabled:opacity-40"
      style={{
        background: "var(--short-dim)",
        color: "var(--short)",
        border: "1px solid var(--short-mid)",
      }}
    >
      {busy ? "…" : "Close"}
    </button>
  );
}

/* ── Position Row (real data) ── */
interface PosEntry {
  id: `0x${string}`;
  size: bigint;
  entryPrice: bigint;
  margin: bigint;
  isLong: boolean;
  unrealizedPnL: bigint;
  marginRatio: bigint;
  position?: { marketId?: `0x${string}` };
}

function PositionRow({ pos }: { pos: PosEntry }) {
  const { str: pnlStr, isPositive } = formatPnl(pos.unrealizedPnL);
  const rawSize   = pos.size < 0n ? -pos.size : pos.size;
  const liqRisk   = Number(pos.marginRatio) / 1e18 < 0.1;
  const market    = pos.position?.marketId ? formatMarketId(pos.position.marketId) : "—";

  return (
    <tr
      className="transition-colors cursor-default"
      style={{ borderBottom: "1px solid var(--border-subtle)" }}
      onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = "var(--bg-elevated)"}
      onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = "transparent"}
    >
      {/* Market + direction */}
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
            style={
              pos.isLong
                ? { background: "var(--long-dim)", color: "var(--long)" }
                : { background: "var(--short-dim)", color: "var(--short)" }
            }
          >
            {pos.isLong ? "LONG" : "SHORT"}
          </span>
          <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{market}</span>
          <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
            {formatLeverage(pos.size, pos.margin)}
          </span>
        </div>
      </td>

      {/* Size */}
      <td className="px-4 py-2.5 text-xs tabular" style={{ color: "var(--text-secondary)" }}>
        ${formatUsdc(rawSize)}
      </td>

      {/* Entry */}
      <td className="px-4 py-2.5 text-right text-xs tabular" style={{ color: "var(--text-secondary)" }}>
        ${formatPrice(pos.entryPrice)}
      </td>

      {/* PnL */}
      <td className="px-4 py-2.5 text-right">
        <span className="text-xs font-bold tabular"
          style={{ color: isPositive ? "var(--long)" : "var(--short)" }}>
          {pnlStr}
        </span>
      </td>

      {/* Margin */}
      <td className="px-4 py-2.5 text-right">
        <div className="flex items-center justify-end gap-1.5">
          {liqRisk && (
            <span className="text-[9px] font-bold px-1 py-0.5 rounded-md"
              style={{ background: "var(--short-dim)", color: "var(--short)", border: "1px solid var(--short-mid)" }}>
              LIQ RISK
            </span>
          )}
          <span className="text-xs tabular" style={{ color: "var(--text-secondary)" }}>
            ${formatUsdc(pos.margin)}
          </span>
        </div>
      </td>

      {/* Actions */}
      <td className="px-4 py-2.5 text-right">
        <CloseBtn positionId={pos.id} />
      </td>
    </tr>
  );
}

/* ── Empty state ── */
function Empty({ icon, msg, sub }: { icon: string; msg: string; sub?: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-2 py-8">
      <div className="text-xl opacity-20">{icon}</div>
      <p className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>{msg}</p>
      {sub && <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{sub}</p>}
    </div>
  );
}

/* ── Aggregate PnL ── */
function TotalPnl({ positions }: { positions: PosEntry[] }) {
  if (!positions.length) return null;
  const total = positions.reduce((a, p) => a + p.unrealizedPnL, 0n);
  const { str, isPositive } = formatPnl(total);
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>Total PnL</span>
      <span className="text-xs font-bold tabular"
        style={{ color: isPositive ? "var(--long)" : "var(--short)" }}>
        {str}
      </span>
    </div>
  );
}

/* ── Main ── */
export function PositionsPanel() {
  const { address } = useAccount();
  const [tab, setTab] = useState<Tab>("Positions");
  const { positions, isLoading } = usePositions();

  const TABLE_HEADERS = ["Market", "Size", "Entry", "Unrealized PnL", "Margin", ""];

  return (
    <div className="h-full flex flex-col" style={{ background: "var(--bg-base)" }}>

      {/* Tab bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2"
        style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border-default)" }}>
        <div className="flex gap-0.5">
          {TABS.map((t) => {
            const active = t === tab;
            return (
              <button key={t} onClick={() => setTab(t)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-100 flex items-center gap-1"
                style={
                  active
                    ? { background: "var(--bg-overlay)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }
                    : { background: "transparent", color: "var(--text-tertiary)", border: "1px solid transparent" }
                }
              >
                {t}
                {t === "Positions" && positions.length > 0 && (
                  <span className="text-[9px] font-bold px-1 rounded-full"
                    style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>
                    {positions.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {tab === "Positions" && <TotalPnl positions={positions} />}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {tab === "Positions" && (
          !address ? (
            <Empty icon="⬡" msg="Connect wallet to view positions" />
          ) : isLoading ? (
            <div className="px-4 py-4 space-y-2">
              {[0, 1].map(i => <div key={i} className="h-8 rounded-lg animate-shimmer" />)}
            </div>
          ) : positions.length === 0 ? (
            <Empty icon="◇" msg="No open positions" sub="Trade XAU/USD or SPX/USD perpetuals" />
          ) : (
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  {TABLE_HEADERS.map((h, i) => (
                    <th key={i}
                      className={cn("px-4 py-2 text-[10px] font-semibold uppercase tracking-wider", i >= 2 ? "text-right" : "text-left")}
                      style={{ color: "var(--text-muted)", letterSpacing: "0.08em" }}>
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
        {tab === "Orders"  && <Empty icon="◈" msg="No open orders" sub="Limit orders will appear here" />}
        {tab === "History" && <Empty icon="◉" msg="No trade history" sub="Closed positions appear here" />}
      </div>
    </div>
  );
}
