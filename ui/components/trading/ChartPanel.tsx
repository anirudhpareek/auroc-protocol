"use client";
import { useState } from "react";
import { useMarketData } from "@/hooks/useMarketData";
import { MARKETS } from "@/lib/contracts";
import { Regime } from "@/types";
import { formatPrice } from "@/lib/format";

/* ── Markets ── */
const MARKETS_CFG = [
  {
    id: MARKETS.XAU_USD, sym: "XAU", pair: "XAU/USD", name: "Gold",
    color: "#d4a017", oracleStr: "2,890.15", vol: "$287M", oi: "$124.7M",
    funding: "-0.0031%", fundingUp: false, change: "+0.45%", changeUp: true,
  },
  {
    id: MARKETS.SPX_USD, sym: "SPX", pair: "SPX/USD", name: "S&P 500",
    color: "#22c55e", oracleStr: "5,234.95", vol: "$156M", oi: "$89.4M",
    funding: "-0.0018%", fundingUp: false, change: "-0.12%", changeUp: false,
  },
] as const;
type MktCfg = (typeof MARKETS_CFG)[number];

const TIMEFRAMES = ["1m","3m","5m","15m","1H","4H","1D","1W"];

/* ── TradingView-style candlestick chart SVG ── */
const CANDLES = [
  {o:2840,c:2858,h:2865,l:2832},{o:2858,c:2850,h:2868,l:2845},
  {o:2850,c:2871,h:2878,l:2848},{o:2871,c:2864,h:2880,l:2860},
  {o:2864,c:2882,h:2890,l:2862},{o:2882,c:2875,h:2888,l:2870},
  {o:2875,c:2893,h:2900,l:2873},{o:2893,c:2886,h:2898,l:2882},
  {o:2886,c:2904,h:2912,l:2884},{o:2904,c:2896,h:2910,l:2892},
  {o:2896,c:2915,h:2922,l:2894},{o:2915,c:2908,h:2920,l:2905},
  {o:2908,c:2926,h:2934,l:2906},{o:2926,c:2919,h:2930,l:2915},
  {o:2919,c:2938,h:2945,l:2917},{o:2938,c:2930,h:2942,l:2926},
  {o:2930,c:2948,h:2955,l:2928},{o:2948,c:2940,h:2952,l:2936},
  {o:2940,c:2958,h:2965,l:2938},{o:2958,c:2950,h:2962,l:2946},
  {o:2950,c:2968,h:2975,l:2948},{o:2968,c:2960,h:2972,l:2956},
  {o:2960,c:2878,h:2965,l:2862},{o:2878,c:2894,h:2898,l:2870},
  {o:2894,c:2885,h:2900,l:2882},{o:2885,c:2892,h:2896,l:2880},
  {o:2892,c:2906,h:2912,l:2890},{o:2906,c:2892,h:2910,l:2888},
];
const VOLUMES = [1.2,0.8,1.5,0.9,1.8,1.1,2.1,1.3,1.6,0.7,2.4,1.0,1.9,0.8,2.2,1.4,1.7,0.9,2.0,1.2,2.3,1.1,3.1,1.8,1.4,1.0,1.6,1.3];

function ChartSVG() {
  const W = 900, H = 280, PAD = { t: 8, r: 68, b: 24, l: 4 };
  const VOL_H = 40;
  const cW = W - PAD.l - PAD.r;
  const cH = H - PAD.t - PAD.b - VOL_H;
  const n = CANDLES.length;
  const barW = cW / n;
  const bodyW = barW * 0.55;

  const prices = CANDLES.flatMap(c => [c.h, c.l]);
  const minP = Math.min(...prices) - 6;
  const maxP = Math.max(...prices) + 6;
  const pRange = maxP - minP;

  const maxV = Math.max(...VOLUMES);

  const toX = (i: number) => PAD.l + (i + 0.5) * barW;
  const toY = (p: number) => PAD.t + cH - ((p - minP) / pRange) * cH;
  const toYV = (v: number) => H - PAD.b - (v / maxV) * VOL_H;

  const lastC = CANDLES[n - 1];
  const lastPrice = lastC.c;
  const lastY = toY(lastPrice);

  /* Price labels on right axis */
  const priceLabels = [0, 0.25, 0.5, 0.75, 1].map(t => minP + t * pRange);

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
      style={{ background: "#0d1117", display: "block" }}>
      <defs>
        <clipPath id="chartClip">
          <rect x={PAD.l} y={PAD.t} width={cW} height={cH + VOL_H} />
        </clipPath>
      </defs>

      {/* Grid lines */}
      {[0,0.25,0.5,0.75,1].map((t,i) => (
        <line key={i} x1={PAD.l} x2={W - PAD.r} y1={PAD.t + cH * t} y2={PAD.t + cH * t}
          stroke="rgba(42,46,57,0.8)" strokeWidth="1" />
      ))}
      {[0,0.2,0.4,0.6,0.8,1].map((t,i) => (
        <line key={i} x1={PAD.l + cW * t} x2={PAD.l + cW * t} y1={PAD.t} y2={H - PAD.b}
          stroke="rgba(42,46,57,0.5)" strokeWidth="1" />
      ))}

      <g clipPath="url(#chartClip)">
        {/* Volume bars */}
        {CANDLES.map((c, i) => {
          const up = c.c >= c.o;
          const vH = (VOLUMES[i] / maxV) * VOL_H;
          return (
            <rect key={`v${i}`}
              x={toX(i) - bodyW / 2} y={H - PAD.b - vH}
              width={bodyW} height={vH}
              fill={up ? "rgba(38,166,154,0.35)" : "rgba(239,83,80,0.35)"}
              rx="1"
            />
          );
        })}

        {/* Candles */}
        {CANDLES.map((c, i) => {
          const up = c.c >= c.o;
          const upColor = "#26a69a";
          const dnColor = "#ef5350";
          const color = up ? upColor : dnColor;
          const bTop = toY(Math.max(c.o, c.c));
          const bBot = toY(Math.min(c.o, c.c));
          const bH = Math.max(bBot - bTop, 1);
          return (
            <g key={i}>
              <line x1={toX(i)} y1={toY(c.h)} x2={toX(i)} y2={toY(c.l)}
                stroke={color} strokeWidth="1" />
              <rect x={toX(i) - bodyW / 2} y={bTop} width={bodyW} height={bH}
                fill={color} rx="0.5" />
            </g>
          );
        })}
      </g>

      {/* Current price dashed line */}
      <line x1={PAD.l} y1={lastY} x2={W - PAD.r} y2={lastY}
        stroke="#ef5350" strokeWidth="1" strokeDasharray="4 4" strokeOpacity="0.7" />

      {/* Price axis labels */}
      {priceLabels.map((p, i) => (
        <text key={i} x={W - PAD.r + 6} y={PAD.t + cH - ((p - minP) / pRange) * cH + 4}
          fill="rgba(178,181,190,0.7)" fontSize="9" fontFamily="JetBrains Mono, monospace">
          {p.toFixed(0)}
        </text>
      ))}

      {/* Current price label box */}
      <rect x={W - PAD.r + 1} y={lastY - 8} width={PAD.r - 2} height={16}
        fill="#ef5350" rx="2" />
      <text x={W - PAD.r + PAD.r / 2} y={lastY + 4} textAnchor="middle"
        fill="#fff" fontSize="9" fontWeight="600" fontFamily="JetBrains Mono, monospace">
        {lastPrice.toFixed(2)}
      </text>

      {/* Time labels */}
      {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
        const idx = Math.floor(t * (n - 1));
        const hours = 9 + Math.floor(idx * 6.5 / n);
        const mins = Math.floor((idx * 390 / n) % 60);
        return (
          <text key={i} x={PAD.l + cW * t} y={H - PAD.b + 13}
            textAnchor="middle" fill="rgba(178,181,190,0.6)" fontSize="8.5"
            fontFamily="JetBrains Mono, monospace">
            {`${hours.toString().padStart(2,"0")}:${mins.toString().padStart(2,"0")}`}
          </text>
        );
      })}

      {/* OHLC header */}
      <text x={PAD.l + 4} y={PAD.t + 14} fill="rgba(178,181,190,0.8)" fontSize="9.5" fontFamily="JetBrains Mono, monospace">
        {`O ${CANDLES[n-1].o}  H ${CANDLES[n-1].h}  L ${CANDLES[n-1].l}  C ${CANDLES[n-1].c}  ${lastC.c > lastC.o ? "+" : ""}${(lastC.c - lastC.o).toFixed(0)}`}
      </text>

      {/* Watermark */}
      <text x={W / 2} y={H / 2 + 20} textAnchor="middle"
        fill="rgba(255,255,255,0.025)" fontSize="28" fontWeight="700"
        fontFamily="Inter, sans-serif" letterSpacing="4">
        AUROC
      </text>
    </svg>
  );
}

/* ── Chart toolbar (TradingView-style) ── */
function ChartToolbar({ tf, onTf }: { tf: string; onTf: (t: string) => void }) {
  const btnS: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "0 8px", height: "100%", fontSize: 11, color: "var(--t2)",
    borderRight: "1px solid var(--b1)", cursor: "pointer", gap: 4, flexShrink: 0,
    transition: "color 0.1s",
  };
  return (
    <div style={{
      height: 34, display: "flex", alignItems: "center", background: "var(--surface)",
      borderBottom: "1px solid var(--b1)", overflow: "hidden",
    }}>
      {/* Timeframe */}
      <div style={{ ...btnS, color: "var(--t1)", fontWeight: 600, fontSize: 11 }}>{tf}
        <svg width="8" height="5" viewBox="0 0 8 5" fill="none"><path d="M1 1L4 4L7 1" stroke="var(--t3)" strokeWidth="1.2" strokeLinecap="round"/></svg>
      </div>
      {/* Cursor */}
      <div style={btnS}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2L7 10L8 7L11 6L2 2Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/></svg>
      </div>
      {/* Indicators */}
      <div style={{ ...btnS, gap: 5 }}>
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M1 8L3.5 5L6 7L9 3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span>Indicators</span>
      </div>
      {/* Layout */}
      <div style={btnS}>
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <rect x="1" y="1" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.1"/>
          <rect x="6" y="1" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.1"/>
          <rect x="1" y="6" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.1"/>
          <rect x="6" y="6" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.1"/>
        </svg>
      </div>
      {/* Nav */}
      <div style={btnS}>
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M7 2L3 5.5L7 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
      </div>
      <div style={btnS}>
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M4 2L8 5.5L4 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
      </div>

      <div style={{ flex: 1 }} />

      {/* Source */}
      <div style={{ ...btnS, color: "var(--t1)", fontWeight: 600 }}>
        Auroc
        <svg width="8" height="5" viewBox="0 0 8 5" fill="none"><path d="M1 1L4 4L7 1" stroke="var(--t3)" strokeWidth="1.2" strokeLinecap="round"/></svg>
      </div>
      {/* Settings */}
      <div style={btnS}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <circle cx="6" cy="6" r="2" stroke="currentColor" strokeWidth="1.1"/>
          <path d="M6 1V2.5M6 9.5V11M1 6H2.5M9.5 6H11M2.64 2.64L3.7 3.7M8.3 8.3L9.36 9.36M9.36 2.64L8.3 3.7M3.7 8.3L2.64 9.36" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
        </svg>
      </div>
      {/* Expand */}
      <div style={btnS}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M7.5 1.5H10.5V4.5M4.5 10.5H1.5V7.5M10.5 7.5V10.5H7.5M1.5 4.5V1.5H4.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      {/* Camera */}
      <div style={{ ...btnS, borderRight: "none" }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <rect x="1" y="3.5" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1.1"/>
          <circle cx="6" cy="7" r="2" stroke="currentColor" strokeWidth="1.1"/>
          <path d="M4 3.5L4.5 2H7.5L8 3.5" stroke="currentColor" strokeWidth="1.1"/>
        </svg>
      </div>
    </div>
  );
}

/* ── Asset info bar (Trojan-style) ── */
function AssetBar({ mkt }: { mkt: MktCfg }) {
  const { marketInfo } = useMarketData(mkt.id);
  const markStr = marketInfo && marketInfo.markPrice > 0n
    ? formatPrice(marketInfo.markPrice) : "2,892.40";

  const sep = <div style={{ width: 1, height: 24, background: "var(--b1)", flexShrink: 0 }} />;

  return (
    <div style={{
      height: 44, display: "flex", alignItems: "center", gap: 16,
      padding: "0 14px", background: "var(--surface)", borderBottom: "1px solid var(--b1)",
      flexShrink: 0, overflow: "hidden",
    }}>
      {/* Star */}
      <button style={{ color: "var(--t3)", fontSize: 16, flexShrink: 0 }}>☆</button>

      {/* Market selector */}
      <button style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
        <div style={{ width: 22, height: 22, borderRadius: "50%", background: mkt.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "#fff" }}>{mkt.sym[0]}</div>
        <span style={{ fontWeight: 700, fontSize: 14, color: "var(--t1)" }}>{mkt.sym}</span>
        <svg width="9" height="6" viewBox="0 0 9 6" fill="none"><path d="M1 1L4.5 5L8 1" stroke="var(--t2)" strokeWidth="1.3" strokeLinecap="round"/></svg>
      </button>

      {/* Price */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span className="tabular" style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.03em" }}>${markStr}</span>
        <span style={{ fontSize: 12, fontWeight: 500, color: mkt.changeUp ? "var(--long)" : "var(--short)" }}>{mkt.change}</span>
      </div>

      {sep}

      {/* Oracle */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 11, color: "var(--t3)" }}>Oracle Price</span>
        <span className="tabular" style={{ fontSize: 11, color: "var(--t2)" }}>{mkt.oracleStr}</span>
      </div>

      {sep}

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 11, color: "var(--t3)" }}>24h Volume</span>
        <span className="tabular" style={{ fontSize: 11, color: "var(--t2)" }}>{mkt.vol}</span>
      </div>

      {sep}

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 11, color: "var(--t3)" }}>Open Interest</span>
        <span className="tabular" style={{ fontSize: 11, color: "var(--t2)" }}>{mkt.oi}</span>
      </div>

      {sep}

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 11, color: "var(--t3)" }}>Funding / Countdown</span>
        <span className="tabular" style={{ fontSize: 11, color: mkt.fundingUp ? "var(--long)" : "var(--short)" }}>{mkt.funding}</span>
        <span className="tabular" style={{ fontSize: 11, color: "var(--t3)" }}>03:42:18</span>
      </div>

      <div style={{ flex: 1 }} />

      {/* Regime */}
      {marketInfo && (
        <div style={{
          padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700,
          background: marketInfo.regime === Regime.OPEN ? "rgba(34,197,94,0.1)" : "rgba(245,158,11,0.1)",
          color: marketInfo.regime === Regime.OPEN ? "var(--long)" : "var(--warning)",
          border: `1px solid ${marketInfo.regime === Regime.OPEN ? "rgba(34,197,94,0.2)" : "rgba(245,158,11,0.2)"}`,
        }}>
          {marketInfo.regime === Regime.OPEN ? "● OPEN" : "● OFF-HOURS"}
        </div>
      )}
    </div>
  );
}

export function ChartPanel() {
  const [mkt, setMkt] = useState<MktCfg>(MARKETS_CFG[0]);
  const [tf, setTf]   = useState("15m");

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#0d1117" }}>
      <AssetBar mkt={mkt} />
      <ChartToolbar tf={tf} onTf={setTf} />
      {/* Chart fills remaining space */}
      <div style={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden" }}>
        <ChartSVG />
      </div>
      {/* Timeframe bar */}
      <div style={{
        height: 28, display: "flex", alignItems: "center", background: "var(--surface)",
        borderTop: "1px solid var(--b1)", padding: "0 10px", gap: 2, flexShrink: 0,
      }}>
        {TIMEFRAMES.map((t) => (
          <button key={t} onClick={() => setTf(t)} style={{
            padding: "2px 7px", borderRadius: 4, fontSize: 11, fontWeight: 500,
            background: t === tf ? "var(--raised)" : "transparent",
            color: t === tf ? "var(--t1)" : "var(--t3)",
            border: "none", cursor: "pointer", transition: "all 0.1s",
          }}>{t}</button>
        ))}
        <div style={{ width: 1, height: 12, background: "var(--b1)", margin: "0 4px" }} />
        <button style={{ padding: "2px 6px", borderRadius: 4, fontSize: 10, color: "var(--t3)" }}>%</button>
        <button style={{ padding: "2px 6px", borderRadius: 4, fontSize: 10, color: "var(--t3)" }}>log</button>
        <button style={{ padding: "2px 6px", borderRadius: 4, fontSize: 10, color: "var(--t3)" }}>auto</button>
      </div>
    </div>
  );
}
