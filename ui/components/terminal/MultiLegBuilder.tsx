"use client";

import { useState, useCallback } from "react";
import { useAccount } from "wagmi";
import { CONTRACTS_V3 } from "@/lib/contracts";
import { useCollateralRequired, useMintOption, useApproveForOptions } from "@/hooks/useOptions";
import { useMarketData } from "@/hooks/useMarketData";
import { AVAILABLE_TERMINAL_MARKETS, useTerminal } from "./TerminalContext";
import { OptionLeg, OptionType, OptionSide } from "@/types";
import { formatUsdc } from "@/lib/format";
import { makeStraddle, makeStrangle, makeBullCallSpread, makeBearPutSpread } from "@/lib/options";

// ─── Preset strategy definitions ─────────────────────────────────────────────

type PresetKey = "straddle" | "strangle" | "bull_call" | "bear_put" | "custom";

interface Preset {
  key:   PresetKey;
  label: string;
  desc:  string;
}

const PRESETS: Preset[] = [
  { key: "straddle",  label: "Straddle",        desc: "Long call + Long put at same strike"           },
  { key: "strangle",  label: "Strangle",         desc: "Long OTM call + Long OTM put"                  },
  { key: "bull_call", label: "Bull Call Spread",  desc: "Long lower call + Short higher call"           },
  { key: "bear_put",  label: "Bear Put Spread",   desc: "Long higher put + Short lower put"             },
  { key: "custom",    label: "Custom",            desc: "Build up to 4 legs manually"                   },
];

// ─── Inline leg editor ────────────────────────────────────────────────────────

interface LegEditorProps {
  leg:      Partial<OptionLeg>;
  index:    number;
  onChange: (updated: Partial<OptionLeg>) => void;
  onRemove: () => void;
}

function LegEditor({ leg, index, onChange, onRemove }: LegEditorProps) {
  const isCall = leg.optionType !== OptionType.PUT;
  const isBuy  = leg.side !== OptionSide.SHORT;
  const color  = isCall ? "var(--long)" : "var(--short)";

  return (
    <div
      className="flex flex-col gap-2 p-2"
      style={{
        borderRadius: "var(--radius-md)",
        border: `1px solid var(--b2)`,
        background: "var(--raised)",
      }}
    >
      <div className="flex items-center justify-between">
        <span style={{ fontSize: "var(--text-2xs)", color: "var(--t3)", fontWeight: 600 }}>
          LEG {index + 1}
        </span>
        <button
          onClick={onRemove}
          style={{ fontSize: "var(--text-xs)", color: "var(--t4)" }}
          aria-label={`Remove leg ${index + 1}`}
        >
          ✕
        </button>
      </div>

      {/* Type + Side */}
      <div className="flex gap-1">
        {(["CALL", "PUT"] as const).map((t) => {
          const active = (t === "CALL") === isCall;
          const c = t === "CALL" ? "var(--long)" : "var(--short)";
          const dim = t === "CALL" ? "var(--long-dim)" : "var(--short-dim)";
          return (
            <button
              key={t}
              onClick={() => onChange({ ...leg, optionType: t === "CALL" ? OptionType.CALL : OptionType.PUT })}
              className="flex-1 font-semibold transition-all"
              style={{
                height: 24,
                borderRadius: "var(--radius-sm)",
                fontSize: "var(--text-2xs)",
                background: active ? dim : "transparent",
                color: active ? c : "var(--t3)",
                border: `1px solid ${active ? c : "var(--b1)"}`,
              }}
            >
              {t}
            </button>
          );
        })}
        {(["BUY", "SELL"] as const).map((s) => {
          const active = (s === "BUY") === isBuy;
          return (
            <button
              key={s}
              onClick={() => onChange({ ...leg, side: s === "BUY" ? OptionSide.LONG : OptionSide.SHORT })}
              className="flex-1 font-semibold transition-all"
              style={{
                height: 24,
                borderRadius: "var(--radius-sm)",
                fontSize: "var(--text-2xs)",
                background: active ? "var(--raised)" : "transparent",
                color: active ? "var(--t1)" : "var(--t3)",
                border: `1px solid ${active ? "var(--b3)" : "var(--b1)"}`,
              }}
            >
              {s}
            </button>
          );
        })}
      </div>

      {/* Strike */}
      <div className="flex items-center gap-2">
        <span style={{ fontSize: "var(--text-2xs)", color: "var(--t3)", width: 40, flexShrink: 0 }}>Strike</span>
        <input
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={leg.strike ? (Number(leg.strike) / 1e18).toString() : ""}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            onChange({ ...leg, strike: isNaN(v) ? undefined : BigInt(Math.round(v * 1e18)) });
          }}
          className="flex-1 bg-transparent border-none outline-none tabular"
          style={{
            fontSize: "var(--text-xs)",
            color: leg.strike ? "var(--t1)" : "var(--t3)",
            borderBottom: "1px solid var(--b2)",
            padding: "2px 0",
          }}
        />
        <span style={{ fontSize: "var(--text-2xs)", color: "var(--t3)" }}>USD</span>
      </div>

      {/* Notional */}
      <div className="flex items-center gap-2">
        <span style={{ fontSize: "var(--text-2xs)", color: "var(--t3)", width: 40, flexShrink: 0 }}>Size</span>
        <input
          type="text"
          inputMode="decimal"
          placeholder="1.00"
          value={leg.notional ? (Number(leg.notional) / 1e18).toString() : ""}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            onChange({ ...leg, notional: isNaN(v) ? undefined : BigInt(Math.round(v * 1e18)) });
          }}
          className="flex-1 bg-transparent border-none outline-none tabular"
          style={{
            fontSize: "var(--text-xs)",
            color: leg.notional ? "var(--t1)" : "var(--t3)",
            borderBottom: "1px solid var(--b2)",
            padding: "2px 0",
          }}
        />
        <span style={{ fontSize: "var(--text-2xs)", color: "var(--t3)" }}>units</span>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin" width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.25"/>
      <path d="M6.5 1.5A5 5 0 0 1 11.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

export function MultiLegBuilder() {
  const { market } = useTerminal();
  const { address } = useAccount();
  const { marketInfo } = useMarketData(market.id);
  const spot = marketInfo?.indexPrice ?? 0n;

  const [preset, setPreset]   = useState<PresetKey>("straddle");
  const [legs, setLegs]       = useState<Partial<OptionLeg>[]>([]);
  const [isSuccess, setIsSuccess] = useState(false);

  // Build complete legs for submission (filter incomplete)
  const completedLegs: OptionLeg[] = legs.filter(
    (l): l is OptionLeg =>
      !!l.marketId && l.strike !== undefined && l.strike > 0n &&
      l.notional !== undefined && l.notional > 0n &&
      l.optionType !== undefined && l.side !== undefined
  );

  const { data: collReq } = useCollateralRequired(completedLegs);
  const totalCost = (collReq as any)?.total ?? 0n;

  const { mint, isPending, isConfirming } = useMintOption();
  const { approve, isPending: isApproving, isConfirming: isApproveConfirming } = useApproveForOptions();
  const isBusy = isPending || isConfirming;

  // Apply a preset strategy using current spot as ATM
  const applyPreset = useCallback((key: PresetKey) => {
    setPreset(key);
    if (!spot || key === "custom") {
      setLegs([{ marketId: market.id, optionType: OptionType.CALL, side: OptionSide.LONG }]);
      return;
    }

    const atm     = spot;
    const otmCall = (spot * 105n) / 100n;
    const otmPut  = (spot * 95n)  / 100n;
    const size    = BigInt("1000000000000000000"); // 1 unit

    let newLegs: OptionLeg[] = [];
    if (key === "straddle")  newLegs = makeStraddle(market.id, atm, size);
    if (key === "strangle")  newLegs = makeStrangle(market.id, otmCall, otmPut, size);
    if (key === "bull_call") newLegs = makeBullCallSpread(market.id, otmPut, otmCall, size);
    if (key === "bear_put")  newLegs = makeBearPutSpread(market.id, otmCall, otmPut, size);

    setLegs(newLegs);
  }, [spot, market.id]);

  const updateLeg = (index: number, updated: Partial<OptionLeg>) => {
    setLegs((prev) => {
      const next = [...prev];
      next[index] = updated;
      return next;
    });
  };

  const removeLeg = (index: number) => {
    setLegs((prev) => prev.filter((_, i) => i !== index));
  };

  const addLeg = () => {
    if (legs.length >= 4) return;
    setLegs((prev) => [...prev, { marketId: market.id, optionType: OptionType.CALL, side: OptionSide.LONG }]);
  };

  const handleSubmit = async () => {
    if (!address || completedLegs.length === 0 || isBusy) return;
    try {
      await mint(completedLegs, totalCost + totalCost / 100n);
      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 4000);
    } catch {}
  };

  const canSubmit = !!address && completedLegs.length > 0 && !isBusy;

  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 gap-3" style={{ background: "var(--panel)" }}>

      {/* Preset selector */}
      <div>
        <span className="font-semibold uppercase tracking-wider mb-2 block" style={{ fontSize: "var(--text-2xs)", color: "var(--t3)" }}>
          Strategy Preset
        </span>
        <div className="flex flex-col gap-1">
          {PRESETS.map((p) => {
            const active = preset === p.key;
            return (
              <button
                key={p.key}
                onClick={() => applyPreset(p.key)}
                className="flex items-start gap-2 px-3 py-2 text-left transition-all"
                style={{
                  borderRadius: "var(--radius-md)",
                  background: active ? "var(--raised)" : "transparent",
                  border: `1px solid ${active ? "var(--b3)" : "var(--b1)"}`,
                }}
              >
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: active ? "var(--t1)" : "var(--t2)" }}>
                    {p.label}
                  </div>
                  <div style={{ fontSize: "var(--text-2xs)", color: "var(--t4)" }}>{p.desc}</div>
                </div>
                {active && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0 mt-0.5" aria-hidden="true">
                    <path d="M2 6L5 9L10 3" stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Leg editors */}
      {legs.length > 0 && (
        <div>
          <span className="font-semibold uppercase tracking-wider mb-2 block" style={{ fontSize: "var(--text-2xs)", color: "var(--t3)" }}>
            Legs ({legs.length}/4)
          </span>
          <div className="flex flex-col gap-2">
            {legs.map((leg, i) => (
              <LegEditor
                key={i}
                leg={leg}
                index={i}
                onChange={(updated) => updateLeg(i, updated)}
                onRemove={() => removeLeg(i)}
              />
            ))}
          </div>
          {legs.length < 4 && (
            <button
              onClick={addLeg}
              className="w-full mt-2 py-1.5 font-medium transition-all"
              style={{
                borderRadius: "var(--radius-md)",
                fontSize: "var(--text-xs)",
                color: "var(--t3)",
                border: "1px dashed var(--b2)",
                background: "transparent",
              }}
            >
              + Add Leg
            </button>
          )}
        </div>
      )}

      {/* Total cost */}
      {totalCost > 0n && (
        <div
          className="px-3 py-2"
          style={{ borderRadius: "var(--radius-md)", background: "var(--raised)", border: "1px solid var(--b1)" }}
        >
          <div className="flex justify-between">
            <span style={{ fontSize: "var(--text-xs)", color: "var(--t3)" }}>Total Required</span>
            <span className="tabular font-semibold" style={{ fontSize: "var(--text-xs)", color: "var(--gold)" }}>
              ${formatUsdc(totalCost)} USDC
            </span>
          </div>
          <div className="flex justify-between mt-1">
            <span style={{ fontSize: "var(--text-2xs)", color: "var(--t4)" }}>Completed legs</span>
            <span style={{ fontSize: "var(--text-2xs)", color: "var(--t3)" }}>
              {completedLegs.length} / {legs.length}
            </span>
          </div>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full flex items-center justify-center gap-2 font-bold tracking-wider transition-all"
        style={{
          height: "var(--h-btn-lg)",
          borderRadius: "var(--radius-lg)",
          fontSize: "var(--text-sm)",
          background: canSubmit ? "var(--gold)" : "var(--raised)",
          color: canSubmit ? "#000" : "var(--t3)",
          border: `1px solid ${canSubmit ? "transparent" : "var(--b1)"}`,
          opacity: canSubmit ? 1 : 0.6,
          cursor: canSubmit ? "pointer" : "not-allowed",
        }}
      >
        {isBusy && <Spinner />}
        {isBusy
          ? (isConfirming ? "Confirming…" : "Sign in Wallet…")
          : completedLegs.length > 0
            ? `Open ${completedLegs.length}-Leg Strategy`
            : "Complete all legs to submit"
        }
      </button>

      {isSuccess && (
        <div
          className="flex items-center gap-2 px-3 py-[9px]"
          style={{
            borderRadius: "var(--radius-md)",
            background: "var(--long-dim)",
            border: "1px solid var(--long-mid)",
          }}
        >
          <span style={{ fontSize: "var(--text-xs)", color: "var(--long)" }}>✓ Multi-leg strategy opened</span>
        </div>
      )}
    </div>
  );
}
