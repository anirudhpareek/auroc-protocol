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
    <div
      className="rounded-xl px-4 py-3.5"
      style={{ background: "var(--raised)", border: "1px solid var(--b1)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <span style={{ fontSize: "var(--text-xs)", color: "var(--t3)" }}>{label}</span>
        <span style={{ fontSize: "var(--text-xs)", color: "var(--t3)" }}>Balance: 0.00</span>
      </div>
      <div className="flex items-center gap-2.5">
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={e => onAmountChange?.(e.target.value)}
          readOnly={readOnly}
          placeholder="0"
          className="flex-1 bg-transparent border-none outline-none font-medium tracking-tight"
          style={{
            fontSize: "var(--text-2xl)",
            color: amount ? "var(--t1)" : "var(--t3)",
            fontFamily: "var(--mono)",
            letterSpacing: "-0.03em",
          }}
        />
        <button
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg font-semibold"
          style={{
            background: "var(--hover)",
            border: "1px solid var(--b2)",
            color: "var(--t1)",
            fontSize: "var(--text-sm)",
          }}
        >
          <TokenIcon symbol={sym} size={20} variant="branded" />
          {sym}
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ color: "var(--t3)" }}>
            <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
      {!readOnly && amount && (
        <div className="mt-1.5" style={{ fontSize: "var(--text-2xs)", color: "var(--t3)" }}>
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
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      <Header />

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-[460px] flex flex-col gap-4">

          {/* Swap card */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "var(--surface)", border: "1px solid var(--b1)" }}
          >
            {/* Card header */}
            <div
              className="flex items-center justify-between px-4 py-3.5"
              style={{ borderBottom: "1px solid var(--b1)" }}
            >
              <div className="flex gap-1">
                {["Swap", "Limit", "DCA"].map((m, i) => (
                  <button
                    key={m}
                    className="px-2.5 py-1 rounded-md font-medium"
                    style={{
                      fontSize: "var(--text-xs)",
                      background: i === 0 ? "var(--raised)" : "none",
                      color: i === 0 ? "var(--t1)" : "var(--t3)",
                      border: i === 0 ? "1px solid var(--b2)" : "1px solid transparent",
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <button className="flex items-center" style={{ color: "var(--t3)" }}>
                <Settings2 size={15} />
              </button>
            </div>

            {/* Body */}
            <div className="p-3.5 flex flex-col gap-2">
              <TokenSelect label="You Pay" sym={fromSym} amount={fromAmount} onAmountChange={setFromAmount} />

              {/* Flip */}
              <div className="flex justify-center -mt-1.5 -mb-1.5 relative z-[1]">
                <button
                  onClick={() => setFlipped(p => !p)}
                  className="w-[34px] h-[34px] rounded-lg flex items-center justify-center transition-all duration-150"
                  style={{
                    background: "var(--raised)",
                    border: "1px solid var(--b2)",
                    color: "var(--t2)",
                  }}
                >
                  <ArrowUpDown size={14} />
                </button>
              </div>

              <TokenSelect label="You Receive" sym={toSym} amount={toAmount} readOnly />

              {/* Rate */}
              {fromAmount && (
                <div className="flex items-center justify-between px-0.5 py-1">
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--t3)" }}>
                    1 {fromSym} ≈ {flipped ? "0.000295" : "3,380"} {toSym}
                  </span>
                  <div className="flex items-center gap-1">
                    <Zap size={10} style={{ color: "var(--long)" }} />
                    <span style={{ fontSize: "var(--text-2xs)", color: "var(--t3)" }}>Best route · Uniswap V3</span>
                  </div>
                </div>
              )}

              {/* Route comparison */}
              {fromAmount && (
                <div
                  className="rounded-lg overflow-hidden"
                  style={{ background: "var(--bg)", border: "1px solid var(--b1)" }}
                >
                  {ROUTES.map((r, i) => (
                    <div
                      key={r.name}
                      className="flex items-center justify-between px-3 py-2"
                      style={{
                        borderBottom: i < ROUTES.length - 1 ? "1px solid var(--b1)" : "none",
                        background: i === 0 ? "var(--long-dim)" : "transparent",
                      }}
                    >
                      <div className="flex items-center gap-2">
                        {i === 0 && (
                          <div
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: "var(--long)" }}
                          />
                        )}
                        <span
                          style={{
                            fontSize: "var(--text-xs)",
                            color: i === 0 ? "var(--t1)" : "var(--t2)",
                            fontWeight: i === 0 ? 600 : 400,
                          }}
                        >
                          {r.name}
                        </span>
                        <span style={{ fontSize: "var(--text-2xs)", color: "var(--t3)" }}>{r.via}</span>
                      </div>
                      <div className="text-right">
                        <div
                          className="font-semibold"
                          style={{
                            fontSize: "var(--text-2xs)",
                            color: i === 0 ? "var(--long)" : "var(--t3)",
                          }}
                        >
                          {r.savings}
                        </div>
                        <div style={{ fontSize: "var(--text-2xs)", color: "var(--t3)" }}>Fee: {r.fee}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* CTA */}
              <button
                className="w-full py-3.5 rounded-[10px] font-bold tracking-wide transition-all duration-150"
                style={{
                  fontSize: "var(--text-sm)",
                  background: fromAmount ? "var(--long)" : "var(--raised)",
                  color: fromAmount ? "#fff" : "var(--t3)",
                  border: `1px solid ${fromAmount ? "var(--long-mid)" : "var(--b1)"}`,
                }}
              >
                {fromAmount ? "Connect Wallet to Swap" : "Enter an amount"}
              </button>
            </div>
          </div>

          {/* Info banner */}
          <div
            className="px-4 py-3.5 rounded-xl flex items-start gap-3"
            style={{ background: "var(--surface)", border: "1px solid var(--b1)" }}
          >
            <div
              className="w-[34px] h-[34px] rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "var(--blue-dim)", border: "1px solid rgba(74,144,245,0.2)" }}
            >
              <Info size={16} style={{ color: "var(--blue)" }} />
            </div>
            <div>
              <div
                className="font-semibold mb-1"
                style={{ fontSize: "var(--text-sm)", color: "var(--t1)" }}
              >
                Powered by LiFi · Arbitrum One
              </div>
              <div
                className="leading-relaxed"
                style={{ fontSize: "var(--text-xs)", color: "var(--t3)" }}
              >
                Cross-chain and same-chain swaps across Arbitrum, Ethereum, and 30+ networks.
                Routes through Uniswap V3, Camelot, Balancer and more — always the best rate.
              </div>
              <div className="flex gap-1.5 mt-2.5 flex-wrap">
                {["LiFi Routing", "Uniswap V3", "Camelot DEX", "MEV Protection", "Cross-chain"].map(tag => (
                  <span
                    key={tag}
                    className="font-semibold px-1.5 py-0.5 rounded tracking-wide"
                    style={{
                      fontSize: "var(--text-2xs)",
                      background: "var(--blue-dim)",
                      color: "var(--blue)",
                      border: "1px solid rgba(74,144,245,0.15)",
                    }}
                  >
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
