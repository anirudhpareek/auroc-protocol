"use client";

import { useState, useCallback } from "react";
import { parseUnits } from "viem";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { cn } from "@/lib/cn";
import { CONTRACTS, MARKETS, PerpEngineAbi, ERC20Abi } from "@/lib/contracts";
import { useMarketData } from "@/hooks/useMarketData";
import { formatPrice } from "@/lib/format";

/* ── Types ── */
type Direction = "long" | "short";
type OrderType = "Market" | "Limit";

const AVAILABLE_MARKETS = [
  { id: MARKETS.XAU_USD, symbol: "XAU", pair: "XAU/USD" },
  { id: MARKETS.SPX_USD, symbol: "SPX", pair: "SPX/USD" },
] as const;

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ── Direction Toggle ── */
function DirectionToggle({ value, onChange }: { value: Direction; onChange: (v: Direction) => void }) {
  return (
    <div className="flex gap-1.5 p-1 rounded-xl"
      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
      {(["long", "short"] as Direction[]).map((d) => {
        const active = value === d;
        const isLong = d === "long";
        return (
          <button key={d} onClick={() => onChange(d)}
            className="flex-1 py-2 rounded-lg text-xs font-bold tracking-wide transition-all duration-200 active:scale-[0.97]"
            style={
              active
                ? {
                    background: isLong
                      ? "linear-gradient(135deg, #009f5e 0%, var(--long) 100%)"
                      : "linear-gradient(135deg, #a01f36 0%, var(--short) 100%)",
                    color: "#000",
                    boxShadow: isLong
                      ? "0 0 18px var(--long-glow), inset 0 1px 0 rgba(255,255,255,0.18)"
                      : "0 0 18px var(--short-glow), inset 0 1px 0 rgba(255,255,255,0.10)",
                    letterSpacing: "0.04em",
                  }
                : { background: "transparent", color: "var(--text-muted)", letterSpacing: "0.04em" }
            }
          >
            {isLong ? "▲ " : "▼ "}{isLong ? "Long" : "Short"}
          </button>
        );
      })}
    </div>
  );
}

/* ── Order Type Pills ── */
function OrderTypePills({ value, onChange }: { value: OrderType; onChange: (v: OrderType) => void }) {
  return (
    <div className="flex gap-1">
      {(["Market", "Limit"] as OrderType[]).map((t) => {
        const active = t === value;
        return (
          <button key={t} onClick={() => onChange(t)}
            className="px-3 py-1 text-xs font-medium rounded-lg transition-all duration-100"
            style={
              active
                ? { background: "var(--bg-overlay)", color: "var(--text-primary)", border: "1px solid var(--border-strong)" }
                : { background: "transparent", color: "var(--text-tertiary)", border: "1px solid transparent" }
            }
          >
            {t}
          </button>
        );
      })}
    </div>
  );
}

/* ── Field Input ── */
function FieldInput({
  label, value, onChange, suffix, onMax, hint,
}: {
  label?: string; value: string; onChange: (v: string) => void;
  suffix?: string; onMax?: () => void; hint?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="space-y-1.5">
      {(label || hint) && (
        <div className="flex items-center justify-between">
          {label && <span className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>{label}</span>}
          {hint && <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>{hint}</span>}
        </div>
      )}
      <div className="flex items-center gap-2 rounded-xl px-3 transition-all duration-150"
        style={{
          background: "var(--bg-elevated)",
          border: `1px solid ${focused ? "var(--border-focus)" : "var(--border-default)"}`,
          height: "42px",
          boxShadow: focused ? "0 0 0 3px rgba(255,255,255,0.02)" : "none",
        }}>
        <input
          type="text" inputMode="decimal" value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          placeholder="0.00"
          className="flex-1 bg-transparent text-sm tabular focus:outline-none"
          style={{ color: "var(--text-primary)", caretColor: "var(--accent)" }}
        />
        {onMax && (
          <button onClick={onMax}
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-md active:scale-95"
            style={{ background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent-mid)" }}>
            MAX
          </button>
        )}
        {suffix && <span className="text-[11px] flex-shrink-0" style={{ color: "var(--text-tertiary)" }}>{suffix}</span>}
      </div>
    </div>
  );
}

/* ── Quick Amounts ── */
function QuickAmounts({ onSelect }: { onSelect: (pct: number) => void }) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {[10, 25, 50, 100].map((p) => (
        <button key={p} onClick={() => onSelect(p)}
          className="py-1.5 text-[11px] font-semibold rounded-lg transition-all active:scale-95"
          style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = "var(--bg-overlay)"; el.style.color = "var(--text-primary)"; el.style.borderColor = "var(--border-strong)";
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = "var(--bg-elevated)"; el.style.color = "var(--text-secondary)"; el.style.borderColor = "var(--border-default)";
          }}
        >
          {p === 100 ? "Max" : `${p}%`}
        </button>
      ))}
    </div>
  );
}

/* ── Leverage Control ── */
function LevControl({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const pct = ((value - 1) / 99) * 100;
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>Leverage</span>
        <span className="text-xs font-bold tabular px-2 py-0.5 rounded-lg"
          style={{ background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent-mid)" }}>
          {value}×
        </span>
      </div>
      <div className="relative h-4 flex items-center">
        <div className="absolute w-full h-[3px] rounded-full overflow-hidden" style={{ background: "var(--bg-overlay)" }}>
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(to right, rgba(245,166,35,0.3), var(--accent))" }} />
        </div>
        <input type="range" min={1} max={100} value={value} onChange={e => onChange(Number(e.target.value))}
          className="absolute w-full opacity-0 cursor-pointer" style={{ height: "16px", zIndex: 2 }} />
        <div className="absolute w-3.5 h-3.5 rounded-full pointer-events-none"
          style={{ left: `calc(${pct}% - 7px)`, background: "var(--text-primary)", boxShadow: "0 0 0 2px var(--bg-surface), 0 0 10px var(--accent-glow)", zIndex: 1 }} />
      </div>
      <div className="flex gap-1">
        {[1, 5, 10, 25, 50].map((lv) => (
          <button key={lv} onClick={() => onChange(lv)}
            className="flex-1 py-1 text-[10px] font-bold rounded-md transition-all"
            style={
              value === lv
                ? { background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent-mid)" }
                : { background: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid var(--border-subtle)" }
            }
          >
            {lv}×
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── TP/SL ── */
function TpSlSection({
  enabled, onToggle, tp, sl, onTp, onSl,
}: { enabled: boolean; onToggle: () => void; tp: string; sl: string; onTp: (v: string) => void; onSl: (v: string) => void }) {
  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
      <button onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5">
        <span className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>Take Profit / Stop Loss</span>
        <div className="w-8 h-4 rounded-full relative transition-all duration-200"
          style={{ background: enabled ? "var(--long)" : "var(--bg-overlay)", boxShadow: enabled ? "0 0 8px var(--long-glow)" : "none" }}>
          <div className="absolute top-0.5 w-3 h-3 rounded-full transition-all duration-200"
            style={{ background: "#fff", left: enabled ? "calc(100% - 14px)" : "2px" }} />
        </div>
      </button>
      {enabled && (
        <div className="px-3 pb-3 grid grid-cols-2 gap-2 animate-slide-up">
          {[
            { label: "TP", color: "var(--long)", val: tp, set: onTp, b: "var(--long-dim)" },
            { label: "SL", color: "var(--short)", val: sl, set: onSl, b: "var(--short-dim)" },
          ].map(({ label, color, val, set, b }) => (
            <div key={label}>
              <span className="text-[10px] font-medium" style={{ color }}>{label} Price</span>
              <div className="mt-1 flex items-center gap-1 px-2 rounded-lg"
                style={{ background: "var(--bg-overlay)", border: `1px solid ${b}`, height: "34px" }}>
                <input type="text" value={val} onChange={e => set(e.target.value)}
                  placeholder="0.00" className="flex-1 bg-transparent text-xs tabular focus:outline-none"
                  style={{ color: "var(--text-primary)" }} />
                <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>$</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>{label}</span>
      <span className="text-[11px] tabular" style={{ color: color ?? "var(--text-secondary)" }}>{value}</span>
    </div>
  );
}

/* ── Main Component ── */
export function OrderPanel() {
  const { address } = useAccount();
  const [selMarket, setSelMarket] = useState(AVAILABLE_MARKETS[0]);
  const [direction, setDirection] = useState<Direction>("long");
  const [orderType, setOrderType] = useState<OrderType>("Market");
  const [collateral, setCollateral] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [leverage, setLeverage]     = useState(10);
  const [tpsl, setTpsl]             = useState(false);
  const [tp, setTp]                 = useState("");
  const [sl, setSl]                 = useState("");

  /* Live data */
  const { marketInfo, isLoading: mktLoading } = useMarketData(selMarket.id);

  /* Tx */
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  /* USDC balance */
  const { data: rawBalance } = useReadContract({
    address: CONTRACTS.usdc,
    abi: ERC20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 10000 },
  });
  const balanceNum = rawBalance ? Number(rawBalance as bigint) / 1e6 : 0;

  /* Calcs */
  const collateralNum = parseFloat(collateral.replace(/,/g, "")) || 0;
  const posSize       = collateralNum * leverage;
  const fees          = posSize * 0.0005;
  const liqPct        = (100 / leverage).toFixed(1);
  const markStr       = marketInfo && marketInfo.markPrice > 0n ? formatPrice(marketInfo.markPrice) : "—";

  const handlePreset = useCallback((pct: number) => {
    setCollateral(fmt((balanceNum * pct) / 100));
  }, [balanceNum]);

  const handleTrade = () => {
    if (!address || !collateralNum) return;
    const margin   = parseUnits(collateralNum.toFixed(6), 6);
    const size     = parseUnits(posSize.toFixed(6), 6);
    const signed   = direction === "long" ? size : -size;
    writeContract({
      address: CONTRACTS.perpEngine,
      abi: PerpEngineAbi,
      functionName: "openPosition",
      args: [selMarket.id, signed, margin],
    });
  };

  const isLong     = direction === "long";
  const isBusy     = isPending || isConfirming;
  const btnGrad    = isLong
    ? "linear-gradient(135deg, #009f5e 0%, var(--long) 100%)"
    : "linear-gradient(135deg, #a01f36 0%, var(--short) 100%)";
  const btnGlow    = isLong ? "var(--long-glow)" : "var(--short-glow)";
  const risk       = leverage > 50 ? "HIGH" : leverage > 20 ? "MEDIUM" : "LOW";
  const riskStyle  = {
    HIGH:   { bg: "var(--short-dim)",   c: "var(--short)"   },
    MEDIUM: { bg: "var(--warning-dim)", c: "var(--warning)" },
    LOW:    { bg: "var(--long-dim)",    c: "var(--long)"    },
  }[risk];

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg-surface)" }}>

      {/* Header */}
      <div className="px-4 pt-3 pb-3 flex-shrink-0 space-y-2.5"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {AVAILABLE_MARKETS.map((m) => (
              <button key={m.id} onClick={() => setSelMarket(m)}
                className="text-[11px] font-bold px-2 py-0.5 rounded-md transition-all"
                style={
                  m.id === selMarket.id
                    ? { background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent-mid)" }
                    : { background: "transparent", color: "var(--text-muted)", border: "1px solid transparent" }
                }
              >
                {m.pair}
              </button>
            ))}
          </div>
          <OrderTypePills value={orderType} onChange={setOrderType} />
        </div>
        {!mktLoading && (
          <div className="flex items-center gap-2">
            <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>Mark Price</span>
            <span className="text-xs tabular font-semibold" style={{ color: "var(--text-secondary)" }}>${markStr}</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 space-y-4">
          <DirectionToggle value={direction} onChange={setDirection} />

          {orderType === "Limit" && (
            <FieldInput label="Limit Price" value={limitPrice} onChange={setLimitPrice} suffix="USD" />
          )}

          <FieldInput
            label="Collateral"
            value={collateral}
            onChange={setCollateral}
            suffix="USDC"
            onMax={() => setCollateral(fmt(balanceNum))}
            hint={
              <span>
                Bal:{" "}
                <span className="tabular" style={{ color: "var(--text-secondary)" }}>
                  {address ? `$${fmt(balanceNum)}` : "—"}
                </span>
              </span>
            }
          />

          <QuickAmounts onSelect={handlePreset} />

          <div className="flex items-center justify-between px-3 py-2.5 rounded-xl"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
            <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>Position Size</span>
            <span className="text-sm font-bold tabular"
              style={{ color: posSize > 0 ? "var(--text-primary)" : "var(--text-muted)" }}>
              {posSize > 0 ? `$${fmt(posSize)}` : "—"}
            </span>
          </div>

          <LevControl value={leverage} onChange={setLeverage} />
          <TpSlSection enabled={tpsl} onToggle={() => setTpsl(p => !p)} tp={tp} sl={sl} onTp={setTp} onSl={setSl} />

          {/* Summary */}
          <div className="space-y-2 px-3 py-3 rounded-xl"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
            <SummaryRow label="Entry Price"    value={orderType === "Limit" && limitPrice ? `$${limitPrice}` : "Market"} />
            <SummaryRow label="Liq. Distance"  value={collateralNum > 0 ? `~${liqPct}% from entry` : "—"} />
            <SummaryRow label="Margin"         value={collateralNum > 0 ? `$${fmt(collateralNum)}` : "—"} />
            <SummaryRow label="Fees (0.05%)"   value={fees > 0 ? `$${fees.toFixed(4)}` : "—"} color="var(--text-tertiary)" />
            <div className="divider" />
            <div className="flex items-center justify-between">
              <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>Risk Score</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: riskStyle.bg, color: riskStyle.c }}>{risk}</span>
            </div>
          </div>

          {isSuccess && (
            <div className="px-3 py-2 rounded-xl animate-slide-up"
              style={{ background: "var(--long-dim)", border: "1px solid var(--long-mid)" }}>
              <span className="text-[11px] font-semibold" style={{ color: "var(--long)" }}>
                ✓ Position opened
              </span>
            </div>
          )}
        </div>
      </div>

      {/* CTA */}
      <div className="px-4 py-4 flex-shrink-0" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        {!address ? (
          <p className="text-center py-2 text-[11px]" style={{ color: "var(--text-tertiary)" }}>
            Connect wallet to trade
          </p>
        ) : (
          <button
            onClick={handleTrade}
            disabled={isBusy || !collateralNum}
            className="w-full py-3 rounded-xl text-sm font-bold tracking-wide transition-all duration-200 active:scale-[0.98] relative overflow-hidden disabled:opacity-40"
            style={{
              background: btnGrad, color: "#000",
              boxShadow: isBusy ? "none" : `0 0 24px ${btnGlow}, inset 0 1px 0 rgba(255,255,255,0.15)`,
              letterSpacing: "0.04em",
            }}
          >
            <span className="absolute inset-0 pointer-events-none"
              style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.14) 0%, transparent 55%)" }} />
            <span className="relative">
              {isBusy
                ? (isConfirming ? "Confirming…" : "Sign in Wallet…")
                : `${isLong ? "▲ Long" : "▼ Short"} ${selMarket.pair}`}
            </span>
          </button>
        )}
        <p className="text-center text-[10px] mt-2" style={{ color: "var(--text-muted)" }}>
          Testnet · PerpV2 · Arbitrum Sepolia
        </p>
      </div>
    </div>
  );
}
