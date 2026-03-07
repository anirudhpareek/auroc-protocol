"use client";

import { useState, useCallback } from "react";
import { parseUnits, formatUnits } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { CONTRACTS, ERC20Abi, CONTRACTS_V3 } from "@/lib/contracts";
import { useMarketData } from "@/hooks/useMarketData";
import { useCollateralRequired, useMintOption, useApproveForOptions } from "@/hooks/useOptions";
import { useClientGreeks } from "@/hooks/useOptions";
import { AVAILABLE_TERMINAL_MARKETS, useTerminal } from "./TerminalContext";
import { OptionLeg, OptionType, OptionSide, Regime } from "@/types";
import { formatPrice, formatUsdc } from "@/lib/format";
import { formatGreek, formatIV, formatPremiumPct } from "@/lib/options";

type OptionDir = "CALL" | "PUT";
type OptionPos = "BUY" | "SELL";

function Spinner() {
  return (
    <svg className="animate-spin" width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.25"/>
      <path d="M6.5 1.5A5 5 0 0 1 11.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "var(--b1)", margin: "0" }} />;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-semibold uppercase tracking-wider" style={{ fontSize: "var(--text-2xs)", color: "var(--t3)" }}>
      {children}
    </span>
  );
}

function DetailRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ fontSize: "var(--text-xs)", color: "var(--t3)" }}>{label}</span>
      <span className="tabular" style={{ fontSize: "var(--text-xs)", color: accent ? "var(--gold)" : "var(--t2)" }}>
        {value}
      </span>
    </div>
  );
}

const WAD = BigInt("1000000000000000000");
const DEFAULT_IV = BigInt("200000000000000000"); // 20% as fallback for preview

export function OptionsTicket() {
  const { market: selMarket } = useTerminal();
  const { address } = useAccount();

  const [dir, setDir]         = useState<OptionDir>("CALL");
  const [pos, setPos]         = useState<OptionPos>("BUY");
  const [strikeInput, setStrikeInput] = useState("");
  const [notionalInput, setNotionalInput] = useState("");
  const [focusedStrike, setFocusedStrike]     = useState(false);
  const [focusedNotional, setFocusedNotional] = useState(false);

  const { marketInfo, isLoading: priceLoading } = useMarketData(selMarket.id);
  const spot = marketInfo?.indexPrice ?? 0n;
  const isCall = dir === "CALL";
  const isBuy  = pos === "BUY";

  // Parse inputs
  const strikeWad    = strikeInput    ? BigInt(Math.round(parseFloat(strikeInput)    * 1e18)) : 0n;
  const notionalWad  = notionalInput  ? BigInt(Math.round(parseFloat(notionalInput)  * 1e18)) : 0n;

  // Regime check
  const regime = marketInfo?.regime ?? Regime.OPEN;
  const suspended = regime === Regime.OFF_HOURS || regime === Regime.STRESS;

  // Build legs for collateral query
  const legs: OptionLeg[] = (strikeWad > 0n && notionalWad > 0n) ? [{
    marketId:   selMarket.id,
    strike:     strikeWad,
    optionType: isCall ? OptionType.CALL : OptionType.PUT,
    side:       isBuy  ? OptionSide.LONG : OptionSide.SHORT,
    notional:   notionalWad,
  }] : [];

  const { data: collReq } = useCollateralRequired(legs);
  const requiredUsdc = (collReq as any)?.total ?? 0n;

  // Client-side Greeks preview
  const strikeFallback = strikeWad > 0n ? strikeWad : spot;
  const greeks = useClientGreeks({ spot, strike: strikeFallback, iv: DEFAULT_IV, isCall });

  // Allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACTS.usdc,
    abi:     ERC20Abi,
    functionName: "allowance",
    args:    address ? [address, CONTRACTS_V3.optionsPool] : undefined,
    query:   { enabled: !!address, refetchInterval: 5000 },
  });

  const { data: balance } = useReadContract({
    address: CONTRACTS.usdc,
    abi:     ERC20Abi,
    functionName: "balanceOf",
    args:    address ? [address] : undefined,
    query:   { enabled: !!address, refetchInterval: 10_000 },
  });

  const hasAllowance = allowance !== undefined && (allowance as bigint) >= requiredUsdc;
  const needsApproval = !!address && requiredUsdc > 0n && !hasAllowance;

  const { approve, isPending: isApproving, isConfirming: isApproveConfirming } = useApproveForOptions();
  const { mint,   isPending: isMinting,   isConfirming: isMintConfirming, isSuccess } = useMintOption();

  const isApproveBusy = isApproving || isApproveConfirming;
  const isMintBusy    = isMinting   || isMintConfirming;

  const canMint = !!address && legs.length > 0 && !isMintBusy && !needsApproval && !suspended;

  const handleMint = useCallback(() => {
    if (!canMint) return;
    mint(legs, requiredUsdc + (requiredUsdc / 100n)); // 1% slippage buffer
  }, [canMint, legs, requiredUsdc, mint]);

  const handleApprove = useCallback(() => {
    approve(parseUnits("1000000", 6));
  }, [approve]);

  // Colors
  const accent    = isCall ? "var(--long)"     : "var(--short)";
  const accentMid = isCall ? "var(--long-mid)" : "var(--short-mid)";
  const accentDim = isCall ? "var(--long-dim)" : "var(--short-dim)";

  const spotStr = spot > 0n ? formatPrice(spot) : "—";

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: "var(--panel)" }}>

      {/* Suspended banner */}
      {suspended && (
        <div
          className="mx-3 mt-2 px-3 py-2 text-center"
          style={{
            borderRadius: "var(--radius-md)",
            background: "var(--warning-dim)",
            border: "1px solid var(--warning-mid)",
            fontSize: "var(--text-2xs)",
            color: "var(--warning)",
            fontWeight: 600,
          }}
        >
          ⚠ Options suspended — {regime === Regime.STRESS ? "STRESS mode" : "Off-Hours"}. Close-only.
        </div>
      )}

      {/* Market chips */}
      <div className="flex gap-1 px-3 pt-2">
        {AVAILABLE_TERMINAL_MARKETS.map((m) => {
          const active = m.id === selMarket.id;
          return (
            <button
              key={m.id}
              className="flex items-center gap-[5px] px-[10px] py-[3px] font-semibold transition-all"
              style={{
                borderRadius: "var(--radius-md)",
                fontSize: "var(--text-xs)",
                background: active ? "var(--raised)" : "transparent",
                color: active ? "var(--t1)" : "var(--t3)",
                border: `1px solid ${active ? "var(--b3)" : "transparent"}`,
              }}
            >
              <span className="inline-block shrink-0 rounded-full" style={{ width: 6, height: 6, background: m.color }} />
              {m.pair}
            </button>
          );
        })}
      </div>

      {/* CALL / PUT toggle */}
      <div className="px-3 pt-2">
        <div className="flex overflow-hidden" style={{ borderRadius: "var(--radius-lg)", border: "1px solid var(--b2)" }}>
          {(["CALL", "PUT"] as OptionDir[]).map((d) => {
            const active = dir === d;
            const col = d === "CALL" ? "var(--long)" : "var(--short)";
            const dimCol = d === "CALL" ? "var(--long-dim)" : "var(--short-dim)";
            return (
              <button
                key={d}
                onClick={() => setDir(d)}
                aria-pressed={active}
                className="flex-1 font-bold uppercase tracking-wider transition-all"
                style={{
                  height: 34,
                  fontSize: "var(--text-sm)",
                  background: active ? col : dimCol,
                  color: active ? "#fff" : col,
                  borderRight: d === "CALL" ? "1px solid var(--b2)" : "none",
                  opacity: active ? 1 : 0.5,
                }}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>

      {/* BUY / SELL toggle */}
      <div className="flex items-center gap-1 px-3 pt-2">
        {(["BUY", "SELL"] as OptionPos[]).map((p) => {
          const active = pos === p;
          return (
            <button
              key={p}
              onClick={() => setPos(p)}
              className="flex-1 font-semibold transition-all"
              style={{
                height: 28,
                borderRadius: "var(--radius-md)",
                fontSize: "var(--text-xs)",
                background: active ? "var(--raised)" : "transparent",
                color: active ? "var(--t1)" : "var(--t3)",
                border: `1px solid ${active ? "var(--b3)" : "var(--b1)"}`,
              }}
            >
              {p === "BUY" ? "▲ Buy" : "▼ Sell / Write"}
            </button>
          );
        })}
      </div>

      {/* Strike input */}
      <div className="mx-3 mt-2">
        <div
          className="overflow-hidden transition-colors duration-100"
          style={{
            borderRadius: "var(--radius-lg)",
            border: `1px solid ${focusedStrike ? "var(--b3)" : "var(--b1)"}`,
            background: "var(--raised)",
          }}
        >
          <div className="flex items-center justify-between px-[10px] pt-[6px] pb-[2px]">
            <SectionLabel>Strike Price</SectionLabel>
            <span style={{ fontSize: "var(--text-2xs)", color: "var(--t3)" }}>
              Spot: ${spotStr}
            </span>
          </div>
          <div className="flex items-center gap-2 px-[10px] pb-2">
            <input
              type="text"
              inputMode="decimal"
              value={strikeInput}
              onChange={(e) => setStrikeInput(e.target.value)}
              onFocus={() => setFocusedStrike(true)}
              onBlur={() => setFocusedStrike(false)}
              placeholder={spotStr}
              aria-label="Strike price in USD"
              className="flex-1 bg-transparent border-none outline-none tabular"
              style={{
                fontSize: "var(--text-xl)",
                fontWeight: "var(--fw-medium)" as unknown as number,
                letterSpacing: "-0.02em",
                color: strikeInput ? "var(--t1)" : "var(--t3)",
              }}
            />
            <span className="tabular shrink-0" style={{ fontSize: "var(--text-xs)", color: "var(--t3)" }}>USD</span>
          </div>
        </div>
      </div>

      {/* Notional input */}
      <div className="mx-3 mt-2">
        <div
          className="overflow-hidden transition-colors duration-100"
          style={{
            borderRadius: "var(--radius-lg)",
            border: `1px solid ${focusedNotional ? "var(--b3)" : "var(--b1)"}`,
            background: "var(--raised)",
          }}
        >
          <div className="px-[10px] pt-[6px] pb-[2px]">
            <SectionLabel>Notional</SectionLabel>
          </div>
          <div className="flex items-center gap-2 px-[10px] pb-2">
            <input
              type="text"
              inputMode="decimal"
              value={notionalInput}
              onChange={(e) => setNotionalInput(e.target.value)}
              onFocus={() => setFocusedNotional(true)}
              onBlur={() => setFocusedNotional(false)}
              placeholder="1.00"
              aria-label="Notional in units"
              className="flex-1 bg-transparent border-none outline-none tabular"
              style={{
                fontSize: "var(--text-xl)",
                fontWeight: "var(--fw-medium)" as unknown as number,
                letterSpacing: "-0.02em",
                color: notionalInput ? "var(--t1)" : "var(--t3)",
              }}
            />
            <span className="tabular shrink-0" style={{ fontSize: "var(--text-xs)", color: "var(--t3)" }}>
              {selMarket.symbol}
            </span>
          </div>
        </div>
      </div>

      {/* Greeks preview */}
      <div
        className="mx-3 mt-2 px-3 py-2"
        style={{ borderRadius: "var(--radius-md)", background: "var(--raised)", border: "1px solid var(--b1)" }}
      >
        <div className="flex items-center justify-between mb-1">
          <SectionLabel>Greeks Preview</SectionLabel>
          <span style={{ fontSize: "var(--text-2xs)", color: "var(--t4)" }}>(20% IV est.)</span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-[3px]">
          {[
            { label: "Δ Delta", value: (Number(greeks.delta) / 1e18).toFixed(4) },
            { label: "Γ Gamma", value: (Number(greeks.gamma) / 1e18).toFixed(6) },
            { label: "Θ Theta", value: `${(Number(greeks.theta) / 1e18).toFixed(4)}/day` },
            { label: "V Vega",  value: (Number(greeks.vega)  / 1e18).toFixed(4) },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between">
              <span style={{ fontSize: "var(--text-2xs)", color: "var(--t3)" }}>{label}</span>
              <span className="tabular" style={{ fontSize: "var(--text-2xs)", color: "var(--t2)" }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Required collateral */}
      <div className="px-3 mt-2">
        <div className="flex flex-col gap-[5px]">
          <DetailRow
            label={isBuy ? "Premium (required)" : "Collateral (required)"}
            value={requiredUsdc > 0n ? `$${formatUsdc(requiredUsdc)}` : "—"}
            accent={true}
          />
          <DetailRow
            label="IV (est.)"
            value="~20%"
          />
          <DetailRow
            label="Strategy"
            value={`${isBuy ? "Long" : "Short"} ${dir}`}
          />
        </div>
      </div>

      {/* CTA */}
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
            Connect wallet to trade options
          </div>
        ) : suspended ? (
          <div
            className="text-center py-[14px]"
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--warning)",
              border: "1px solid var(--warning-mid)",
              borderRadius: "var(--radius-lg)",
              background: "var(--warning-dim)",
            }}
          >
            Options suspended — market off-hours
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
              background: "var(--gold)",
              color: "#000",
              cursor: isApproveBusy ? "not-allowed" : "pointer",
            }}
          >
            {isApproveBusy && <Spinner />}
            {isApproveBusy ? "Confirming approval…" : "Approve USDC for Options"}
          </button>
        ) : (
          <button
            onClick={handleMint}
            disabled={!canMint}
            className="w-full flex items-center justify-center gap-2 font-bold tracking-wider transition-all"
            style={{
              height: "var(--h-btn-lg)",
              borderRadius: "var(--radius-lg)",
              fontSize: "var(--text-sm)",
              background: canMint ? accent : "var(--raised)",
              color: canMint ? "#fff" : "var(--t3)",
              border: `1px solid ${canMint ? accentMid : "var(--b1)"}`,
              opacity: canMint ? 1 : 0.6,
              cursor: canMint ? "pointer" : "not-allowed",
            }}
          >
            {isMintBusy && <Spinner />}
            {isMintBusy
              ? (isMintConfirming ? "Confirming…" : "Sign in Wallet…")
              : legs.length > 0
                ? `${isBuy ? "Buy" : "Write"} ${dir} · ${selMarket.pair}`
                : "Enter strike & notional"
            }
          </button>
        )}
      </div>

      {/* Success toast */}
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
          <span style={{ fontSize: "var(--text-xs)", color: "var(--long)" }}>Option opened successfully</span>
        </div>
      )}

      {/* Footer */}
      <div className="px-3 pb-3 mt-auto pt-3">
        <Divider />
        <div className="flex items-center justify-between pt-2">
          <span style={{ fontSize: "var(--text-2xs)", color: "var(--t3)" }}>Fully collateralized · No counterparty risk</span>
          <span style={{ fontSize: "var(--text-2xs)", color: "var(--t4)" }}>Panoptic V2</span>
        </div>
      </div>
    </div>
  );
}
