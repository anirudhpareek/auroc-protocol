"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { CandlePoint, LivelinePoint } from "liveline";
import { useTerminal } from "./TerminalContext";

const Liveline = dynamic(
  () => import("liveline").then((m) => ({ default: m.Liveline })),
  {
    ssr: false,
    loading: () => <div style={{ width: "100%", height: "100%", background: "#0a0b0f" }} className="animate-shimmer" />,
  }
);

const TIMEFRAMES = ["1m", "3m", "5m", "15m", "1H", "4H", "1D", "1W"] as const;

// Static OHLC data — replace with live feed when available
const CANDLES_RAW = [
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

const INTERVAL = 900; // 15 min in seconds
const BASE_TIME = 1740000000;

const CANDLE_POINTS: CandlePoint[] = CANDLES_RAW.map((c, i) => ({
  time: BASE_TIME + i * INTERVAL,
  open: c.o,
  high: c.h,
  low: c.l,
  close: c.c,
}));

const TICK_DATA: LivelinePoint[] = CANDLES_RAW.map((c, i) => ({
  time: BASE_TIME + i * INTERVAL + INTERVAL - 1,
  value: c.c,
}));

const LIVE_VALUE = CANDLES_RAW[CANDLES_RAW.length - 1].c;

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

const DRAW_TOOLS = [
  { key: "cursor",  label: "Cursor",         icon: <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2L7 10L8.5 7L11.5 6L2 2Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/></svg> },
  { key: "trend",   label: "Trend line",      icon: <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><line x1="1.5" y1="10.5" x2="10.5" y2="1.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/><circle cx="2" cy="10" r="1.3" fill="currentColor"/><circle cx="10" cy="2" r="1.3" fill="currentColor"/></svg> },
  { key: "hline",   label: "Horizontal line", icon: <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/><circle cx="6" cy="6" r="1.3" fill="currentColor"/></svg> },
];

function ToolBtn({ children, label, active, onClick }: { children: React.ReactNode; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "0 8px", height: "100%", gap: 4, flexShrink: 0,
        color: active ? "var(--t1)" : "var(--t2)",
        background: active ? "var(--active)" : "transparent",
        borderRight: "1px solid var(--b1)",
        transition: "color 0.1s, background-color 0.1s",
        fontSize: "var(--text-xs)",
      }}
    >{children}</button>
  );
}

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
  const { activeDrawTool, setActiveDrawTool, market } = useTerminal();
  const [tf, setTf] = useState("15m");
  const [tapeVisible, setTapeVisible] = useState(false);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "var(--bg)" }}>
      {/* Sub-toolbar: timeframes + drawing tools + scale buttons */}
      <div style={{
        height: "var(--h-toolbar)", display: "flex", alignItems: "stretch",
        background: "var(--surface)", borderBottom: "1px solid var(--b1)",
        overflow: "hidden", flexShrink: 0,
      }}>
        {(TIMEFRAMES as readonly string[]).map((t) => (
          <ToolBtn key={t} label={`Timeframe ${t}`} active={tf === t} onClick={() => setTf(t)}>
            <span style={{ fontWeight: tf === t ? 600 : 400, fontSize: "var(--text-xs)" }}>{t}</span>
          </ToolBtn>
        ))}

        <div aria-hidden="true" style={{ width: 1, background: "var(--b1)", margin: "6px 0", flexShrink: 0 }} />

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

        <ToolBtn label="Toggle tape" active={tapeVisible} onClick={() => setTapeVisible(v => !v)}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <rect x="1" y="2" width="10" height="1.5" rx="0.5" fill="currentColor"/>
            <rect x="1" y="5.25" width="10" height="1.5" rx="0.5" fill="currentColor" opacity="0.6"/>
            <rect x="1" y="8.5" width="10" height="1.5" rx="0.5" fill="currentColor" opacity="0.35"/>
          </svg>
          <span style={{ fontSize: "var(--text-2xs)" }}>Tape</span>
        </ToolBtn>

        <ToolBtn label="Chart settings" onClick={() => {}}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <circle cx="6" cy="6" r="2" stroke="currentColor" strokeWidth="1.1"/>
            <path d="M6 1V2.5M6 9.5V11M1 6H2.5M9.5 6H11M2.64 2.64L3.7 3.7M8.3 8.3L9.36 9.36M9.36 2.64L8.3 3.7M3.7 8.3L2.64 9.36" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
          </svg>
        </ToolBtn>
      </div>

      {/* Chart area — Liveline canvas */}
      <div style={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden" }}>
        <Liveline
          mode="candle"
          candles={CANDLE_POINTS}
          candleWidth={INTERVAL}
          data={TICK_DATA}
          value={LIVE_VALUE}
          theme="dark"
          color={market.color}
          grid
          badge
        />
      </div>

      <TapePanel visible={tapeVisible} />
    </div>
  );
}
