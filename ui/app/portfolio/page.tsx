"use client";

import { useAccount } from "wagmi";
import { useState } from "react";
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
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-full">
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
    <th
      className={`px-3 py-2 text-[10px] font-medium uppercase tracking-wide whitespace-nowrap ${
        right ? "text-right" : "text-left"
      }`}
      style={{ color: "var(--t3)", borderBottom: "1px solid var(--b1)" }}
    >
      {children}
    </th>
  );
}

function TR({ h }: { h: typeof HOLDINGS[0] }) {
  return (
    <tr className="tr-hover">
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <div
            className="w-[30px] h-[30px] rounded-full flex items-center justify-center shrink-0"
            style={{ background: h.color }}
          >
            <span className="text-[11px] font-bold text-black">{h.sym.slice(0, 2)}</span>
          </div>
          <div>
            <div className="text-xs font-semibold" style={{ color: "var(--t1)" }}>{h.sym}</div>
            <div className="text-[10px]" style={{ color: "var(--t3)" }}>{h.name}</div>
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5 text-xs tabular text-right" style={{ color: "var(--t2)" }}>
        {h.balance}
      </td>
      <td className="px-3 py-2.5 text-right">
        <div
          className="text-xs tabular"
          style={{ color: h.up ? "var(--long)" : "var(--short)" }}
        >
          {h.pnl}
        </div>
        <div
          className="text-[10px]"
          style={{ color: h.up ? "var(--long)" : "var(--short)" }}
        >
          {h.pnlPct}
        </div>
      </td>
      <td className="px-3 py-2.5 text-xs tabular text-right" style={{ color: "var(--t3)" }}>—</td>
      <td className="px-3 py-2.5 text-right">
        <span className="text-[10px]" style={{ color: "var(--t3)" }}>{h.buys}/{h.sells}</span>
      </td>
      <td className="px-3 py-2.5 text-[11px] text-right" style={{ color: "var(--t3)" }}>{h.mcap}</td>
      <td className="px-3 py-2.5 text-[11px] text-right" style={{ color: "var(--t3)" }}>1</td>
    </tr>
  );
}

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();
  const [subNav, setSubNav] = useState<SubNav>("Spot");
  const { positions } = usePositions();
  const [range, setRange] = useState("1W");

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      <Header />

      <main className="flex-1 max-w-[1100px] mx-auto w-full px-4 py-6">

        {!isConnected ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
            <span className="text-4xl opacity-10">◇</span>
            <p className="text-[13px]" style={{ color: "var(--t3)" }}>Connect your wallet to view your portfolio</p>
          </div>
        ) : (
          <>
            {/* ── Portfolio value ── */}
            <div className="mb-6">
              <div className="text-[11px] mb-1" style={{ color: "var(--t3)" }}>Total Portfolio Value</div>
              <div className="flex items-baseline gap-3">
                <span className="text-[32px] font-bold tabular" style={{ color: "var(--t1)" }}>$0.00</span>
                <span className="text-[13px]" style={{ color: "var(--t3)" }}>+$0.00 (0.00%) today</span>
              </div>
              {address && (
                <div className="text-[11px] mt-1" style={{ color: "var(--t3)" }}>
                  {address.slice(0, 6)}…{address.slice(-4)}
                </div>
              )}
            </div>

            {/* ── Chart ── */}
            <div
              className="rounded-xl overflow-hidden mb-5"
              style={{ background: "var(--surface)", border: "1px solid var(--b1)" }}
            >
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: "1px solid var(--b1)" }}
              >
                <div className="flex gap-1">
                  {["1D", "1W", "1M", "3M", "1Y", "All"].map(r => (
                    <button
                      key={r}
                      onClick={() => setRange(r)}
                      className="px-2 py-0.5 rounded-[5px] text-[11px] font-medium"
                      style={{
                        background: range === r ? "var(--raised)" : "none",
                        color: range === r ? "var(--t1)" : "var(--t3)",
                        border: `1px solid ${range === r ? "var(--b2)" : "transparent"}`,
                      }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <span className="text-[11px]" style={{ color: "var(--t3)" }}>PnL this {range}</span>
              </div>
              <div className="h-[180px] pt-2">
                <MiniChart />
              </div>
            </div>

            {/* ── Sub-nav ── */}
            <div
              className="flex items-center gap-0.5 mb-4 pb-0"
              style={{ borderBottom: "1px solid var(--b1)" }}
            >
              {(["Spot", "Performance", "Wallets"] as SubNav[]).map(nav => {
                const active = subNav === nav;
                return (
                  <button
                    key={nav}
                    onClick={() => setSubNav(nav)}
                    className="px-4 py-2 text-xs -mb-px transition-all duration-100"
                    style={{
                      fontWeight: active ? 600 : 400,
                      color: active ? "var(--t1)" : "var(--t3)",
                      borderBottom: active ? "2px solid var(--t1)" : "2px solid transparent",
                    }}
                  >
                    {nav}
                  </button>
                );
              })}
            </div>

            {/* ── Holdings table ── */}
            {subNav === "Spot" && (
              <div
                className="rounded-xl overflow-hidden"
                style={{ background: "var(--surface)", border: "1px solid var(--b1)" }}
              >
                <table className="w-full border-collapse">
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
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-[30px] h-[30px] rounded-md flex items-center justify-center"
                              style={{ background: "var(--raised)", border: "1px solid var(--b2)" }}
                            >
                              <span
                                className="text-[10px] font-bold"
                                style={{ color: p.isLong ? "var(--long)" : "var(--short)" }}
                              >
                                {p.isLong ? "L" : "S"}
                              </span>
                            </div>
                            <div>
                              <div className="text-xs font-semibold" style={{ color: "var(--t1)" }}>Perp Position</div>
                              <div
                                className="text-[10px]"
                                style={{ color: p.isLong ? "var(--long)" : "var(--short)" }}
                              >
                                {p.isLong ? "LONG" : "SHORT"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-xs tabular text-right" style={{ color: "var(--t2)" }}>
                          ${formatUsdc(p.size < 0n ? -p.size : p.size)}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {(() => { const { str, isPositive } = formatPnl(p.unrealizedPnL); return <span className="text-xs tabular" style={{ color: isPositive ? "var(--long)" : "var(--short)" }}>{str}</span>; })()}
                        </td>
                        <td colSpan={4} className="px-3 py-2.5 text-[11px] text-right" style={{ color: "var(--t3)" }}>—</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {subNav === "Performance" && (
              <div className="flex flex-col items-center py-15 gap-2">
                <span className="text-[32px] opacity-10">◉</span>
                <span className="text-xs" style={{ color: "var(--t3)" }}>Performance analytics coming soon</span>
              </div>
            )}

            {subNav === "Wallets" && (
              <div
                className="rounded-xl p-4"
                style={{ background: "var(--surface)", border: "1px solid var(--b1)" }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold" style={{ color: "var(--t1)" }}>Connected Wallet</span>
                  <span className="text-[10px]" style={{ color: "var(--t3)" }}>Arbitrum Sepolia</span>
                </div>
                <div
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg"
                  style={{ background: "var(--raised)", border: "1px solid var(--b1)" }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: "var(--blue-dim)", border: "1px solid rgba(59,130,246,0.2)" }}
                  >
                    <span className="text-sm">👛</span>
                  </div>
                  <div>
                    <div className="text-xs font-semibold tabular" style={{ color: "var(--t1)" }}>
                      {address?.slice(0, 8)}…{address?.slice(-6)}
                    </div>
                    <div className="text-[10px]" style={{ color: "var(--t3)" }}>1 wallet tracked</div>
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
