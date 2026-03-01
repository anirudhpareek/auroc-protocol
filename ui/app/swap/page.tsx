"use client";

import { useState } from "react";
import { Header } from "@/components/layout";
import { TokenIcon } from "@web3icons/react/dynamic";
import { ArrowUpDown, Settings2, Info, Zap } from "lucide-react";

// Arbitrum-native tokens
const TOKENS = [
  { sym: "ETH",  name: "Ethereum",      decimals: 18 },
  { sym: "USDC", name: "USD Coin",      decimals: 6  },
  { sym: "USDT", name: "Tether",        decimals: 6  },
  { sym: "WBTC", name: "Wrapped BTC",   decimals: 8  },
  { sym: "ARB",  name: "Arbitrum",      decimals: 18 },
  { sym: "LINK", name: "Chainlink",     decimals: 18 },
  { sym: "GMX",  name: "GMX",          decimals: 18 },
  { sym: "PENDLE", name: "Pendle",      decimals: 18 },
];

function TokenSelect({ label, sym, amount, onAmountChange, readOnly }: {
  label: string; sym: string; amount: string;
  onAmountChange?: (v: string) => void; readOnly?: boolean;
}) {
  return (
    <div style={{
      background: "var(--raised)", borderRadius: 12, padding: "14px 16px",
      border: "1px solid var(--b1)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: "var(--text-xs)", color: "var(--t3)" }}>{label}</span>
        <span style={{ fontSize: "var(--text-xs)", color: "var(--t3)" }}>Balance: 0.00</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input
          type="text" inputMode="decimal" value={amount}
          onChange={e => onAmountChange?.(e.target.value)}
          readOnly={readOnly}
          placeholder="0"
          style={{
            flex: 1, background: "none", border: "none", outline: "none",
            fontSize: "var(--text-2xl)", fontWeight: 500,
            color: amount ? "var(--t1)" : "var(--t3)",
            fontFamily: "var(--mono)", letterSpacing: "-0.03em",
          }}
        />
        <button style={{
          display: "flex", alignItems: "center", gap: 8, padding: "7px 12px",
          borderRadius: 8, background: "var(--hover)", border: "1px solid var(--b2)",
          color: "var(--t1)", fontSize: "var(--text-sm)", fontWeight: 600,
        }}>
          <TokenIcon symbol={sym} size={20} variant="branded" />
          {sym}
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ color: "var(--t3)" }}>
            <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
      {!readOnly && amount && (
        <div style={{ marginTop: 6, fontSize: "var(--text-2xs)", color: "var(--t3)" }}>
          ≈ $0.00
        </div>
      )}
    </div>
  );
}

export default function SwapPage() {
  const [fromAmount, setFromAmount] = useState("");
  const [flipped, setFlipped] = useState(false);
  const fromSym = flipped ? "USDC" : "ETH";
  const toSym   = flipped ? "ETH"  : "USDC";

  const toAmount = fromAmount && !isNaN(Number(fromAmount))
    ? (Number(fromAmount) * (flipped ? 0.000295 : 3380)).toFixed(flipped ? 6 : 2)
    : "";

  const ROUTES = [
    { name: "Uniswap V3",  savings: "Best rate",  fee: "0.05%",  via: "Direct pool" },
    { name: "LiFi",        savings: "+$0.18",      fee: "0.07%",  via: "Multi-hop" },
  ];

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      <Header />

      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px" }}>
        <div style={{ width: "100%", maxWidth: 460, display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Swap card */}
          <div style={{
            background: "var(--surface)", borderRadius: 16, border: "1px solid var(--b1)",
            overflow: "hidden",
          }}>
            {/* Card header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid var(--b1)" }}>
              <div style={{ display: "flex", gap: 4 }}>
                {["Swap", "Limit", "DCA"].map((m, i) => (
                  <button key={m} style={{
                    padding: "4px 10px", borderRadius: 6, fontSize: "var(--text-xs)", fontWeight: 500,
                    background: i === 0 ? "var(--raised)" : "none",
                    color: i === 0 ? "var(--t1)" : "var(--t3)",
                    border: i === 0 ? "1px solid var(--b2)" : "1px solid transparent",
                  }}>
                    {m}
                  </button>
                ))}
              </div>
              <button style={{ color: "var(--t3)", display: "flex", alignItems: "center" }}>
                <Settings2 size={15} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <TokenSelect label="You Pay" sym={fromSym} amount={fromAmount} onAmountChange={setFromAmount} />

              {/* Flip */}
              <div style={{ display: "flex", justifyContent: "center", marginTop: -6, marginBottom: -6, position: "relative", zIndex: 1 }}>
                <button onClick={() => setFlipped(p => !p)} style={{
                  width: 34, height: 34, borderRadius: 8, background: "var(--raised)",
                  border: "1px solid var(--b2)", display: "flex", alignItems: "center",
                  justifyContent: "center", color: "var(--t2)", transition: "all 0.15s",
                }}>
                  <ArrowUpDown size={14} />
                </button>
              </div>

              <TokenSelect label="You Receive" sym={toSym} amount={toAmount} readOnly />

              {/* Rate */}
              {fromAmount && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 2px" }}>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--t3)" }}>
                    1 {fromSym} ≈ {flipped ? "0.000295" : "3,380"} {toSym}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Zap size={10} style={{ color: "var(--long)" }} />
                    <span style={{ fontSize: "var(--text-2xs)", color: "var(--t3)" }}>Best route · Uniswap V3</span>
                  </div>
                </div>
              )}

              {/* Route comparison */}
              {fromAmount && (
                <div style={{ background: "var(--bg)", borderRadius: 8, border: "1px solid var(--b1)", overflow: "hidden" }}>
                  {ROUTES.map((r, i) => (
                    <div key={r.name} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "8px 12px",
                      borderBottom: i < ROUTES.length - 1 ? "1px solid var(--b1)" : "none",
                      background: i === 0 ? "var(--long-dim)" : "transparent",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {i === 0 && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--long)" }} />}
                        <span style={{ fontSize: "var(--text-xs)", color: i === 0 ? "var(--t1)" : "var(--t2)", fontWeight: i === 0 ? 600 : 400 }}>{r.name}</span>
                        <span style={{ fontSize: "var(--text-2xs)", color: "var(--t3)" }}>{r.via}</span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "var(--text-2xs)", color: i === 0 ? "var(--long)" : "var(--t3)", fontWeight: 600 }}>{r.savings}</div>
                        <div style={{ fontSize: "var(--text-2xs)", color: "var(--t3)" }}>Fee: {r.fee}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* CTA */}
              <button style={{
                width: "100%", padding: "13px 0", borderRadius: 10, fontSize: "var(--text-sm)", fontWeight: 700,
                background: fromAmount ? "var(--long)" : "var(--raised)",
                color: fromAmount ? "#fff" : "var(--t3)",
                border: `1px solid ${fromAmount ? "var(--long-mid)" : "var(--b1)"}`,
                transition: "all 0.15s", letterSpacing: "0.02em",
              }}>
                {fromAmount ? "Connect Wallet to Swap" : "Enter an amount"}
              </button>
            </div>
          </div>

          {/* Info banner */}
          <div style={{
            padding: "14px 16px", borderRadius: 12,
            background: "var(--surface)", border: "1px solid var(--b1)",
            display: "flex", alignItems: "flex-start", gap: 12,
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8,
              background: "var(--blue-dim)", border: "1px solid rgba(74,144,245,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Info size={16} style={{ color: "var(--blue)" }} />
            </div>
            <div>
              <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--t1)", marginBottom: 4 }}>
                Powered by LiFi · Arbitrum One
              </div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--t3)", lineHeight: 1.6 }}>
                Cross-chain and same-chain swaps across Arbitrum, Ethereum, and 30+ networks.
                Routes through Uniswap V3, Camelot, Balancer and more — always the best rate.
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                {["LiFi Routing", "Uniswap V3", "Camelot DEX", "MEV Protection", "Cross-chain"].map(tag => (
                  <span key={tag} style={{
                    fontSize: "var(--text-2xs)", fontWeight: 600, padding: "2px 7px", borderRadius: 4,
                    background: "var(--blue-dim)", color: "var(--blue)", border: "1px solid rgba(74,144,245,0.15)",
                    letterSpacing: "0.04em",
                  }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
