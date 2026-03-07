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
const SLIPPAGE_PRESETS = [0.1, 0.5, 1.0] as const;

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
    <span
      className="font-semibold uppercase tracking-wider"
      style={{ fontSize: "var(--text-2xs)", color: "var(--t3)" }}
    >
      {children}
    </span>
  );
}

function DetailRow({ label, value, pencil }: { label: string; value: string; pencil?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ fontSize: "var(--text-xs)", color: "var(--t3)" }}>{label}</span>
      <span
        className="tabular flex items-center gap-[3px]"
        style={{ fontSize: "var(--text-xs)", color: "var(--t2)" }}
      >
        {pencil && (
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none" className="opacity-40" aria-hidden="true">
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
  const [slippage, setSlippage]   = useState(0.5);
  const [customSlippage, setCustomSlippage] = useState("");
  const [showSlippageMenu, setShowSlippageMenu] = useState(false);

  const { marketInfo } = useMarketData(selMarket.id);
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const { writeContract: writeApprove, data: approveTxHash, isPending: isApproving } = useWriteContract();
  const { isLoading: isApproveConfirming } = useWaitForTransactionReceipt({ hash: approveTxHash });

  const { data: rawBalance } = useReadContract({
    address: CONTRACTS.usdc,
    abi: ERC20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 10000 },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACTS.usdc,
    abi: ERC20Abi,
    functionName: "allowance",
    args: address ? [address, CONTRACTS.perpEngine] : undefined,
    query: { enabled: !!address, refetchInterval: 5000 },
  });

  const balanceNum    = rawBalance ? Number(rawBalance as bigint) / 1e6 : 0;
  const collateralNum = parseFloat(collateral.replace(/,/g, "")) || 0;
  const posSize       = collateralNum * leverage;
  const fees          = posSize * 0.0005;
  const markStr       = marketInfo && marketInfo.markPrice > 0n ? formatPrice(marketInfo.markPrice) : "—";
  const isLong        = direction === "long";

  const requiredMargin = collateralNum > 0 ? parseUnits(collateralNum.toFixed(6), 6) : 0n;
  const hasAllowance   = allowance !== undefined && (allowance as bigint) >= requiredMargin;
  const needsApproval  = !!address && collateralNum > 0 && !hasAllowance;
  const isApproveBusy  = isApproving || isApproveConfirming;
  const isBusy         = isPending || isConfirming;
  const pct            = balanceNum > 0 ? Math.min((collateralNum / balanceNum) * 100, 100) : 0;

  const accent     = isLong ? "var(--long)"       : "var(--short)";
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

  const handleApprove = () => {
    writeApprove({
      address: CONTRACTS.usdc,
      abi: ERC20Abi,
      functionName: "approve",
      args: [CONTRACTS.perpEngine, parseUnits("1000000", 6)],
    });
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

  const canTrade = !!address && collateralNum > 0 && !isBusy && !needsApproval;
  const isMaxLev = leverage === LEVERAGE_PRESETS[LEVERAGE_PRESETS.length - 1];

  const handleCustomSlippage = (val: string) => {
    setCustomSlippage(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 50) {
      setSlippage(parsed);
    }
  };

  return (
    <div
      className="flex flex-col h-full overflow-y-auto"
      style={{ background: "var(--panel)" }}
    >

      {/* -- 1. Market chips -- */}
      <div className="flex gap-1 px-3 pt-2">
        {AVAILABLE_TERMINAL_MARKETS.map((m) => {
          const active = m.id === selMarket.id;
          return (
            <button
              key={m.id}
              onClick={() => setSelMarket(m)}
              className="flex items-center gap-[5px] px-[10px] py-[3px] font-semibold transition-all"
              style={{
                borderRadius: "var(--radius-md)",
                fontSize: "var(--text-xs)",
                background: active ? "var(--raised)" : "transparent",
                color: active ? "var(--t1)" : "var(--t3)",
                border: `1px solid ${active ? "var(--b3)" : "transparent"}`,
              }}
            >
              <span
                className="inline-block shrink-0 rounded-full transition-colors duration-100"
                style={{ width: 6, height: 6, background: active ? m.color : "var(--t3)" }}
                aria-hidden="true"
              />
              {m.pair}
            </button>
          );
        })}
      </div>

      {/* -- 2. Long / Short toggle -- */}
      <div className="px-3 pt-2">
        <div
          className="flex overflow-hidden"
          style={{ borderRadius: "var(--radius-lg)", border: "1px solid var(--b2)" }}
        >
          {(["long", "short"] as Direction[]).map((d) => {
            const active = direction === d;
            return (
              <button
                key={d}
                onClick={() => setDirection(d)}
                aria-pressed={active}
                className="flex-1 font-bold uppercase tracking-wider transition-all"
                style={{
                  height: 38,
                  fontSize: "var(--text-sm)",
                  letterSpacing: "0.04em",
                  background: active
                    ? (d === "long" ? "var(--long)" : "var(--short)")
                    : (d === "long" ? "var(--long-active)" : "var(--short-active)"),
                  color: active
                    ? "#fff"
                    : (d === "long" ? "var(--long)" : "var(--short)"),
                  borderRight: d === "long" ? "1px solid var(--b2)" : "none",
                  opacity: active ? 1 : 0.45,
                }}
              >
                {d === "long" ? "▲ Long" : "▼ Short"}
              </button>
            );
          })}
        </div>
      </div>

      {/* -- 3. Order type + Cross -- */}
      <div className="flex items-center gap-1 px-3 pt-2">
        <div className="flex gap-[2px] flex-1">
          {(["Market", "Limit"] as OrderType[]).map((t) => {
            const active = orderType === t;
            return (
              <button
                key={t}
                onClick={() => setOrderType(t)}
                className="px-[9px] py-[3px] font-medium transition-all"
                style={{
                  borderRadius: "var(--radius-md)",
                  fontSize: "var(--text-xs)",
                  background: active ? "var(--raised)" : "transparent",
                  color: active ? "var(--t1)" : "var(--t3)",
                  border: `1px solid ${active ? "var(--b3)" : "transparent"}`,
                }}
              >
                {t}
              </button>
            );
          })}
        </div>

        <button
          className="flex items-center gap-1 px-[9px] py-[3px] transition-all"
          style={{
            borderRadius: "var(--radius-md)",
            fontSize: "var(--text-xs)",
            color: "var(--t2)",
            border: "1px solid var(--b2)",
            background: "var(--raised)",
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path d="M2 5h6M3.5 3L2 5l1.5 2M6.5 3L8 5l-1.5 2" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Cross
        </button>
      </div>

      {/* -- 3b. Leverage selector -- */}
      <div className="flex items-center gap-1 px-3 pt-2">
        {LEVERAGE_PRESETS.map((lev) => {
          const active = leverage === lev;
          const isMax = lev === LEVERAGE_PRESETS[LEVERAGE_PRESETS.length - 1];
          return (
            <button
              key={lev}
              onClick={() => setLeverage(lev)}
              aria-pressed={active}
              className="flex-1 flex items-center justify-center font-bold transition-all"
              style={{
                height: 28,
                borderRadius: "var(--radius-md)",
                fontSize: "var(--text-xs)",
                color: active
                  ? (isMax ? "var(--warning)" : accent)
                  : "var(--t3)",
                background: active
                  ? (isMax ? "var(--warning-dim)" : accentDim)
                  : "transparent",
                border: `1px solid ${
                  active
                    ? (isMax ? "var(--warning-mid)" : accentMid)
                    : "var(--b1)"
                }`,
              }}
            >
              {lev}x
            </button>
          );
        })}
        <button
          onClick={cycleLeverage}
          aria-label="Cycle leverage"
          className="flex items-center justify-center shrink-0 transition-all"
          style={{
            width: 28,
            height: 28,
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--b2)",
            background: "var(--raised)",
            color: "var(--t2)",
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path d="M8 3.5A3.5 3.5 0 1 0 8.5 7M8 1v3h-3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* -- 4. Limit price input (conditional) -- */}
      {orderType === "Limit" && (
        <div className="px-3 pt-2 animate-expand">
          <div
            className="overflow-hidden transition-colors duration-100"
            style={{
              borderRadius: "var(--radius-lg)",
              border: `1px solid ${focusedLimit ? "var(--b3)" : "var(--b1)"}`,
              background: "var(--raised)",
            }}
          >
            <div className="flex items-center justify-between px-[10px] pt-[6px] pb-[3px]">
              <SectionLabel>Limit Price</SectionLabel>
              <span style={{ fontSize: "var(--text-2xs)", color: "var(--t3)" }}>Mark: ${markStr}</span>
            </div>
            <div className="flex items-center gap-[6px] px-[10px] pb-2">
              <input
                type="text"
                inputMode="decimal"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                onFocus={() => setFocusedLimit(true)}
                onBlur={() => setFocusedLimit(false)}
                placeholder="0.00"
                aria-label="Limit price in USD"
                className="flex-1 bg-transparent border-none outline-none tabular"
                style={{
                  fontSize: "var(--text-lg)",
                  fontWeight: "var(--fw-medium)" as unknown as number,
                  letterSpacing: "-0.02em",
                  color: limitPrice ? "var(--t1)" : "var(--t3)",
                }}
              />
              <span
                className="tabular shrink-0"
                style={{ fontSize: "var(--text-xs)", color: "var(--t3)" }}
              >
                USD
              </span>
            </div>
          </div>
        </div>
      )}

      {/* -- 5. Available + Max -- */}
      <div className="flex items-center justify-between px-3 pt-2">
        <div className="flex items-center gap-[5px]">
          <span style={{ fontSize: "var(--text-xs)", color: "var(--t3)" }}>Available</span>
          <span
            className="tabular font-medium"
            style={{ fontSize: "var(--text-xs)", color: "var(--t1)" }}
          >
            {address ? fmt(balanceNum) : "0.00"}
          </span>
          <span style={{ fontSize: "var(--text-2xs)", color: "var(--t3)" }}>USDC</span>
        </div>
        <button
          onClick={() => setCollateral(fmt(balanceNum))}
          disabled={!address || balanceNum === 0}
          className="font-bold tracking-wider transition-all"
          style={{
            fontSize: "var(--text-2xs)",
            letterSpacing: "0.04em",
            color: accent,
            padding: "2px 7px",
            borderRadius: "var(--radius-sm)",
            background: accentDim,
            border: `1px solid ${accentMid}`,
          }}
        >
          MAX
        </button>
      </div>

      {/* -- 6. Collateral input -- */}
      <div className="mx-3 mt-[6px]">
        <div
          className="overflow-hidden transition-colors duration-100"
          style={{
            borderRadius: "var(--radius-lg)",
            border: `1px solid ${focusedCollateral ? "var(--b3)" : "var(--b1)"}`,
            background: "var(--raised)",
          }}
        >
          <div className="flex items-center justify-between px-[10px] pt-[7px] pb-[3px]">
            <SectionLabel>Order Value</SectionLabel>
            <div className="flex items-center gap-[5px]">
              <span
                className="inline-block shrink-0 rounded-full"
                style={{ width: 12, height: 12, background: selMarket.color }}
                aria-hidden="true"
              />
              <span
                className="font-semibold tracking-wider"
                style={{ fontSize: "var(--text-2xs)", color: "var(--t2)" }}
              >
                {selMarket.symbol}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between px-[10px] pb-2">
            <input
              type="text"
              inputMode="decimal"
              value={collateral}
              onChange={(e) => setCollateral(e.target.value)}
              onFocus={() => setFocusedCollateral(true)}
              onBlur={() => setFocusedCollateral(false)}
              placeholder="0"
              aria-label="Collateral amount in USDC"
              className="bg-transparent border-none outline-none tabular w-[55%]"
              style={{
                fontSize: "var(--text-2xl)",
                fontWeight: "var(--fw-medium)" as unknown as number,
                letterSpacing: "-0.03em",
                color: collateral ? "var(--t1)" : "var(--t3)",
              }}
            />
            <div className="text-right">
              <div style={{ fontSize: "var(--text-2xs)", color: "var(--t4)" }} className="mb-[2px]">USDC</div>
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

      {/* -- 7. Slider + quick % -- */}
      <div className="px-3 pt-2">
        <div className="relative h-4 flex items-center">
          <div className="absolute w-full h-[2px] rounded-[1px]" style={{ background: "var(--b2)" }}>
            <div
              className="h-full rounded-[1px] transition-[width] duration-150"
              style={{
                width: `${pct}%`,
                background: accent,
                boxShadow: pct > 0 ? `0 0 5px ${accentGlow}` : "none",
              }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={balanceNum || 100}
            step={0.01}
            value={collateralNum}
            onChange={(e) => setCollateral(Number(e.target.value) === 0 ? "" : fmt(Number(e.target.value)))}
            aria-label="Collateral percentage of balance"
            className="absolute w-full opacity-0 cursor-pointer h-4 z-[2]"
          />
        </div>
        <div className="flex justify-between mt-1">
          {[0, 25, 50, 75, 100].map((p) => {
            const isActive = balanceNum > 0 && p > 0 && pct >= p - 1;
            return (
              <button
                key={p}
                onClick={() => handleQuickPct(p)}
                className="font-semibold tracking-wider px-[5px] py-[2px] transition-all"
                style={{
                  fontSize: "var(--text-2xs)",
                  color: isActive ? accent : "var(--t3)",
                  borderRadius: "var(--radius-sm)",
                  background: isActive ? accentDim : "transparent",
                }}
              >
                {p}%
              </button>
            );
          })}
        </div>
      </div>

      {/* -- 8. TP / SL toggle + inputs -- */}
      <div className="px-3 pt-2">
        <button
          onClick={() => setTpsl(p => !p)}
          aria-pressed={tpsl}
          className="flex items-center gap-2 w-full p-0"
        >
          <span
            className="shrink-0 flex items-center justify-center transition-all"
            style={{
              width: 15,
              height: 15,
              borderRadius: "var(--radius-sm)",
              border: `1.5px solid ${tpsl ? accent : "var(--b3)"}`,
              background: tpsl ? accentDim : "transparent",
            }}
          >
            {tpsl && (
              <svg width="9" height="7" viewBox="0 0 9 7" fill="none" aria-hidden="true">
                <path d="M1 3.5L3.5 6L8 1" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </span>
          <span
            className="transition-colors duration-100"
            style={{
              fontSize: "var(--text-xs)",
              color: tpsl ? "var(--t1)" : "var(--t2)",
            }}
          >
            Take Profit / Stop Loss
          </span>
        </button>

        {tpsl && (
          <div className="flex gap-2 mt-2 animate-expand">
            <div
              className="flex-1 px-[10px] py-[6px]"
              style={{
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--long-mid)",
                background: "var(--long-dim)",
              }}
            >
              <div className="label-upper mb-1" style={{ color: "var(--long-dark)" }}>TP Price</div>
              <input
                type="text"
                inputMode="decimal"
                value={tpPrice}
                onChange={(e) => setTpPrice(e.target.value)}
                placeholder="—"
                aria-label="Take profit price"
                className="w-full bg-transparent border-none outline-none tabular font-medium"
                style={{
                  fontSize: "var(--text-sm)",
                  color: "var(--long)",
                }}
              />
            </div>
            <div
              className="flex-1 px-[10px] py-[6px]"
              style={{
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--short-mid)",
                background: "var(--short-dim)",
              }}
            >
              <div className="label-upper mb-1" style={{ color: "var(--short-dark)" }}>SL Price</div>
              <input
                type="text"
                inputMode="decimal"
                value={slPrice}
                onChange={(e) => setSlPrice(e.target.value)}
                placeholder="—"
                aria-label="Stop loss price"
                className="w-full bg-transparent border-none outline-none tabular font-medium"
                style={{
                  fontSize: "var(--text-sm)",
                  color: "var(--short)",
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* -- 9. CTA button -- */}
      <div className="flex flex-col gap-2 px-3 pt-3">
        {!address ? (
          <div
            className="text-center py-[14px]"
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--t3)",
              border: "1px dashed var(--b2)",
              borderRadius: "var(--radius-lg)",
            }}
          >
            Connect wallet to trade
          </div>
        ) : needsApproval ? (
          <button
            onClick={handleApprove}
            disabled={isApproveBusy}
            className="w-full flex items-center justify-center gap-2 font-bold tracking-wider transition-all border-none"
            style={{
              height: "var(--h-btn-lg)",
              borderRadius: "var(--radius-lg)",
              fontSize: "var(--text-sm)",
              cursor: isApproveBusy ? "not-allowed" : "pointer",
              background: "var(--gold)",
              color: "#000",
            }}
          >
            {isApproveBusy && <Spinner />}
            {isApproveBusy
              ? (isApproveConfirming ? "Confirming approval…" : "Sign approval in wallet…")
              : "Approve USDC to trade"
            }
          </button>
        ) : (
          <button
            onClick={handleTrade}
            disabled={!canTrade}
            className="w-full flex items-center justify-center gap-2 font-bold tracking-wider transition-all"
            style={{
              height: "var(--h-btn-lg)",
              borderRadius: "var(--radius-lg)",
              fontSize: "var(--text-sm)",
              cursor: canTrade ? "pointer" : "not-allowed",
              background: canTrade ? accent : "var(--raised)",
              color: canTrade ? "#fff" : "var(--t3)",
              border: `1px solid ${canTrade ? accentMid : "var(--b1)"}`,
              opacity: canTrade ? 1 : 0.6,
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

      {/* -- Success toast -- */}
      {isSuccess && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 mx-3 mt-2 px-3 py-[9px] animate-slide-up"
          style={{
            borderRadius: "var(--radius-md)",
            background: "var(--long-dim)",
            border: "1px solid var(--long-mid)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <circle cx="7" cy="7" r="5.5" stroke="var(--long)" strokeWidth="1.2"/>
            <path d="M4.5 7L6.5 9L9.5 5" stroke="var(--long)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--long)" }}>Position opened successfully</span>
        </div>
      )}

      <div className="mt-3"><Divider /></div>

      {/* -- 10. Trade details -- */}
      <div className="flex flex-col gap-[7px] px-3 py-2">
        <DetailRow label="Liquidation Price" value="—" />
        <DetailRow label="Order Value"       value={collateralNum > 0 ? `$${fmt(posSize)}` : "$0.00"} />
        <DetailRow label="Margin Required"   value={collateralNum > 0 ? `$${fmt(collateralNum)}` : "$0.00"} />

        {/* Slippage row with dropdown */}
        <div className="relative">
          <div className="flex items-center justify-between">
            <span style={{ fontSize: "var(--text-xs)", color: "var(--t3)" }}>Slippage</span>
            <button
              onClick={() => setShowSlippageMenu(prev => !prev)}
              aria-label="Configure slippage tolerance"
              className="tabular flex items-center gap-[3px] cursor-pointer"
              style={{ fontSize: "var(--text-xs)", color: "var(--t2)" }}
            >
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none" className="opacity-40" aria-hidden="true">
                <path d="M1 8L6.5 3C7 2.5 7.8 2.5 8.1 2.9S8.2 4 7.6 4.5L2.2 8.5L1 8Z" stroke="currentColor" strokeWidth="0.8"/>
              </svg>
              {slippage}%
            </button>
          </div>

          {showSlippageMenu && (
            <div
              className="mt-[6px] p-[6px] flex items-center gap-1 animate-expand"
              style={{
                borderRadius: "var(--radius-md)",
                background: "var(--raised)",
                border: "1px solid var(--b2)",
              }}
            >
              {SLIPPAGE_PRESETS.map((s) => {
                const active = slippage === s && customSlippage === "";
                return (
                  <button
                    key={s}
                    onClick={() => { setSlippage(s); setCustomSlippage(""); }}
                    aria-pressed={active}
                    className="flex-1 py-[3px] font-semibold tabular transition-all"
                    style={{
                      borderRadius: "var(--radius-sm)",
                      fontSize: "var(--text-2xs)",
                      background: active ? accentDim : "transparent",
                      color: active ? accent : "var(--t3)",
                      border: `1px solid ${active ? accentMid : "transparent"}`,
                    }}
                  >
                    {s}%
                  </button>
                );
              })}
              <div
                className="flex items-center gap-[2px] px-[6px] flex-1"
                style={{
                  borderRadius: "var(--radius-sm)",
                  border: `1px solid ${customSlippage ? accentMid : "var(--b2)"}`,
                  background: customSlippage ? accentDim : "transparent",
                }}
              >
                <input
                  type="text"
                  inputMode="decimal"
                  value={customSlippage}
                  onChange={(e) => handleCustomSlippage(e.target.value)}
                  placeholder="Custom"
                  aria-label="Custom slippage percentage"
                  className="bg-transparent border-none outline-none tabular w-full py-[3px]"
                  style={{
                    fontSize: "var(--text-2xs)",
                    color: customSlippage ? accent : "var(--t3)",
                  }}
                />
                <span
                  style={{ fontSize: "var(--text-2xs)", color: "var(--t3)" }}
                  className="shrink-0"
                >
                  %
                </span>
              </div>
            </div>
          )}
        </div>

        <DetailRow label="Auroc Fees" value={fees > 0 ? `$${fees.toFixed(4)} / $${(fees * 1.2).toFixed(4)}` : "$0.00 / $0.00"} />
      </div>

      <Divider />

      {/* -- 11. Account -- */}
      <div className="px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-[6px]">
            <span
              className="shrink-0 flex items-center justify-center rounded-full font-bold text-white"
              style={{
                width: 14,
                height: 14,
                background: "var(--blue)",
                fontSize: 7,
              }}
              aria-hidden="true"
            >
              $
            </span>
            <span
              className="tabular font-medium"
              style={{ fontSize: "var(--text-sm)", color: "var(--t1)" }}
            >
              {address ? fmt(balanceNum) : "0.00"}
            </span>
            <span style={{ fontSize: "var(--text-2xs)", color: "var(--t3)" }}>USDC</span>
          </div>
          <button
            className="flex items-center gap-1 px-[10px] py-[3px] font-semibold transition-all"
            style={{
              borderRadius: "var(--radius-md)",
              fontSize: "var(--text-xs)",
              color: "var(--t1)",
              border: "1px solid var(--b2)",
              background: "var(--raised)",
            }}
          >
            Transfer
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
              <path d="M2 4H6M4.5 2.5L6 4L4.5 5.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        <div className="flex flex-col gap-[7px] mt-2">
          <DetailRow label="Maintenance Margin"     value="—" />
          <DetailRow label="Cross Account Leverage" value="—" />
        </div>
      </div>

      {/* -- 12. Footer -- */}
      <div className="px-3 pb-3 mt-auto">
        <Divider />
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-[5px]">
            <span style={{ fontSize: "var(--text-2xs)", color: "var(--t3)" }}>Mark</span>
            <span className="tabular" style={{ fontSize: "var(--text-2xs)", color: "var(--t2)" }}>${markStr}</span>
          </div>
          <div className="flex items-center gap-[5px]">
            <span
              className="inline-block rounded-full animate-live"
              style={{ width: 5, height: 5, background: "var(--long)" }}
              aria-hidden="true"
            />
            <span style={{ fontSize: "var(--text-2xs)", color: "var(--t3)" }}>Arbitrum Sepolia</span>
          </div>
        </div>
      </div>
    </div>
  );
}
