"use client";

import { useState, useCallback } from "react";
import { parseUnits } from "viem";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { CONTRACTS, MARKETS, PerpEngineAbi, ERC20Abi } from "@/lib/contracts";
import { useMarketData } from "@/hooks/useMarketData";
import { formatPrice } from "@/lib/format";

type Direction = "long" | "short";
type OrderType = "Market" | "Limit";

const AVAILABLE_MARKETS = [
  { id: MARKETS.XAU_USD, symbol: "XAU", pair: "XAU/USD", color: "#d4a017" },
  { id: MARKETS.SPX_USD, symbol: "SPX", pair: "SPX/USD", color: "#6366f1" },
] as const;

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const ROW: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between" };
const LABEL: React.CSSProperties = { fontSize: 11, color: "var(--t3)" };
const VALUE: React.CSSProperties = { fontSize: 11, color: "var(--t2)", fontFamily: "JetBrains Mono, monospace" };

function DetailRow({ label, value, pencil }: { label: string; value: string; pencil?: boolean }) {
  return (
    <div style={ROW}>
      <span style={LABEL}>{label}</span>
      <span style={{ ...VALUE, display: "flex", alignItems: "center", gap: 3 }}>
        {pencil && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.5 }}>
            <path d="M1 9L6.5 3.5C7.1 2.9 7.9 2.9 8.2 3.2C8.5 3.5 8.4 4.3 7.8 4.8L2.2 9.5L1 9Z" stroke="currentColor" strokeWidth="0.8"/>
          </svg>
        )}
        {value}
      </span>
    </div>
  );
}

export function OrderPanel() {
  const { address } = useAccount();
  const [selMarket, setSelMarket] = useState(AVAILABLE_MARKETS[0]);
  const [direction, setDirection] = useState<Direction>("long");
  const [orderType, setOrderType] = useState<OrderType>("Market");
  const [leverage, setLeverage] = useState(20);
  const [collateral, setCollateral] = useState("");
  const [tpsl, setTpsl] = useState(false);

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
  const balanceNum = rawBalance ? Number(rawBalance as bigint) / 1e6 : 0;

  const collateralNum = parseFloat(collateral.replace(/,/g, "")) || 0;
  const posSize = collateralNum * leverage;
  const fees = posSize * 0.0005;
  const markStr = marketInfo && marketInfo.markPrice > 0n ? formatPrice(marketInfo.markPrice) : "—";
  const isLong = direction === "long";
  const isBusy = isPending || isConfirming;

  const handleQuickPct = useCallback((pct: number) => {
    setCollateral(fmt((balanceNum * pct) / 100));
  }, [balanceNum]);

  const handleTrade = () => {
    if (!address || !collateralNum) return;
    const margin = parseUnits(collateralNum.toFixed(6), 6);
    const size = parseUnits(posSize.toFixed(6), 6);
    const signed = isLong ? size : -size;
    writeContract({
      address: CONTRACTS.perpEngine,
      abi: PerpEngineAbi,
      functionName: "openPosition",
      args: [selMarket.id, signed, margin],
    });
  };

  const [focused, setFocused] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--panel)", overflowY: "auto" }}>

      {/* ── Market selector ── */}
      <div style={{ display: "flex", gap: 4, padding: "10px 12px 0" }}>
        {AVAILABLE_MARKETS.map((m) => {
          const active = m.id === selMarket.id;
          return (
            <button key={m.id} onClick={() => setSelMarket(m)}
              style={{
                padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                background: active ? "var(--raised)" : "transparent",
                color: active ? "var(--t1)" : "var(--t3)",
                border: `1px solid ${active ? "var(--b2)" : "transparent"}`,
                transition: "all 0.1s",
              }}
            >
              {m.pair}
            </button>
          );
        })}
      </div>

      {/* ── Long / Short toggle ── */}
      <div style={{ display: "flex", margin: "10px 12px 0", borderRadius: 8, overflow: "hidden", border: "1px solid var(--b1)" }}>
        {(["long", "short"] as Direction[]).map((d) => {
          const active = direction === d;
          return (
            <button key={d} onClick={() => setDirection(d)}
              style={{
                flex: 1, padding: "8px 0", fontSize: 12, fontWeight: 600,
                background: active
                  ? d === "long" ? "var(--long-btn)" : "rgba(239,68,68,0.15)"
                  : "transparent",
                color: active
                  ? d === "long" ? "var(--long)" : "var(--short)"
                  : "var(--t3)",
                transition: "all 0.12s",
                letterSpacing: "0.02em",
              }}
            >
              {d === "long" ? "Long" : "Short"}
            </button>
          );
        })}
      </div>

      {/* ── Order type + Cross + Leverage row ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "8px 12px 0" }}>
        {(["Market", "Limit"] as OrderType[]).map((t) => {
          const active = orderType === t;
          return (
            <button key={t} onClick={() => setOrderType(t)}
              style={{
                padding: "3px 8px", borderRadius: 5, fontSize: 11, fontWeight: 500,
                background: active ? "var(--raised)" : "transparent",
                color: active ? "var(--t1)" : "var(--t3)",
                border: `1px solid ${active ? "var(--b2)" : "transparent"}`,
              }}
            >
              {t}
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        <button style={{
          display: "flex", alignItems: "center", gap: 3, padding: "3px 8px", borderRadius: 5,
          fontSize: 11, color: "var(--t2)", border: "1px solid var(--b1)", background: "var(--raised)",
        }}>
          <span style={{ fontSize: 10 }}>⇄</span> Cross
        </button>
        <button style={{
          display: "flex", alignItems: "center", gap: 3, padding: "3px 8px", borderRadius: 5,
          fontSize: 11, fontWeight: 600, color: "var(--t1)", border: "1px solid var(--b2)", background: "var(--raised)",
        }}
          onClick={() => {
            const next = leverage === 20 ? 10 : leverage === 10 ? 5 : leverage === 5 ? 50 : 20;
            setLeverage(next);
          }}
        >
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none" style={{ opacity: 0.6 }}>
            <path d="M1 8L5 2L8.5 8" stroke="currentColor" strokeWidth="0.9" strokeLinejoin="round"/>
          </svg>
          {leverage}×
        </button>
      </div>

      {/* ── Available + Max ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px 0" }}>
        <span style={{ fontSize: 11, color: "var(--t3)" }}>
          Available{" "}
          <span style={{ color: "var(--t2)", fontFamily: "JetBrains Mono, monospace" }}>
            {address ? fmt(balanceNum) : "0.00"}
          </span>
          {" "}USDC
        </span>
        <button onClick={() => setCollateral(fmt(balanceNum))}
          style={{ fontSize: 11, fontWeight: 600, color: "var(--t2)", letterSpacing: "0.01em" }}>
          Max
        </button>
      </div>

      {/* ── Input box ── */}
      <div style={{ margin: "6px 12px 0" }}>
        <div style={{
          borderRadius: 8, border: `1px solid ${focused ? "var(--b3)" : "var(--b1)"}`,
          background: "var(--raised)", overflow: "hidden", transition: "border-color 0.1s",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px 3px" }}>
            <span style={{ fontSize: 10, color: "var(--t3)", letterSpacing: "0.02em" }}>Order Value (USDC)</span>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 14, height: 14, borderRadius: "50%", background: selMarket.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 7, fontWeight: 700, color: "#000" }}>{selMarket.symbol.slice(0, 2)}</span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--t2)" }}>{selMarket.symbol}</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px 8px" }}>
            <input
              type="text" inputMode="decimal" value={collateral}
              onChange={(e) => setCollateral(e.target.value)}
              onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
              placeholder="0"
              style={{
                background: "transparent", border: "none", outline: "none",
                fontSize: 18, fontWeight: 500, color: collateral ? "var(--t1)" : "var(--t3)",
                width: "50%", fontFamily: "JetBrains Mono, monospace",
              }}
            />
            <span style={{ fontSize: 11, color: "var(--t3)", fontFamily: "JetBrains Mono, monospace" }}>
              ⬡ {collateralNum > 0 && markStr !== "—" ? fmt(collateralNum / parseFloat(markStr.replace(/,/g, ""))) : "0"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Slider ── */}
      <div style={{ padding: "10px 12px 0" }}>
        <div style={{ position: "relative", height: 16, display: "flex", alignItems: "center" }}>
          <div style={{ position: "absolute", width: "100%", height: 2, background: "var(--b2)", borderRadius: 1 }}>
            <div style={{ height: "100%", width: `${Math.min((collateralNum / Math.max(balanceNum, 0.01)) * 100, 100)}%`, background: isLong ? "var(--long)" : "var(--short)", borderRadius: 1, transition: "width 0.15s" }} />
          </div>
          <input type="range" min={0} max={balanceNum || 100} step={0.01} value={collateralNum}
            onChange={(e) => setCollateral(fmt(Number(e.target.value)))}
            style={{ position: "absolute", width: "100%", opacity: 0, cursor: "pointer", height: 16, zIndex: 2 }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
          {[0, 25, 50, 75, 100].map((p) => {
            const isActive = balanceNum > 0 && Math.round((collateralNum / balanceNum) * 100) >= p;
            return (
              <button key={p} onClick={() => handleQuickPct(p)}
                style={{ fontSize: 10, fontWeight: 500, color: isActive ? (isLong ? "var(--long)" : "var(--short)") : "var(--t3)", background: "none", border: "none", cursor: "pointer" }}>
                {p}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── TP / SL toggle ── */}
      <div style={{ padding: "10px 12px 0" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }}>
          <div onClick={() => setTpsl(p => !p)} style={{
            width: 14, height: 14, borderRadius: 3, border: `1px solid ${tpsl ? (isLong ? "var(--long)" : "var(--short)") : "var(--b3)"}`,
            background: tpsl ? (isLong ? "var(--long-btn)" : "rgba(239,68,68,0.15)") : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            {tpsl && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke={isLong ? "var(--long)" : "var(--short)"} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </div>
          <span style={{ fontSize: 11, color: "var(--t2)" }}>Take Profit / Stop Loss</span>
        </label>
      </div>

      {/* ── Action button ── */}
      <div style={{ padding: "12px 12px 0" }}>
        {!address ? (
          <div style={{ textAlign: "center", fontSize: 11, color: "var(--t3)", padding: "12px 0" }}>
            Connect wallet to trade
          </div>
        ) : (
          <button onClick={handleTrade} disabled={isBusy || !collateralNum}
            style={{
              width: "100%", padding: "10px 0", borderRadius: 8, fontSize: 13, fontWeight: 600,
              letterSpacing: "0.02em", cursor: collateralNum && !isBusy ? "pointer" : "not-allowed",
              background: isLong ? "var(--long-btn)" : "rgba(239,68,68,0.15)",
              color: isLong ? "var(--long)" : "var(--short)",
              border: `1px solid ${isLong ? "var(--long-mid)" : "var(--short-mid)"}`,
              transition: "all 0.12s", opacity: collateralNum && !isBusy ? 1 : 0.5,
            }}
            onMouseEnter={e => { if (collateralNum && !isBusy) (e.currentTarget as HTMLElement).style.background = isLong ? "var(--long-hover)" : "rgba(239,68,68,0.22)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isLong ? "var(--long-btn)" : "rgba(239,68,68,0.15)"; }}
          >
            {isBusy ? (isConfirming ? "Confirming…" : "Sign in Wallet…") : `${isLong ? "Long" : "Short"} ${selMarket.pair}`}
          </button>
        )}
      </div>

      {isSuccess && (
        <div style={{ margin: "8px 12px 0", padding: "8px 10px", borderRadius: 7, background: "var(--long-dim)", border: "1px solid var(--long-mid)" }}>
          <span style={{ fontSize: 11, color: "var(--long)" }}>✓ Position opened successfully</span>
        </div>
      )}

      {/* ── Separator ── */}
      <div style={{ height: 1, background: "var(--b1)", margin: "12px 0 0" }} />

      {/* ── Trade details ── */}
      <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
        <DetailRow label="Liquidation Price" value="—" />
        <DetailRow label="Order Value" value={collateralNum > 0 ? `$${fmt(posSize)}` : "$0.00"} />
        <DetailRow label="Margin Required" value={collateralNum > 0 ? `$${fmt(collateralNum)}` : "$0.00"} />
        <DetailRow label="Slippage Tolerance" value="10.0%" pencil />
        <DetailRow
          label="Auroc Fees"
          value={fees > 0 ? `$${fees.toFixed(4)} / $${(fees * 1.2).toFixed(4)}` : "$0.00 / $0.00"}
        />
      </div>

      <div style={{ padding: "0 12px 10px" }}>
        <span style={{ fontSize: 10, color: "var(--t3)" }}>Auroc takes 0% fees on all trades</span>
      </div>

      {/* ── Separator ── */}
      <div style={{ height: 1, background: "var(--b1)" }} />

      {/* ── USDC balance row ── */}
      <div style={{ padding: "10px 12px" }}>
        <div style={ROW}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 14, height: 14, borderRadius: "50%", background: "var(--blue)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 7, fontWeight: 700, color: "#fff" }}>$</span>
            </div>
            <span style={{ fontSize: 12, color: "var(--t1)", fontFamily: "JetBrains Mono, monospace" }}>
              {address ? fmt(balanceNum) : "0.00"}
            </span>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ color: "var(--t3)", cursor: "pointer" }}>
              <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="0.9"/>
              <path d="M5.5 5V8" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
              <circle cx="5.5" cy="3.5" r="0.5" fill="currentColor"/>
            </svg>
          </div>
          <button style={{
            padding: "3px 10px", borderRadius: 5, fontSize: 11, fontWeight: 600,
            color: "var(--t1)", border: "1px solid var(--b2)", background: "var(--raised)",
            display: "flex", alignItems: "center", gap: 4,
          }}>
            Transfer <span style={{ fontSize: 10 }}>›</span>
          </button>
        </div>
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 7 }}>
          <DetailRow label="Maintenance Margin" value="—" />
          <DetailRow label="Cross Account Leverage" value="—" />
        </div>
      </div>

      {/* ── Mark price footer ── */}
      <div style={{ padding: "0 12px 12px", marginTop: "auto" }}>
        <div style={{ height: 1, background: "var(--b1)", marginBottom: 8 }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 10, color: "var(--t3)" }}>Mark · ${markStr}</span>
          <span style={{ fontSize: 10, color: "var(--t3)" }}>Arbitrum Sepolia</span>
        </div>
      </div>

    </div>
  );
}
