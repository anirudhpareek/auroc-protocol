"use client";

import { useState, useCallback } from "react";
import { parseUnits } from "viem";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { CONTRACTS, MARKETS, PerpEngineAbi, ERC20Abi } from "@/lib/contracts";
import { useMarketData } from "@/hooks/useMarketData";
import { formatPrice } from "@/lib/format";
import { AVAILABLE_TERMINAL_MARKETS, useTerminal } from "./TerminalContext";

type Direction = "long" | "short";
type OrderType = "Market" | "Limit";

const LEVERAGE_PRESETS = [2, 5, 10, 20, 50] as const;

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Spinner() {
  return (
    <svg className="animate-spin" width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.25"/>
      <path d="M6.5 1.5A5 5 0 0 1 11.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function Divider() {
  return <div className="divider" />;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: "var(--text-2xs)", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--t3)" }}>
      {children}
    </span>
  );
}

function DetailRow({ label, value, pencil }: { label: string; value: string; pencil?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ fontSize: "var(--text-xs)", color: "var(--t3)" }}>{label}</span>
      <span style={{ fontSize: "var(--text-xs)", color: "var(--t2)", fontFamily: "var(--mono)", display: "flex", alignItems: "center", gap: 3 }}>
        {pencil && (
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none" style={{ opacity: 0.4 }} aria-hidden="true">
            <path d="M1 8L6.5 3C7 2.5 7.8 2.5 8.1 2.9S8.2 4 7.6 4.5L2.2 8.5L1 8Z" stroke="currentColor" strokeWidth="0.8"/>
          </svg>
        )}
        {value}
      </span>
    </div>
  );
}

export function TradeTicket() {
  const { market: selMarket, setMarket: setSelMarket } = useTerminal();
  const { address } = useAccount();
  const [direction, setDirection] = useState<Direction>("long");
  const [orderType, setOrderType] = useState<OrderType>("Market");
  const [leverage, setLeverage] = useState(20);
  const [collateral, setCollateral] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [tpPrice, setTpPrice]     = useState("");
  const [slPrice, setSlPrice]     = useState("");
  const [tpsl, setTpsl]           = useState(false);
  const [focusedCollateral, setFocusedCollateral] = useState(false);
  const [focusedLimit, setFocusedLimit]           = useState(false);

  const { marketInfo } = useMarketData(selMarket.id);
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const { data: rawBalance } = useReadContract({
    address: CONTRACTS.usdc,
    abi: ERC20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 10000 },
  });

  const balanceNum    = rawBalance ? Number(rawBalance as bigint) / 1e6 : 0;
  const collateralNum = parseFloat(collateral.replace(/,/g, "")) || 0;
  const posSize       = collateralNum * leverage;
  const fees          = posSize * 0.0005;
  const markStr       = marketInfo && marketInfo.markPrice > 0n ? formatPrice(marketInfo.markPrice) : "—";
  const isLong        = direction === "long";
  const isBusy        = isPending || isConfirming;
  const pct           = balanceNum > 0 ? Math.min((collateralNum / balanceNum) * 100, 100) : 0;

  const accent     = isLong ? "var(--long)"       : "var(--short)";
  const accentBtn  = isLong ? "var(--long-btn)"   : "var(--short-btn)";
  const accentMid  = isLong ? "var(--long-mid)"   : "var(--short-mid)";
  const accentDim  = isLong ? "var(--long-dim)"   : "var(--short-dim)";
  const accentGlow = isLong ? "var(--long-glow)"  : "var(--short-glow)";

  const handleQuickPct = useCallback((p: number) => {
    if (balanceNum <= 0) return;
    setCollateral(p === 0 ? "" : fmt((balanceNum * p) / 100));
  }, [balanceNum]);

  const cycleLeverage = () => {
    const idx = LEVERAGE_PRESETS.indexOf(leverage as typeof LEVERAGE_PRESETS[number]);
    const next = idx === -1 || idx === LEVERAGE_PRESETS.length - 1 ? LEVERAGE_PRESETS[0] : LEVERAGE_PRESETS[idx + 1];
    setLeverage(next);
  };

  const handleTrade = () => {
    if (!address || !collateralNum) return;
    const margin = parseUnits(collateralNum.toFixed(6), 6);
    const size   = parseUnits(posSize.toFixed(6), 6);
    writeContract({
      address: CONTRACTS.perpEngine,
      abi: PerpEngineAbi,
      functionName: "openPosition",
      args: [selMarket.id, isLong ? size : -size, margin],
    });
  };

  const canTrade = !!address && collateralNum > 0 && !isBusy;
  const isMaxLev = leverage === LEVERAGE_PRESETS[LEVERAGE_PRESETS.length - 1];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--panel)", overflowY: "auto" }}>

      {/* ── 1. Market chips ── */}
      <div style={{ display: "flex", gap: "var(--sp-1)", padding: "var(--sp-2) var(--sp-3) 0" }}>
        {AVAILABLE_TERMINAL_MARKETS.map((m) => {
          const active = m.id === selMarket.id;
          return (
            <button key={m.id} onClick={() => setSelMarket(m)} style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "3px 10px", borderRadius: "var(--radius-md)", fontSize: "var(--text-xs)", fontWeight: 600,
              background: active ? "var(--raised)" : "transparent",
              color: active ? "var(--t1)" : "var(--t3)",
              border: `1px solid ${active ? "var(--b3)" : "transparent"}`,
              transition: "var(--transition-fast)",
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: active ? m.color : "var(--t3)", flexShrink: 0, display: "inline-block", transition: "background-color 0.1s" }} aria-hidden="true" />
              {m.pair}
            </button>
          );
        })}
      </div>

      {/* ── 2. Long / Short toggle ── */}
      <div style={{ padding: "var(--sp-2) var(--sp-3) 0" }}>
        <div style={{ display: "flex", borderRadius: "var(--radius-lg)", overflow: "hidden", border: "1px solid var(--b2)" }}>
          {(["long", "short"] as Direction[]).map((d) => {
            const active = direction === d;
            const dAccent = d === "long" ? "var(--long)" : "var(--short)";
            const dBtn    = d === "long" ? "var(--long-btn)" : "var(--short-btn)";
            const dGlow   = d === "long" ? "var(--long-glow)" : "var(--short-glow)";
            return (
              <button key={d} onClick={() => setDirection(d)} style={{
                flex: 1, height: 38, fontSize: "var(--text-sm)", fontWeight: 700,
                letterSpacing: "0.05em", textTransform: "uppercase",
                background: active ? dBtn : "transparent",
                color: active ? dAccent : "var(--t3)",
                borderRight: d === "long" ? "1px solid var(--b2)" : "none",
                position: "relative",
                transition: "var(--transition-fast)",
              }}>
                {active && <span aria-hidden="true" style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: 20, height: 2, borderRadius: 1, background: dAccent, boxShadow: `0 0 6px ${dGlow}` }} />}
                {d === "long" ? "▲ Long" : "▼ Short"}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 3. Order type + Cross + Leverage ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-1)", padding: "var(--sp-2) var(--sp-3) 0" }}>
        <div style={{ display: "flex", gap: 2, flex: 1 }}>
          {(["Market", "Limit"] as OrderType[]).map((t) => {
            const active = orderType === t;
            return (
              <button key={t} onClick={() => setOrderType(t)} style={{
                padding: "3px 9px", borderRadius: "var(--radius-md)", fontSize: "var(--text-xs)", fontWeight: 500,
                background: active ? "var(--raised)" : "transparent",
                color: active ? "var(--t1)" : "var(--t3)",
                border: `1px solid ${active ? "var(--b3)" : "transparent"}`,
                transition: "var(--transition-fast)",
              }}>{t}</button>
            );
          })}
        </div>

        <button style={{
          display: "flex", alignItems: "center", gap: 4,
          padding: "3px 9px", borderRadius: "var(--radius-md)",
          fontSize: "var(--text-xs)", color: "var(--t2)",
          border: "1px solid var(--b2)", background: "var(--raised)",
          transition: "var(--transition-fast)",
        }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path d="M2 5h6M3.5 3L2 5l1.5 2M6.5 3L8 5l-1.5 2" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Cross
        </button>

        <button onClick={cycleLeverage} style={{
          display: "flex", alignItems: "center", gap: 4,
          padding: "3px 9px", borderRadius: "var(--radius-md)",
          fontSize: "var(--text-xs)", fontWeight: 700,
          color: isMaxLev ? "var(--warning)" : accent,
          border: `1px solid ${isMaxLev ? "var(--warning-dim)" : accentMid}`,
          background: isMaxLev ? "var(--warning-dim)" : accentBtn,
          minWidth: 46, justifyContent: "center",
          transition: "var(--transition-fast)",
        }}>
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true" style={{ opacity: 0.7 }}>
            <path d="M1 7L4 1L7 7" stroke="currentColor" strokeWidth="0.9" strokeLinejoin="round"/>
          </svg>
          {leverage}×
        </button>
      </div>

      {/* ── 4. Limit price input (conditional) ── */}
      {orderType === "Limit" && (
        <div style={{ padding: "var(--sp-2) var(--sp-3) 0" }} className="animate-expand">
          <div style={{
            borderRadius: "var(--radius-lg)",
            border: `1px solid ${focusedLimit ? "var(--b3)" : "var(--b1)"}`,
            background: "var(--raised)", overflow: "hidden",
            transition: "border-color 0.1s",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px 3px" }}>
              <SectionLabel>Limit Price</SectionLabel>
              <span style={{ fontSize: "var(--text-2xs)", color: "var(--t3)" }}>Mark: ${markStr}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", padding: "0 10px 8px", gap: 6 }}>
              <input
                type="text" inputMode="decimal" value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                onFocus={() => setFocusedLimit(true)} onBlur={() => setFocusedLimit(false)}
                placeholder="0.00"
                aria-label="Limit price in USD"
                style={{
                  flex: 1, background: "transparent", border: "none", outline: "none",
                  fontSize: "var(--text-lg)", fontWeight: "var(--fw-medium)" as unknown as number, fontFamily: "var(--mono)", letterSpacing: "-0.02em",
                  color: limitPrice ? "var(--t1)" : "var(--t3)",
                }}
              />
              <span style={{ fontSize: "var(--text-xs)", color: "var(--t3)", fontFamily: "var(--mono)", flexShrink: 0 }}>USD</span>
            </div>
          </div>
        </div>
      )}

      {/* ── 5. Available + Max ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--sp-2) var(--sp-3) 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--t3)" }}>Available</span>
          <span className="tabular" style={{ fontSize: "var(--text-xs)", color: "var(--t1)", fontWeight: 500 }}>
            {address ? fmt(balanceNum) : "0.00"}
          </span>
          <span style={{ fontSize: "var(--text-2xs)", color: "var(--t3)" }}>USDC</span>
        </div>
        <button onClick={() => setCollateral(fmt(balanceNum))} disabled={!address || balanceNum === 0} style={{
          fontSize: "var(--text-2xs)", fontWeight: 700, letterSpacing: "0.04em",
          color: accent, padding: "2px 7px", borderRadius: "var(--radius-sm)",
          background: accentDim, border: `1px solid ${accentMid}`,
          transition: "var(--transition-fast)",
        }}>MAX</button>
      </div>

      {/* ── 6. Collateral input ── */}
      <div style={{ margin: "6px var(--sp-3) 0" }}>
        <div style={{
          borderRadius: "var(--radius-lg)",
          border: `1px solid ${focusedCollateral ? "var(--b3)" : "var(--b1)"}`,
          background: "var(--raised)", overflow: "hidden",
          transition: "border-color 0.1s",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px 3px" }}>
            <SectionLabel>Order Value</SectionLabel>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 12, height: 12, borderRadius: "50%", background: selMarket.color, display: "inline-block", flexShrink: 0 }} aria-hidden="true" />
              <span style={{ fontSize: "var(--text-2xs)", fontWeight: 600, color: "var(--t2)", letterSpacing: "0.04em" }}>{selMarket.symbol}</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px 8px" }}>
            <input
              type="text" inputMode="decimal" value={collateral}
              onChange={(e) => setCollateral(e.target.value)}
              onFocus={() => setFocusedCollateral(true)} onBlur={() => setFocusedCollateral(false)}
              placeholder="0"
              aria-label="Collateral amount in USDC"
              style={{
                background: "transparent", border: "none", outline: "none",
                fontSize: "var(--text-2xl)", fontWeight: "var(--fw-medium)" as unknown as number, letterSpacing: "-0.03em",
                color: collateral ? "var(--t1)" : "var(--t3)",
                width: "55%", fontFamily: "var(--mono)",
              }}
            />
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "var(--text-2xs)", color: "var(--t4)", marginBottom: 2 }}>USDC</div>
              <div className="tabular" style={{ fontSize: "var(--text-xs)", color: "var(--t2)" }}>
                ≈{" "}
                {collateralNum > 0 && markStr !== "—"
                  ? (collateralNum / parseFloat(markStr.replace(/,/g, ""))).toFixed(4)
                  : "0.0000"}{" "}{selMarket.symbol}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 7. Slider + quick % ── */}
      <div style={{ padding: "var(--sp-2) var(--sp-3) 0" }}>
        <div style={{ position: "relative", height: 16, display: "flex", alignItems: "center" }}>
          <div style={{ position: "absolute", width: "100%", height: 2, background: "var(--b2)", borderRadius: 1 }}>
            <div style={{
              height: "100%", width: `${pct}%`,
              background: accent, borderRadius: 1,
              transition: "width 0.15s",
              boxShadow: pct > 0 ? `0 0 5px ${accentGlow}` : "none",
            }} />
          </div>
          <input
            type="range" min={0} max={balanceNum || 100} step={0.01} value={collateralNum}
            onChange={(e) => setCollateral(Number(e.target.value) === 0 ? "" : fmt(Number(e.target.value)))}
            aria-label="Collateral percentage of balance"
            style={{ position: "absolute", width: "100%", opacity: 0, cursor: "pointer", height: 16, zIndex: 2 }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "var(--sp-1)" }}>
          {[0, 25, 50, 75, 100].map((p) => {
            const isActive = balanceNum > 0 && p > 0 && pct >= p - 1;
            return (
              <button key={p} onClick={() => handleQuickPct(p)} style={{
                fontSize: "var(--text-2xs)", fontWeight: 600, letterSpacing: "0.03em",
                color: isActive ? accent : "var(--t3)",
                padding: "2px 5px", borderRadius: "var(--radius-sm)",
                background: isActive ? accentDim : "transparent",
                transition: "var(--transition-fast)",
              }}>{p}%</button>
            );
          })}
        </div>
      </div>

      {/* ── 8. TP / SL toggle + inputs ── */}
      <div style={{ padding: "var(--sp-2) var(--sp-3) 0" }}>
        <button
          onClick={() => setTpsl(p => !p)}
          aria-pressed={tpsl}
          style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", background: "none", border: "none", cursor: "pointer", padding: 0, width: "100%" }}
        >
          <span style={{
            width: 15, height: 15, borderRadius: "var(--radius-sm)", flexShrink: 0,
            border: `1.5px solid ${tpsl ? accent : "var(--b3)"}`,
            background: tpsl ? accentBtn : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "var(--transition-fast)",
          }}>
            {tpsl && (
              <svg width="9" height="7" viewBox="0 0 9 7" fill="none" aria-hidden="true">
                <path d="M1 3.5L3.5 6L8 1" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </span>
          <span style={{ fontSize: "var(--text-xs)", color: tpsl ? "var(--t1)" : "var(--t2)", transition: "color 0.1s" }}>
            Take Profit / Stop Loss
          </span>
        </button>

        {tpsl && (
          <div className="animate-expand" style={{ display: "flex", gap: "var(--sp-2)", marginTop: "var(--sp-2)" }}>
            <div style={{ flex: 1, borderRadius: "var(--radius-md)", border: "1px solid var(--long-mid)", background: "var(--long-dim)", padding: "6px 10px" }}>
              <div className="label-upper" style={{ marginBottom: 4, color: "var(--long-dark)" }}>TP Price</div>
              <input
                type="text" inputMode="decimal" value={tpPrice}
                onChange={(e) => setTpPrice(e.target.value)}
                placeholder="—"
                aria-label="Take profit price"
                style={{
                  width: "100%", background: "transparent", border: "none", outline: "none",
                  fontSize: "var(--text-sm)", fontFamily: "var(--mono)", fontWeight: 500,
                  color: "var(--long)",
                }}
              />
            </div>
            <div style={{ flex: 1, borderRadius: "var(--radius-md)", border: "1px solid var(--short-mid)", background: "var(--short-dim)", padding: "6px 10px" }}>
              <div className="label-upper" style={{ marginBottom: 4, color: "var(--short-dark)" }}>SL Price</div>
              <input
                type="text" inputMode="decimal" value={slPrice}
                onChange={(e) => setSlPrice(e.target.value)}
                placeholder="—"
                aria-label="Stop loss price"
                style={{
                  width: "100%", background: "transparent", border: "none", outline: "none",
                  fontSize: "var(--text-sm)", fontFamily: "var(--mono)", fontWeight: 500,
                  color: "var(--short)",
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── 9. CTA button ── */}
      <div style={{ padding: "var(--sp-3) var(--sp-3) 0" }}>
        {!address ? (
          <div style={{
            textAlign: "center", fontSize: "var(--text-sm)", color: "var(--t3)",
            padding: "14px 0", border: "1px dashed var(--b2)", borderRadius: "var(--radius-lg)",
          }}>
            Connect wallet to trade
          </div>
        ) : (
          <button
            onClick={handleTrade}
            disabled={!canTrade}
            style={{
              width: "100%", height: "var(--h-btn-lg)", borderRadius: "var(--radius-lg)",
              fontSize: "var(--text-sm)", fontWeight: 700, letterSpacing: "0.03em",
              cursor: canTrade ? "pointer" : "not-allowed",
              background: canTrade ? accentBtn : "var(--raised)",
              color: canTrade ? accent : "var(--t3)",
              border: `1px solid ${canTrade ? accentMid : "var(--b1)"}`,
              transition: "var(--transition-medium)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            {isBusy && <Spinner />}
            {isBusy
              ? (isConfirming ? "Confirming…" : "Sign in Wallet…")
              : collateralNum
                ? `${isLong ? "▲ Long" : "▼ Short"} ${selMarket.pair}`
                : "Enter an amount"
            }
          </button>
        )}
      </div>

      {/* ── Success ── */}
      {isSuccess && (
        <div role="status" aria-live="polite" className="animate-slide-up" style={{
          margin: "var(--sp-2) var(--sp-3) 0",
          padding: "9px 12px", borderRadius: "var(--radius-md)",
          background: "var(--long-dim)", border: "1px solid var(--long-mid)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <circle cx="7" cy="7" r="5.5" stroke="var(--long)" strokeWidth="1.2"/>
            <path d="M4.5 7L6.5 9L9.5 5" stroke="var(--long)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--long)" }}>Position opened successfully</span>
        </div>
      )}

      <div style={{ marginTop: "var(--sp-3)" }}><Divider /></div>

      {/* ── 10. Trade details ── */}
      <div style={{ padding: "var(--sp-2) var(--sp-3)", display: "flex", flexDirection: "column", gap: 7 }}>
        <DetailRow label="Liquidation Price" value="—" />
        <DetailRow label="Order Value"       value={collateralNum > 0 ? `$${fmt(posSize)}` : "$0.00"} />
        <DetailRow label="Margin Required"   value={collateralNum > 0 ? `$${fmt(collateralNum)}` : "$0.00"} />
        <DetailRow label="Slippage"          value="10.0%" pencil />
        <DetailRow label="Auroc Fees"        value={fees > 0 ? `$${fees.toFixed(4)} / $${(fees * 1.2).toFixed(4)}` : "$0.00 / $0.00"} />
      </div>
      <div style={{ padding: "0 var(--sp-3) var(--sp-2)" }}>
        <span style={{ fontSize: "var(--text-2xs)", color: "var(--t4)" }}>0% fees on all trades</span>
      </div>

      <Divider />

      {/* ── 11. Account ── */}
      <div style={{ padding: "var(--sp-2) var(--sp-3)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 14, height: 14, borderRadius: "50%", background: "var(--blue)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 7, fontWeight: 700, color: "#fff" }} aria-hidden="true">$</span>
            <span className="tabular" style={{ fontSize: "var(--text-sm)", color: "var(--t1)", fontWeight: 500 }}>{address ? fmt(balanceNum) : "0.00"}</span>
            <span style={{ fontSize: "var(--text-2xs)", color: "var(--t3)" }}>USDC</span>
          </div>
          <button style={{
            padding: "3px 10px", borderRadius: "var(--radius-md)", fontSize: "var(--text-xs)", fontWeight: 600,
            color: "var(--t1)", border: "1px solid var(--b2)", background: "var(--raised)",
            display: "flex", alignItems: "center", gap: 4, transition: "var(--transition-fast)",
          }}>
            Transfer
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
              <path d="M2 4H6M4.5 2.5L6 4L4.5 5.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        <div style={{ marginTop: "var(--sp-2)", display: "flex", flexDirection: "column", gap: 7 }}>
          <DetailRow label="Maintenance Margin"     value="—" />
          <DetailRow label="Cross Account Leverage" value="—" />
        </div>
      </div>

      {/* ── 12. Footer ── */}
      <div style={{ padding: "0 var(--sp-3) var(--sp-3)", marginTop: "auto" }}>
        <Divider />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "var(--sp-2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: "var(--text-2xs)", color: "var(--t3)" }}>Mark</span>
            <span className="tabular" style={{ fontSize: "var(--text-2xs)", color: "var(--t2)" }}>${markStr}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span className="animate-live" aria-hidden="true" style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--long)", display: "inline-block" }} />
            <span style={{ fontSize: "var(--text-2xs)", color: "var(--t3)" }}>Arbitrum Sepolia</span>
          </div>
        </div>
      </div>
    </div>
  );
}
