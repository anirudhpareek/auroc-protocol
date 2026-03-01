"use client";
import { useState, type ReactNode } from "react";
import { Header } from "./Header";
import { StatusBar } from "./StatusBar";

/* ── Left drawing toolbar icons (TradingView-style) ── */
const TOOLS: Array<{ key: string; label: string; svg: React.ReactNode | null }> = [
  {
    key: "cursor",
    label: "Cursor",
    svg: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2 2L8 12L9.5 8.5L13 7L2 2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>,
  },
  {
    key: "trend",
    label: "Trend Line",
    svg: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><line x1="2" y1="12" x2="12" y2="2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><circle cx="2.5" cy="11.5" r="1.5" fill="currentColor"/><circle cx="11.5" cy="2.5" r="1.5" fill="currentColor"/></svg>,
  },
  {
    key: "hline",
    label: "Horizontal Line",
    svg: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><circle cx="7" cy="7" r="1.5" fill="currentColor"/></svg>,
  },
  {
    key: "fork",
    label: "Pitchfork",
    svg: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M7 2V12M3 5L7 2L11 5M3 12L7 9L11 12" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    key: "measure",
    label: "Measure",
    svg: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2 7H12M2 5V9M12 5V9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
  },
  { key: "sep1", label: "", svg: null },
  {
    key: "text",
    label: "Text Label",
    svg: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M3 4H11M7 4V11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  },
  {
    key: "circle",
    label: "Circle",
    svg: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.2"/></svg>,
  },
  {
    key: "pencil",
    label: "Freehand Draw",
    svg: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2 12L10.5 3.5C11.3 2.7 12.5 2.7 13 3.2C13.5 3.7 13.3 4.9 12.5 5.5L4 13L2 12Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/><path d="M9.5 4.5L11.5 6.5" stroke="currentColor" strokeWidth="1.1"/></svg>,
  },
  { key: "sep2", label: "", svg: null },
  {
    key: "fib",
    label: "Fibonacci Retracement",
    svg: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><line x1="2" y1="11" x2="12" y2="11" stroke="currentColor" strokeWidth="1.1"/><line x1="2" y1="8" x2="12" y2="8" stroke="currentColor" strokeWidth="1.1" strokeOpacity="0.6"/><line x1="2" y1="5" x2="12" y2="5" stroke="currentColor" strokeWidth="1.1" strokeOpacity="0.4"/><line x1="2" y1="3" x2="12" y2="3" stroke="currentColor" strokeWidth="1.1" strokeOpacity="0.25"/></svg>,
  },
  {
    key: "more",
    label: "More Tools",
    svg: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><circle cx="7" cy="3"  r="1.2" fill="currentColor"/><circle cx="7" cy="7"  r="1.2" fill="currentColor"/><circle cx="7" cy="11" r="1.2" fill="currentColor"/></svg>,
  },
];

interface TradingLayoutProps {
  chart: ReactNode;
  orderPanel: ReactNode;
  positions: ReactNode;
}

export function TradingLayout({ chart, orderPanel, positions }: TradingLayoutProps) {
  const [activeTool, setActiveTool] = useState<string>("cursor");
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)", overflow: "hidden" }}>
      <Header />

      {/* Main body */}
      <div id="main-content" style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

        {/* ── Left drawing toolbar ── */}
        <div style={{
          width: 40, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center",
          background: "var(--surface)", borderRight: "1px solid var(--b1)", paddingTop: 6, gap: 2,
        }}>
          {TOOLS.map((t) =>
            t.svg === null ? (
              <div key={t.key} aria-hidden="true" style={{ width: 20, height: 1, background: "var(--b1)", margin: "3px 0" }} />
            ) : (
              <button
                key={t.key}
                type="button"
                aria-label={t.label}
                aria-pressed={activeTool === t.key}
                onClick={() => setActiveTool(t.key)}
                style={{
                  width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center",
                  justifyContent: "center",
                  color: activeTool === t.key ? "var(--gold)" : "var(--t3)",
                  background: activeTool === t.key ? "var(--gold-dim)" : "transparent",
                  transition: "color 0.1s, background-color 0.1s",
                }}
              >
                {t.svg}
              </button>
            )
          )}
        </div>

        {/* ── Center: chart + positions ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, overflow: "hidden" }}>
          {/* Chart */}
          <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
            {chart}
          </div>
          {/* Positions bottom panel */}
          <div style={{ height: 220, minHeight: 180, maxHeight: "38vh", flexShrink: 0, borderTop: "1px solid var(--b1)", overflow: "hidden" }}>
            {positions}
          </div>
        </div>

        {/* ── Right order panel ── */}
        <div style={{
          width: 296, flexShrink: 0, borderLeft: "1px solid var(--b1)",
          background: "var(--panel)", overflowY: "auto", display: "flex", flexDirection: "column",
        }}>
          {orderPanel}
        </div>
      </div>

      <StatusBar />
    </div>
  );
}
