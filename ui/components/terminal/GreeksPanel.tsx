"use client";

import { useAccount } from "wagmi";
import { useOptionPositions, useOptionPosition, useBurnOption, useCurrentOptionValue } from "@/hooks/useOptions";
import { useMarketData } from "@/hooks/useMarketData";
import { formatUsdc, formatPrice } from "@/lib/format";
import { formatIV, formatPremiumPct, formatStrike } from "@/lib/options";
import { OptionType, OptionSide, Regime } from "@/types";
import { useTerminal } from "./TerminalContext";

// ─── Sub-component: single option row ────────────────────────────────────────

function GreekCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-px">
      <span style={{ fontSize: "var(--text-2xs)", color: "var(--t3)" }}>{label}</span>
      <span className="tabular" style={{ fontSize: "var(--text-xs)", color: "var(--t1)" }}>{value}</span>
    </div>
  );
}

function OptionRow({ positionId }: { positionId: `0x${string}` }) {
  const { data: pos } = useOptionPosition(positionId);
  const { data: currentValue } = useCurrentOptionValue(positionId);
  const { burn, isPending, isConfirming } = useBurnOption();

  if (!pos || !(pos as any).positionId) return null;
  const position = pos as any;

  const busy = isPending || isConfirming;
  const leg0 = position.legs?.[0];
  if (!leg0) return null;

  const isCall = Number(leg0.optionType) === OptionType.CALL;
  const isLong = Number(leg0.side) === OptionSide.LONG;
  const strikeStr = formatStrike(leg0.strike);
  const type = isCall ? "CALL" : "PUT";
  const side = isLong ? "Long" : "Short";
  const legCount = Number(position.legCount);

  return (
    <tr className="tr-hover">
      {/* Strategy */}
      <td className="px-2.5 pl-3.5 whitespace-nowrap h-[var(--cell-h,28px)]">
        <div className="flex items-center gap-1.5">
          <span
            className="text-[length:var(--text-2xs)] font-semibold px-[5px] py-px rounded-[var(--radius-sm)]"
            style={{
              background: isCall ? "var(--long-dim)"  : "var(--short-dim)",
              color:      isCall ? "var(--long)"      : "var(--short)",
            }}
          >
            {type}
          </span>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--t1)" }}>
            {side} · ${strikeStr}
          </span>
          {legCount > 1 && (
            <span style={{ fontSize: "var(--text-2xs)", color: "var(--t3)" }}>{legCount}L</span>
          )}
        </div>
      </td>

      {/* IV */}
      <td className="tabular px-2.5 text-right whitespace-nowrap h-[var(--cell-h,28px)]" style={{ fontSize: "var(--text-xs)", color: "var(--t2)" }}>
        —
      </td>

      {/* Premium paid */}
      <td className="tabular px-2.5 text-right whitespace-nowrap h-[var(--cell-h,28px)]" style={{ fontSize: "var(--text-xs)", color: "var(--t2)" }}>
        ${formatUsdc(position.premiumPaid)}
      </td>

      {/* Current value */}
      <td className="tabular px-2.5 text-right whitespace-nowrap h-[var(--cell-h,28px)]" style={{ fontSize: "var(--text-xs)", color: "var(--long)" }}>
        {currentValue ? `$${formatUsdc(currentValue as bigint)}` : "—"}
      </td>

      {/* PnL */}
      <td className="tabular px-2.5 text-right whitespace-nowrap h-[var(--cell-h,28px)]">
        {currentValue ? (() => {
          const pnl = (currentValue as bigint) - position.premiumPaid;
          const isPos = pnl >= 0n;
          return (
            <span style={{ fontSize: "var(--text-xs)", color: isPos ? "var(--long)" : "var(--short)" }}>
              {isPos ? "+" : ""}${formatUsdc(pnl < 0n ? -pnl : pnl)}
            </span>
          );
        })() : <span style={{ fontSize: "var(--text-xs)", color: "var(--t3)" }}>—</span>}
      </td>

      {/* Close button */}
      <td className="px-2.5 pr-3.5 text-right whitespace-nowrap h-[var(--cell-h,28px)]">
        <button
          onClick={() => burn(positionId, 0n)}
          disabled={busy}
          className="px-2 py-0.5 text-[length:var(--text-2xs)] font-semibold rounded-[var(--radius-sm)] border transition-all"
          style={{
            background: "var(--short-btn)",
            color: "var(--short)",
            borderColor: "var(--short-mid)",
            opacity: busy ? 0.4 : 1,
          }}
        >
          {busy ? "…" : "Close"}
        </button>
      </td>
    </tr>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const HEADERS = [
  { label: "Strategy",      align: "left"  as const },
  { label: "IV",            align: "right" as const },
  { label: "Cost",          align: "right" as const },
  { label: "Current Value", align: "right" as const },
  { label: "PnL",           align: "right" as const },
  { label: "Close",         align: "right" as const },
];

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-1">
      <span className="text-[length:var(--text-xl)] opacity-10">◇</span>
      <span style={{ fontSize: "var(--text-xs)", color: "var(--t3)" }}>No Open Options</span>
      <span style={{ fontSize: "var(--text-2xs)", color: "var(--t4)" }}>Open a position from the Options ticket</span>
    </div>
  );
}

export function GreeksPanel() {
  const { address } = useAccount();
  const { positionIds, isLoading } = useOptionPositions();

  if (!address) {
    return (
      <div className="flex items-center justify-center h-full">
        <span style={{ fontSize: "var(--text-xs)", color: "var(--t3)" }}>Connect wallet to view options</span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-3 flex flex-col gap-[5px]">
        {[0, 1].map((i) => (
          <div key={i} className="animate-shimmer h-7 rounded-[var(--radius-sm)]" />
        ))}
      </div>
    );
  }

  if (positionIds.length === 0) return <EmptyState />;

  return (
    <table className="w-full border-collapse table-auto">
      <thead className="sticky-th">
        <tr>
          {HEADERS.map((h, i) => (
            <th
              key={i}
              className={`py-[5px] px-2.5 text-[length:var(--text-2xs)] font-medium uppercase tracking-[0.04em] whitespace-nowrap
                ${i === 0 ? "pl-3.5 text-left" : ""}
                ${i === HEADERS.length - 1 ? "pr-3.5" : ""}
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
        {positionIds.map((id) => (
          <OptionRow key={id} positionId={id} />
        ))}
      </tbody>
    </table>
  );
}
