"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { Header } from "@/components/layout";
import { usePositions } from "@/hooks/usePositions";
import { formatPrice, formatPnl, formatUsdc } from "@/lib/format";

type SubNav = "Spot" | "Performance" | "Wallets";

const HOLDINGS = [
  { sym: "XAU",  name: "Gold Perp",    color: "#d4a017", balance: "0.00", pnl: "$0.00", pnlPct: "0.00%", up: true,  mcap: "$—",     buys: 0,  sells: 0 },
  { sym: "SPX",  name: "S&P 500 Perp", color: "#6366f1", balance: "0.00", pnl: "$0.00", pnlPct: "0.00%", up: true,  mcap: "$—",     buys: 0,  sells: 0 },
  { sym: "USDC", name: "USD Coin",     color: "#2775CA", balance: "0.00", pnl: "$0.00", pnlPct: "0.00%", up: true,  mcap: "$35.4B", buys: 0,  sells: 0 },
];

const CHART_POINTS = [40, 42, 38, 45, 50, 48, 55, 52, 60, 58, 65, 62, 70, 68, 75, 72, 78, 76, 80, 82];

function MiniChart() {
  const W = 900; const H = 120; const PAD = 8;
  const pts = CHART_POINTS;
  const min = Math.min(...pts) - 5;
  const max = Math.max(...pts) + 5;
  const toX = (i: number) => PAD + (i / (pts.length - 1)) * (W - PAD * 2);
  const toY = (v: number) => PAD + ((max - v) / (max - min)) * (H - PAD * 2);

  const pathD = pts.map((v, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ");
  const areaD = `${pathD} L${toX(pts.length - 1).toFixed(1)},${H} L${toX(0).toFixed(1)},${H} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
      <defs>
        <linearGradient id="chart-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--long)" stopOpacity="0.15"/>
          <stop offset="100%" stopColor="var(--long)" stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#chart-grad)"/>
      <path d={pathD} stroke="var(--long)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function TH({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th style={{
      padding: "8px 12px", fontSize: 10, fontWeight: 500, color: "var(--t3)",
      textAlign: right ? "right" : "left", textTransform: "uppercase", letterSpacing: "0.04em",
      borderBottom: "1px solid var(--b1)", whiteSpace: "nowrap",
    }}>
      {children}
    </th>
  );
}

function TR({ h }: { h: typeof HOLDINGS[0] }) {
  const [hov, setHov] = useState(false);
  return (
    <tr onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: hov ? "var(--hover)" : "transparent", transition: "background 0.1s", cursor: "pointer" }}>
      <td style={{ padding: "10px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: h.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#000" }}>{h.sym.slice(0, 2)}</span>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)" }}>{h.sym}</div>
            <div style={{ fontSize: 10, color: "var(--t3)" }}>{h.name}</div>
          </div>
        </div>
      </td>
      <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--t2)", fontFamily: "JetBrains Mono, monospace", textAlign: "right" }}>
        {h.balance}
      </td>
      <td style={{ padding: "10px 12px", textAlign: "right" }}>
        <div style={{ fontSize: 12, color: h.up ? "var(--long)" : "var(--short)", fontFamily: "JetBrains Mono, monospace" }}>{h.pnl}</div>
        <div style={{ fontSize: 10, color: h.up ? "var(--long)" : "var(--short)" }}>{h.pnlPct}</div>
      </td>
      <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--t3)", fontFamily: "JetBrains Mono, monospace", textAlign: "right" }}>—</td>
      <td style={{ padding: "10px 12px", textAlign: "right" }}>
        <span style={{ fontSize: 10, color: "var(--t3)" }}>{h.buys}/{h.sells}</span>
      </td>
      <td style={{ padding: "10px 12px", fontSize: 11, color: "var(--t3)", textAlign: "right" }}>{h.mcap}</td>
      <td style={{ padding: "10px 12px", fontSize: 11, color: "var(--t3)", textAlign: "right" }}>1</td>
    </tr>
  );
}

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();
  const [subNav, setSubNav] = useState<SubNav>("Spot");
  const { positions } = usePositions();
  const [range, setRange] = useState("1W");

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      <Header />

      <main style={{ flex: 1, maxWidth: 1100, margin: "0 auto", width: "100%", padding: "24px 16px" }}>

        {!isConnected ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400, gap: 12 }}>
            <span style={{ fontSize: 36, opacity: 0.1 }}>◇</span>
            <p style={{ fontSize: 13, color: "var(--t3)" }}>Connect your wallet to view your portfolio</p>
          </div>
        ) : (
          <>
            {/* ── Portfolio value ── */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 4 }}>Total Portfolio Value</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                <span style={{ fontSize: 32, fontWeight: 700, color: "var(--t1)", fontFamily: "JetBrains Mono, monospace" }}>$0.00</span>
                <span style={{ fontSize: 13, color: "var(--t3)" }}>+$0.00 (0.00%) today</span>
              </div>
              {address && (
                <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 4 }}>
                  {address.slice(0, 6)}…{address.slice(-4)}
                </div>
              )}
            </div>

            {/* ── Chart ── */}
            <div style={{
              background: "var(--surface)", border: "1px solid var(--b1)", borderRadius: 12,
              overflow: "hidden", marginBottom: 20,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--b1)" }}>
                <div style={{ display: "flex", gap: 4 }}>
                  {["1D", "1W", "1M", "3M", "1Y", "All"].map(r => (
                    <button key={r} onClick={() => setRange(r)}
                      style={{
                        padding: "3px 8px", borderRadius: 5, fontSize: 11, fontWeight: 500,
                        background: range === r ? "var(--raised)" : "none",
                        color: range === r ? "var(--t1)" : "var(--t3)",
                        border: `1px solid ${range === r ? "var(--b2)" : "transparent"}`,
                      }}>
                      {r}
                    </button>
                  ))}
                </div>
                <span style={{ fontSize: 11, color: "var(--t3)" }}>PnL this {range}</span>
              </div>
              <div style={{ height: 180, padding: "8px 0 0" }}>
                <MiniChart />
              </div>
            </div>

            {/* ── Sub-nav ── */}
            <div style={{ display: "flex", alignItems: "center", gap: 2, marginBottom: 16, borderBottom: "1px solid var(--b1)", paddingBottom: 0 }}>
              {(["Spot", "Performance", "Wallets"] as SubNav[]).map(nav => {
                const active = subNav === nav;
                return (
                  <button key={nav} onClick={() => setSubNav(nav)}
                    style={{
                      padding: "8px 16px", fontSize: 12, fontWeight: active ? 600 : 400,
                      color: active ? "var(--t1)" : "var(--t3)",
                      borderBottom: active ? "2px solid var(--t1)" : "2px solid transparent",
                      marginBottom: -1, background: "none", transition: "all 0.1s",
                    }}>
                    {nav}
                  </button>
                );
              })}
            </div>

            {/* ── Holdings table ── */}
            {subNav === "Spot" && (
              <div style={{ background: "var(--surface)", border: "1px solid var(--b1)", borderRadius: 12, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <TH>Token</TH>
                      <TH right>Balance</TH>
                      <TH right>PNL</TH>
                      <TH right>Invested / Sold</TH>
                      <TH right>Buys / Sells</TH>
                      <TH right>MCap</TH>
                      <TH right>Wallets</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {HOLDINGS.map(h => <TR key={h.sym} h={h} />)}
                    {positions.length > 0 && positions.map(p => (
                      <tr key={p.id} style={{ borderTop: "1px solid var(--b1)" }}>
                        <td style={{ padding: "10px 12px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 30, height: 30, borderRadius: 6, background: "var(--raised)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--b2)" }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: p.isLong ? "var(--long)" : "var(--short)" }}>{p.isLong ? "L" : "S"}</span>
                            </div>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)" }}>Perp Position</div>
                              <div style={{ fontSize: 10, color: p.isLong ? "var(--long)" : "var(--short)" }}>{p.isLong ? "LONG" : "SHORT"}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--t2)", fontFamily: "JetBrains Mono, monospace", textAlign: "right" }}>
                          ${formatUsdc(p.size < 0n ? -p.size : p.size)}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right" }}>
                          {(() => { const { str, isPositive } = formatPnl(p.unrealizedPnL); return <span style={{ fontSize: 12, color: isPositive ? "var(--long)" : "var(--short)", fontFamily: "JetBrains Mono, monospace" }}>{str}</span>; })()}
                        </td>
                        <td colSpan={4} style={{ padding: "10px 12px", fontSize: 11, color: "var(--t3)", textAlign: "right" }}>—</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {subNav === "Performance" && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 0", gap: 8 }}>
                <span style={{ fontSize: 32, opacity: 0.1 }}>◉</span>
                <span style={{ fontSize: 12, color: "var(--t3)" }}>Performance analytics coming soon</span>
              </div>
            )}

            {subNav === "Wallets" && (
              <div style={{ background: "var(--surface)", border: "1px solid var(--b1)", borderRadius: 12, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)" }}>Connected Wallet</span>
                  <span style={{ fontSize: 10, color: "var(--t3)" }}>Arbitrum Sepolia</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--raised)", borderRadius: 8, border: "1px solid var(--b1)" }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--blue-dim)", border: "1px solid rgba(59,130,246,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 14 }}>👛</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)", fontFamily: "JetBrains Mono, monospace" }}>
                      {address?.slice(0, 8)}…{address?.slice(-6)}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--t3)" }}>1 wallet tracked</div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
