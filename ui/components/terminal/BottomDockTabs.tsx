"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { CONTRACTS, PerpEngineAbi } from "@/lib/contracts";
import { usePositions } from "@/hooks/usePositions";
import { useOptionPositions } from "@/hooks/useOptions";
import { formatPrice, formatPnl, formatUsdc, formatLeverage } from "@/lib/format";
import { useTerminal } from "./TerminalContext";
import { GreeksPanel } from "./GreeksPanel";

const TABS = ["Positions", "Options", "Active Orders", "Fills", "Funding", "Activity"] as const;

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
    return "\u2014";
  }
}

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
      className="px-2 py-0.5 text-[length:var(--text-2xs)] font-semibold rounded-[var(--radius-sm)] border transition-[color,background-color,border-color,opacity] duration-100"
      style={{
        background: "var(--short-btn)",
        color: "var(--short)",
        borderColor: "var(--short-mid)",
        opacity: busy ? 0.4 : 1,
      }}
    >
      {busy ? "\u2026" : "Close"}
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

function PositionRow({ pos }: { pos: PosEntry }) {
  const { str: pnlStr, isPositive } = formatPnl(pos.unrealizedPnL);
  const rawSize = pos.size < 0n ? -pos.size : pos.size;
  const market = pos.position?.assetId ? formatMarketId(pos.position.assetId) : "\u2014";

  return (
    <tr className="tr-hover">
      <td className="px-2.5 pl-3.5 text-[length:var(--text-xs)] whitespace-nowrap h-[var(--cell-h,28px)]" style={{ color: "var(--t2)" }}>
        <div className="flex items-center gap-1.5">
          <span
            className="text-[length:var(--text-2xs)] font-semibold px-[5px] py-px rounded-[var(--radius-sm)]"
            style={{
              background: pos.isLong ? "var(--long-dim)" : "var(--short-dim)",
              color: pos.isLong ? "var(--long)" : "var(--short)",
            }}
          >
            {pos.isLong ? "L" : "S"}
          </span>
          <span className="text-[length:var(--text-xs)] font-medium" style={{ color: "var(--t1)" }}>
            {market}
          </span>
          <span className="text-[length:var(--text-2xs)]" style={{ color: "var(--t3)" }}>
            {formatLeverage(pos.size, pos.margin)}
          </span>
        </div>
      </td>
      <td className="tabular px-2.5 text-right text-[length:var(--text-xs)] whitespace-nowrap h-[var(--cell-h,28px)]" style={{ color: "var(--t2)" }}>
        ${formatUsdc(rawSize)}
      </td>
      <td className="tabular px-2.5 text-right text-[length:var(--text-xs)] whitespace-nowrap h-[var(--cell-h,28px)]" style={{ color: "var(--t2)" }}>
        ${formatUsdc(rawSize)}
      </td>
      <td className="tabular px-2.5 text-right text-[length:var(--text-xs)] whitespace-nowrap h-[var(--cell-h,28px)]" style={{ color: "var(--t2)" }}>
        ${formatPrice(pos.entryPrice)}
      </td>
      <td className="tabular px-2.5 text-right text-[length:var(--text-xs)] whitespace-nowrap h-[var(--cell-h,28px)]" style={{ color: "var(--t3)" }}>
        &mdash;
      </td>
      <td
        className="tabular px-2.5 text-right text-[length:var(--text-xs)] font-medium whitespace-nowrap h-[var(--cell-h,28px)]"
        style={{ color: isPositive ? "var(--long)" : "var(--short)" }}
      >
        {pnlStr}
      </td>
      <td className="tabular px-2.5 text-right text-[length:var(--text-xs)] whitespace-nowrap h-[var(--cell-h,28px)]" style={{ color: "var(--t3)" }}>
        &mdash;
      </td>
      <td className="tabular px-2.5 text-right text-[length:var(--text-xs)] whitespace-nowrap h-[var(--cell-h,28px)]" style={{ color: "var(--t2)" }}>
        ${formatUsdc(pos.margin)}
      </td>
      <td className="px-2.5 pr-3.5 text-right text-[length:var(--text-xs)] whitespace-nowrap h-[var(--cell-h,28px)]">
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
    <div className="flex flex-col items-center justify-center h-full gap-1">
      <span className="text-[length:var(--text-xl)] opacity-10">{icon}</span>
      <span className="text-[length:var(--text-xs)]" style={{ color: "var(--t3)" }}>
        {label}
      </span>
      {sub && (
        <span className="text-[length:var(--text-2xs)]" style={{ color: "var(--t4)" }}>
          {sub}
        </span>
      )}
    </div>
  );
}

export function BottomDockTabs() {
  const { bottomTab, setBottomTab } = useTerminal();
  const { address } = useAccount();
  const { positions, isLoading } = usePositions();
  const { positionIds: optionIds } = useOptionPositions();
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
      className="bottom-dock-tabs shrink-0 flex flex-col relative"
      style={{
        height,
        borderTop: "1px solid var(--b1)",
        background: "var(--surface)",
      }}
    >
      {/* Drag handle */}
      <div
        onMouseDown={onDragStart}
        title="Drag to resize"
        className="absolute top-0 left-0 right-0 h-1 cursor-ns-resize z-10 transition-colors duration-150 hover:bg-[var(--gold)]"
      />

      {/* Tab bar */}
      <div
        className="flex items-center shrink-0 px-1 h-[34px]"
        style={{ borderBottom: "1px solid var(--b1)" }}
      >
        {TABS.map((t) => {
          const active = t === bottomTab;
          return (
            <button
              key={t}
              onClick={() => setBottomTab(t)}
              className="flex items-center gap-[5px] px-[11px] h-[34px] text-[length:var(--text-xs)] transition-[color,border-color] duration-100 border-b-2"
              style={{
                fontWeight: active ? "var(--fw-medium)" : "var(--fw-regular)",
                color: active ? "var(--t1)" : "var(--t3)",
                borderBottomColor: active ? "var(--gold)" : "transparent",
              }}
            >
              {t}
              {t === "Positions" && positions.length > 0 && (
                <span
                  className="text-[length:var(--text-2xs)] font-semibold px-1 py-px rounded-full"
                  style={{ background: "var(--raised)", color: "var(--t3)" }}
                >
                  {positions.length}
                </span>
              )}
              {t === "Options" && optionIds.length > 0 && (
                <span
                  className="text-[length:var(--text-2xs)] font-semibold px-1 py-px rounded-full"
                  style={{ background: "var(--raised)", color: "var(--gold)" }}
                >
                  {optionIds.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto min-h-0">

        {bottomTab === "Positions" && (
          !address ? (
            <EmptyState icon="\u25C7" label="Connect wallet to view positions" />
          ) : isLoading ? (
            <div className="p-3 flex flex-col gap-[5px]">
              {[0, 1].map(i => (
                <div key={i} className="animate-shimmer h-7 rounded-[var(--radius-sm)]" />
              ))}
            </div>
          ) : positions.length === 0 ? (
            <EmptyState icon="\u25C7" label="No Open Positions" sub="You don't have any open perpetual positions." />
          ) : (
            <table className="w-full border-collapse table-auto">
              <thead className="sticky-th">
                <tr>
                  {TABLE_HEADERS.map((h, i) => (
                    <th
                      key={i}
                      className={`
                        py-[5px] px-2.5 text-[length:var(--text-2xs)] font-medium uppercase tracking-[0.04em] whitespace-nowrap
                        ${i === 0 ? "pl-3.5 text-left" : ""}
                        ${i === TABLE_HEADERS.length - 1 ? "pr-3.5" : ""}
                        ${h.align === "right" ? "text-right" : "text-left"}
                      `}
                      style={{ color: "var(--t3)" }}
                    >
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

        {bottomTab === "Options" && (
          <GreeksPanel />
        )}

        {bottomTab === "Active Orders" && (
          <EmptyState icon="\u25C8" label="No Active Orders" sub="Limit orders will appear here." />
        )}

        {bottomTab === "Fills" && (
          <EmptyState icon="\u25C9" label="No Fills" sub="Filled orders will appear here." />
        )}

        {bottomTab === "Funding" && (
          <table className="w-full border-collapse table-auto">
            <thead className="sticky-th">
              <tr>
                {["Market", "Funding Rate", "Time", "Interval"].map((h, i) => (
                  <th
                    key={i}
                    className={`
                      py-[5px] px-2.5 text-[length:var(--text-2xs)] font-medium uppercase tracking-[0.04em] whitespace-nowrap
                      ${i === 0 ? "pl-3.5 text-left" : "text-right"}
                    `}
                    style={{ color: "var(--t3)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FUNDING_HISTORY.map((row, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--b1)" }}>
                  <td
                    className="px-2.5 pl-3.5 text-[length:var(--text-xs)] whitespace-nowrap h-[var(--cell-h,28px)]"
                    style={{ color: "var(--t1)" }}
                  >
                    {row.market}
                  </td>
                  <td
                    className="tabular px-2.5 text-right text-[length:var(--text-xs)] whitespace-nowrap h-[var(--cell-h,28px)]"
                    style={{ color: row.up ? "var(--long)" : "var(--short)" }}
                  >
                    {row.rate}
                  </td>
                  <td className="tabular px-2.5 text-right text-[length:var(--text-xs)] whitespace-nowrap h-[var(--cell-h,28px)]" style={{ color: "var(--t2)" }}>
                    {row.time}
                  </td>
                  <td
                    className="tabular px-2.5 pr-3.5 text-right text-[length:var(--text-xs)] whitespace-nowrap h-[var(--cell-h,28px)]"
                    style={{ color: "var(--t3)" }}
                  >
                    {row.interval}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {bottomTab === "Activity" && (
          <EmptyState icon="\u25CC" label="No Activity" sub="Recent protocol activity will appear here." />
        )}
      </div>
    </div>
  );
}
