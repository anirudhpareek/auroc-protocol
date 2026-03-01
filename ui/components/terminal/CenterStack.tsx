"use client";

import { useState } from "react";
import { useTerminal } from "./TerminalContext";
import { MarketHeaderBar } from "./MarketHeaderBar";

const TIMEFRAMES = ["1m","3m","5m","15m","1H","4H","1D","1W"] as const;

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

const TAPE_TRADES = [
  { time:"09:41:03", isLong:true,  price:"2,941.50", size:"0.82" },
  { time:"09:41:01", isLong:false, price:"2,941.20", size:"1.30" },
  { time:"09:40:59", isLong:true,  price:"2,941.80", size:"0.45" },
  { time:"09:40:57", isLong:false, price:"2,940.90", size:"2.10" },
  { time:"09:40:54", isLong:true,  price:"2,942.10", size:"0.67" },
  { time:"09:40:52", isLong:true,  price:"2,942.40", size:"1.05" },
  { time:"09:40:49", isLong:false, price:"2,941.00", size:"0.33" },
  { time:"09:40:47", isLong:true,  price:"2,943.00", size:"3.20" },
  { time:"09:40:45", isLong:false, price:"2,942.70", size:"0.88" },
  { time:"09:40:43", isLong:true,  price:"2,943.50", size:"1.44" },
  { time:"09:40:41", isLong:false, price:"2,943.10", size:"0.77" },
  { time:"09:40:39", isLong:true,  price:"2,943.80", size:"2.05" },
  { time:"09:40:37", isLong:false, price:"2,943.30", size:"0.60" },
  { time:"09:40:35", isLong:true,  price:"2,944.00", size:"1.18" },
  { time:"09:40:33", isLong:false, price:"2,943.60", size:"0.95" },
  { time:"09:40:31", isLong:true,  price:"2,944.20", size:"0.40" },
  { time:"09:40:29", isLong:false, price:"2,944.00", size:"1.75" },
  { time:"09:40:27", isLong:true,  price:"2,944.50", size:"0.55" },
  { time:"09:40:25", isLong:false, price:"2,944.10", size:"2.30" },
  { time:"09:40:23", isLong:true,  price:"2,944.80", size:"0.70" },
];

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
  const lastC = CANDLES[n - 1];
  const lastY = toY(lastC.c);
  const priceLabels = [0, 0.25, 0.5, 0.75, 1].map(t => minP + t * pRange);

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
      style={{ background: "#0a0b0f", display: "block" }}>
      <defs>
        <clipPath id="chartClip2">
          <rect x={PAD.l} y={PAD.t} width={cW} height={cH + VOL_H} />
        </clipPath>
      </defs>
      {[0,0.25,0.5,0.75,1].map((t,i) => (
        <line key={i} x1={PAD.l} x2={W-PAD.r} y1={PAD.t+cH*t} y2={PAD.t+cH*t} stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
      ))}
      {[0,0.2,0.4,0.6,0.8,1].map((t,i) => (
        <line key={i} x1={PAD.l+cW*t} x2={PAD.l+cW*t} y1={PAD.t} y2={H-PAD.b} stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
      ))}
      <g clipPath="url(#chartClip2)">
        {CANDLES.map((c,i) => {
          const up = c.c >= c.o;
          const vH = (VOLUMES[i] / maxV) * VOL_H;
          return <rect key={`v${i}`} x={toX(i)-bodyW/2} y={H-PAD.b-vH} width={bodyW} height={vH} fill={up ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"} rx="1"/>;
        })}
        {CANDLES.map((c,i) => {
          const up = c.c >= c.o;
          const color = up ? "#26a69a" : "#ef5350";
          const bTop = toY(Math.max(c.o, c.c));
          const bH = Math.max(toY(Math.min(c.o, c.c)) - bTop, 1);
          return (
            <g key={i}>
              <line x1={toX(i)} y1={toY(c.h)} x2={toX(i)} y2={toY(c.l)} stroke={color} strokeWidth="1"/>
              <rect x={toX(i)-bodyW/2} y={bTop} width={bodyW} height={bH} fill={color} rx="0.5"/>
            </g>
          );
        })}
      </g>
      <line x1={PAD.l} y1={lastY} x2={W-PAD.r} y2={lastY} stroke="#ef5350" strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.6"/>
      {priceLabels.map((p,i) => (
        <text key={i} x={W-PAD.r+6} y={PAD.t+cH-((p-minP)/pRange)*cH+4} fill="rgba(200,200,210,0.5)" fontSize="9" fontFamily="JetBrains Mono, monospace">
          {p.toFixed(0)}
        </text>
      ))}
      <rect x={W-PAD.r+1} y={lastY-8} width={PAD.r-2} height={16} fill="#ef5350" rx="2"/>
      <text x={W-PAD.r+PAD.r/2} y={lastY+4} textAnchor="middle" fill="#fff" fontSize="9" fontWeight="600" fontFamily="JetBrains Mono, monospace">
        {lastC.c.toFixed(2)}
      </text>
      {[0,0.25,0.5,0.75,1].map((t,i) => {
        const idx = Math.floor(t*(n-1));
        const hours = 9 + Math.floor(idx*6.5/n);
        const mins  = Math.floor((idx*390/n)%60);
        return (
          <text key={i} x={PAD.l+cW*t} y={H-PAD.b+13} textAnchor="middle" fill="rgba(200,200,210,0.4)" fontSize="8.5" fontFamily="JetBrains Mono, monospace">
            {`${hours.toString().padStart(2,"0")}:${mins.toString().padStart(2,"0")}`}
          </text>
        );
      })}
      <text x={PAD.l+4} y={PAD.t+14} fill="rgba(200,200,210,0.6)" fontSize="9.5" fontFamily="JetBrains Mono, monospace">
        {`O ${CANDLES[n-1].o}  H ${CANDLES[n-1].h}  L ${CANDLES[n-1].l}  C ${CANDLES[n-1].c}`}
      </text>
      <text x={W/2} y={H/2+20} textAnchor="middle" fill="rgba(255,255,255,0.018)" fontSize="28" fontWeight="700" fontFamily="Outfit, sans-serif" letterSpacing="4">
        AUROC
      </text>
    </svg>
  );
}

function ToolBtn({ children, label, active, onClick }: { children: React.ReactNode; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "0 8px", height: "100%", cursor: "pointer", gap: 4, flexShrink: 0,
        color: active ? "var(--t1)" : "var(--t2)",
        background: active ? "var(--active)" : "transparent",
        borderRight: "1px solid var(--b1)",
        transition: "color 0.1s, background-color 0.1s",
        fontSize: "var(--text-xs)",
      }}
    >{children}</button>
  );
}

const DRAW_TOOLS = [
  { key: "cursor",     label: "Cursor",          icon: <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2L7 10L8.5 7L11.5 6L2 2Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/></svg> },
  { key: "trend",      label: "Trend line",       icon: <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><line x1="1.5" y1="10.5" x2="10.5" y2="1.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/><circle cx="2" cy="10" r="1.3" fill="currentColor"/><circle cx="10" cy="2" r="1.3" fill="currentColor"/></svg> },
  { key: "hline",      label: "Horizontal line",  icon: <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/><circle cx="6" cy="6" r="1.3" fill="currentColor"/></svg> },
];

function TapePanel({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div style={{
      height: 80, flexShrink: 0,
      borderTop: "1px solid var(--b1)",
      background: "var(--surface)",
      overflowX: "auto", overflowY: "hidden",
    }}>
      <div style={{ display: "flex", alignItems: "stretch", height: "100%", width: "max-content" }}>
        {/* Header col */}
        <div style={{
          width: 56, flexShrink: 0, borderRight: "1px solid var(--b1)",
          display: "flex", flexDirection: "column", justifyContent: "center",
          padding: "0 8px", gap: 2,
        }}>
          <span className="label-upper">Tape</span>
        </div>
        {TAPE_TRADES.map((trade, i) => (
          <div key={i} style={{
            width: 90, flexShrink: 0,
            borderRight: "1px solid var(--b1)",
            display: "flex", flexDirection: "column", justifyContent: "center",
            padding: "0 8px", gap: 3,
          }}>
            <span style={{ fontSize: "var(--text-2xs)", color: "var(--t4)" }}>{trade.time}</span>
            <span className="tabular" style={{
              fontSize: "var(--text-xs)", fontWeight: 600,
              color: trade.isLong ? "var(--long)" : "var(--short)",
            }}>${trade.price}</span>
            <span className="tabular" style={{ fontSize: "var(--text-2xs)", color: "var(--t3)" }}>{trade.size}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CenterStack() {
  const { activeDrawTool, setActiveDrawTool } = useTerminal();
  const [tf, setTf] = useState("15m");
  const [tapeVisible, setTapeVisible] = useState(false);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "#0a0b0f" }}>
      {/* Market header bar */}
      <MarketHeaderBar />

      {/* Sub-toolbar: timeframes + drawing tools + scale buttons */}
      <div style={{
        height: "var(--h-toolbar)", display: "flex", alignItems: "stretch",
        background: "var(--surface)", borderBottom: "1px solid var(--b1)",
        overflow: "hidden", flexShrink: 0,
      }}>
        {/* Timeframes */}
        {(TIMEFRAMES as readonly string[]).map((t) => (
          <ToolBtn key={t} label={`Timeframe ${t}`} active={tf === t} onClick={() => setTf(t)}>
            <span style={{ fontWeight: tf === t ? 600 : 400, fontSize: "var(--text-xs)" }}>{t}</span>
          </ToolBtn>
        ))}

        <div aria-hidden="true" style={{ width: 1, background: "var(--b1)", margin: "6px 0", flexShrink: 0 }} />

        {/* Drawing tools */}
        {DRAW_TOOLS.map((tool) => (
          <ToolBtn
            key={tool.key}
            label={tool.label}
            active={activeDrawTool === tool.key}
            onClick={() => setActiveDrawTool(tool.key === activeDrawTool ? "cursor" : tool.key)}
          >
            {tool.icon}
          </ToolBtn>
        ))}

        <div style={{ flex: 1 }} />

        {/* Scale buttons */}
        <ToolBtn label="Toggle percentage scale" onClick={() => {}}>
          <span style={{ fontSize: "var(--text-2xs)" }}>%</span>
        </ToolBtn>
        <ToolBtn label="Toggle log scale" onClick={() => {}}>
          <span style={{ fontSize: "var(--text-2xs)" }}>log</span>
        </ToolBtn>
        <ToolBtn label="Toggle auto scale" onClick={() => {}}>
          <span style={{ fontSize: "var(--text-2xs)" }}>auto</span>
        </ToolBtn>

        <div aria-hidden="true" style={{ width: 1, background: "var(--b1)", margin: "6px 0", flexShrink: 0 }} />

        {/* Tape toggle */}
        <ToolBtn label="Toggle tape" active={tapeVisible} onClick={() => setTapeVisible(v => !v)}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <rect x="1" y="2" width="10" height="1.5" rx="0.5" fill="currentColor"/>
            <rect x="1" y="5.25" width="10" height="1.5" rx="0.5" fill="currentColor" opacity="0.6"/>
            <rect x="1" y="8.5" width="10" height="1.5" rx="0.5" fill="currentColor" opacity="0.35"/>
          </svg>
          <span style={{ fontSize: "var(--text-2xs)" }}>Tape</span>
        </ToolBtn>

        {/* Chart settings */}
        <ToolBtn label="Chart settings" onClick={() => {}}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <circle cx="6" cy="6" r="2" stroke="currentColor" strokeWidth="1.1"/>
            <path d="M6 1V2.5M6 9.5V11M1 6H2.5M9.5 6H11M2.64 2.64L3.7 3.7M8.3 8.3L9.36 9.36M9.36 2.64L8.3 3.7M3.7 8.3L2.64 9.36" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
          </svg>
        </ToolBtn>
      </div>

      {/* Chart area */}
      <div style={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden" }}>
        <ChartSVG />
      </div>

      {/* Tape panel */}
      <TapePanel visible={tapeVisible} />
    </div>
  );
}
