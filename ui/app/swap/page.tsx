"use client";

import { useState } from "react";
import { Header } from "@/components/layout";

const TOKENS = [
  { sym: "SOL",  name: "Solana",       color: "#9945FF", logo: "◎" },
  { sym: "USDC", name: "USD Coin",     color: "#2775CA", logo: "$" },
  { sym: "ETH",  name: "Ethereum",     color: "#627EEA", logo: "Ξ" },
  { sym: "BTC",  name: "Bitcoin",      color: "#F7931A", logo: "₿" },
  { sym: "JUP",  name: "Jupiter",      color: "#C7F284", logo: "J" },
  { sym: "BONK", name: "Bonk",         color: "#F5841F", logo: "🐶" },
  { sym: "WIF",  name: "dogwifhat",    color: "#D97706", logo: "🐕" },
];

function TokenIcon({ sym, color, logo, size = 28 }: { sym: string; color: string; logo: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: color,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      <span style={{ fontSize: size * 0.45, lineHeight: 1, color: "#000", fontWeight: 700 }}>{logo}</span>
    </div>
  );
}

function TokenSelect({ label, token, amount, onAmountChange, readOnly }: {
  label: string; token: typeof TOKENS[0]; amount: string;
  onAmountChange?: (v: string) => void; readOnly?: boolean;
}) {
  return (
    <div style={{
      background: "var(--raised)", borderRadius: 12, padding: "12px 14px",
      border: "1px solid var(--b1)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: "var(--t3)" }}>{label}</span>
        <span style={{ fontSize: 10, color: "var(--t3)" }}>Balance: 0.00</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input
          type="text" inputMode="decimal" value={amount}
          onChange={e => onAmountChange?.(e.target.value)}
          readOnly={readOnly}
          placeholder="0"
          style={{
            flex: 1, background: "none", border: "none", outline: "none",
            fontSize: 22, fontWeight: 500, color: amount && !readOnly ? "var(--t1)" : "var(--t3)",
            fontFamily: "JetBrains Mono, monospace",
          }}
        />
        <button style={{
          display: "flex", alignItems: "center", gap: 7, padding: "6px 10px",
          borderRadius: 8, background: "var(--hover)", border: "1px solid var(--b2)",
          color: "var(--t1)", fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}>
          <TokenIcon sym={token.sym} color={token.color} logo={token.logo} size={20} />
          {token.sym}
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ color: "var(--t3)" }}>
            <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
      {!readOnly && amount && (
        <div style={{ marginTop: 4, fontSize: 10, color: "var(--t3)" }}>
          ≈ $0.00
        </div>
      )}
    </div>
  );
}

/* Floating token BG blobs */
function FloatBlobs() {
  const blobs = [
    { x: "8%",  y: "15%", size: 48, token: TOKENS[0] },
    { x: "85%", y: "10%", size: 36, token: TOKENS[2] },
    { x: "5%",  y: "65%", size: 40, token: TOKENS[3] },
    { x: "90%", y: "55%", size: 44, token: TOKENS[1] },
    { x: "15%", y: "80%", size: 32, token: TOKENS[4] },
    { x: "80%", y: "80%", size: 38, token: TOKENS[5] },
    { x: "50%", y: "5%",  size: 30, token: TOKENS[6] },
    { x: "45%", y: "90%", size: 34, token: TOKENS[0] },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {blobs.map((b, i) => (
        <div key={i} style={{
          position: "absolute", left: b.x, top: b.y,
          width: b.size, height: b.size, borderRadius: "50%",
          background: b.token.color,
          opacity: 0.07, filter: "blur(12px)",
          transform: "translate(-50%,-50%)",
        }} />
      ))}
    </div>
  );
}

export default function SwapPage() {
  const [fromAmount, setFromAmount] = useState("");
  const [flipped, setFlipped] = useState(false);
  const fromTok = flipped ? TOKENS[1] : TOKENS[0];  // USDC or SOL
  const toTok   = flipped ? TOKENS[0] : TOKENS[1];

  const toAmount = fromAmount && !isNaN(Number(fromAmount))
    ? (Number(fromAmount) * (flipped ? 150.4 : 0.00665)).toFixed(4)
    : "";

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)", position: "relative" }}>
      <Header />
      <FloatBlobs />

      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px", position: "relative", zIndex: 1 }}>
        <div style={{ width: "100%", maxWidth: 440 }}>

          {/* ── Swap card ── */}
          <div style={{
            background: "var(--surface)", borderRadius: 16, border: "1px solid var(--b1)",
            overflow: "hidden", boxShadow: "0 0 60px rgba(0,0,0,0.5)",
          }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid var(--b1)" }}>
              <div style={{ display: "flex", gap: 6 }}>
                {["Swap", "Limit", "DCA"].map((m, i) => (
                  <button key={m} style={{
                    padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 500,
                    background: i === 0 ? "var(--raised)" : "none",
                    color: i === 0 ? "var(--t1)" : "var(--t3)",
                    border: i === 0 ? "1px solid var(--b2)" : "1px solid transparent",
                  }}>
                    {m}
                  </button>
                ))}
              </div>
              <button style={{ color: "var(--t3)", display: "flex", alignItems: "center" }}>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <circle cx="7.5" cy="7.5" r="6.5" stroke="currentColor" strokeWidth="1"/>
                  <path d="M5 7.5H10M8 5.5L10 7.5L8 9.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <TokenSelect label="You Swap" token={fromTok} amount={fromAmount} onAmountChange={setFromAmount} />

              {/* Flip button */}
              <div style={{ display: "flex", justifyContent: "center", marginTop: -6, marginBottom: -6, position: "relative", zIndex: 1 }}>
                <button onClick={() => setFlipped(p => !p)}
                  style={{
                    width: 32, height: 32, borderRadius: 8, background: "var(--raised)",
                    border: "1px solid var(--b2)", display: "flex", alignItems: "center",
                    justifyContent: "center", color: "var(--t2)", transition: "all 0.15s",
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--hover)"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "var(--raised)"}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M5 2L5 12M2 9L5 12L8 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M9 12L9 2M12 5L9 2L6 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>

              <TokenSelect label="You Receive" token={toTok} amount={toAmount} readOnly />

              {/* Rate info */}
              {fromAmount && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 2px" }}>
                  <span style={{ fontSize: 11, color: "var(--t3)" }}>
                    1 {fromTok.sym} ≈ {flipped ? "150.40" : "0.00665"} {toTok.sym}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--long)" }} />
                    <span style={{ fontSize: 10, color: "var(--t3)" }}>Best route via Jupiter</span>
                  </div>
                </div>
              )}

              {/* Swap button */}
              <button style={{
                width: "100%", padding: "13px 0", borderRadius: 10, fontSize: 14, fontWeight: 700,
                background: fromAmount ? "var(--long-btn)" : "var(--raised)",
                color: fromAmount ? "var(--long)" : "var(--t3)",
                border: `1px solid ${fromAmount ? "var(--long-mid)" : "var(--b1)"}`,
                transition: "all 0.15s", letterSpacing: "0.02em",
              }}
                onMouseEnter={e => { if (fromAmount) (e.currentTarget as HTMLElement).style.background = "var(--long-hover)"; }}
                onMouseLeave={e => { if (fromAmount) (e.currentTarget as HTMLElement).style.background = "var(--long-btn)"; }}
              >
                {fromAmount ? "Swap" : "Enter an amount"}
              </button>
            </div>
          </div>

          {/* ── Coming soon banner ── */}
          <div style={{
            marginTop: 20, padding: "14px 16px", borderRadius: 12,
            background: "var(--surface)", border: "1px solid var(--b1)",
            display: "flex", alignItems: "flex-start", gap: 12,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8, background: "var(--gold-dim)",
              border: "1px solid rgba(244,197,61,0.2)", display: "flex", alignItems: "center",
              justifyContent: "center", flexShrink: 0,
            }}>
              <span style={{ fontSize: 18 }}>🗺️</span>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)", marginBottom: 4 }}>
                Roadmap — Live Swap via Jupiter &amp; Helius
              </div>
              <div style={{ fontSize: 11, color: "var(--t3)", lineHeight: 1.6 }}>
                Full on-chain spot swaps with Jupiter aggregator and Helius RPC are coming soon.
                This preview shows the UI. Connect wallet to trade perps now on the{" "}
                <a href="/" style={{ color: "var(--gold)", textDecoration: "none" }}>Trade page</a>.
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                {["Jupiter Integration", "Helius RPC", "Token Routing", "MEV Protection"].map(tag => (
                  <span key={tag} style={{
                    fontSize: 9, fontWeight: 600, padding: "2px 7px", borderRadius: 4,
                    background: "var(--gold-dim)", color: "var(--gold)", border: "1px solid rgba(244,197,61,0.15)",
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
