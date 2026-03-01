"use client";

import { useState } from "react";

// Mock order book data for XAU/USD near $2,941
// [price, size]
const ASKS_RAW: [number, number][] = [
  [2946.00, 2.45],
  [2945.50, 0.55],
  [2945.00, 1.80],
  [2944.50, 0.78],
  [2944.00, 1.30],
  [2943.50, 0.95],
  [2943.00, 2.10],
  [2942.50, 0.63],
  [2942.00, 1.45],
  [2941.70, 0.82],
];

const BIDS_RAW: [number, number][] = [
  [2941.20, 1.20],
  [2941.00, 0.88],
  [2940.50, 1.55],
  [2940.00, 2.30],
  [2939.50, 0.72],
  [2939.00, 1.10],
  [2938.50, 0.90],
  [2938.00, 1.65],
  [2937.50, 0.48],
  [2937.00, 2.80],
];

const RECENT_TRADES = [
  { time: "09:41:03", isLong: true,  price: "2,941.50", size: "0.82" },
  { time: "09:41:01", isLong: false, price: "2,941.20", size: "1.30" },
  { time: "09:40:59", isLong: true,  price: "2,941.80", size: "0.45" },
  { time: "09:40:57", isLong: false, price: "2,940.90", size: "2.10" },
  { time: "09:40:54", isLong: true,  price: "2,942.10", size: "0.67" },
  { time: "09:40:52", isLong: true,  price: "2,942.40", size: "1.05" },
  { time: "09:40:49", isLong: false, price: "2,941.00", size: "0.33" },
  { time: "09:40:47", isLong: true,  price: "2,943.00", size: "3.20" },
  { time: "09:40:45", isLong: false, price: "2,942.70", size: "0.88" },
  { time: "09:40:43", isLong: true,  price: "2,943.50", size: "1.44" },
  { time: "09:40:41", isLong: false, price: "2,943.10", size: "0.77" },
  { time: "09:40:39", isLong: true,  price: "2,943.80", size: "2.05" },
  { time: "09:40:37", isLong: false, price: "2,943.30", size: "0.60" },
  { time: "09:40:35", isLong: true,  price: "2,944.00", size: "1.18" },
];

// Compute cumulative depth
function withDepth(rows: [number, number][]): { price: number; size: number; cumulative: number }[] {
  let cum = 0;
  return rows.map(([price, size]) => {
    cum += size;
    return { price, size, cumulative: cum };
  });
}

const ASKS = withDepth([...ASKS_RAW].reverse()); // reverse so nearest ask is at bottom
const BIDS = withDepth(BIDS_RAW);
const MAX_CUM = Math.max(ASKS[ASKS.length - 1]?.cumulative ?? 0, BIDS[BIDS.length - 1]?.cumulative ?? 0);
const SPREAD = (ASKS_RAW[ASKS_RAW.length - 1][0] - BIDS_RAW[0][0]).toFixed(2);
const MARK_PRICE = "2,941.50";

type BookTab = "Book" | "Trades";

const TH: React.CSSProperties = {
  fontSize: "var(--text-2xs)",
  fontWeight: 500,
  color: "var(--t3)",
  padding: "4px 8px",
  textAlign: "right",
};

export function OrderBook() {
  const [tab, setTab] = useState<BookTab>("Book");

  return (
    <div style={{
      width: 220, flexShrink: 0,
      borderLeft: "1px solid var(--b1)", borderRight: "1px solid var(--b1)",
      display: "flex", flexDirection: "column",
      background: "var(--surface)", overflow: "hidden",
    }}>
      {/* Tab bar */}
      <div style={{
        display: "flex", borderBottom: "1px solid var(--b1)", flexShrink: 0,
      }}>
        {(["Book", "Trades"] as BookTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              flex: 1, height: 34,
              fontSize: "var(--text-xs)", fontWeight: 600,
              color: tab === t ? "var(--t1)" : "var(--t3)",
              borderBottom: tab === t ? "2px solid var(--gold)" : "2px solid transparent",
              transition: "var(--transition-fast)",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Book" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Column headers */}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", flexShrink: 0 }}>
            <span style={{ ...TH, textAlign: "left" }}>Price (USD)</span>
            <span style={TH}>Size</span>
            <span style={TH}>Total</span>
          </div>

          {/* Asks */}
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", minHeight: 0 }}>
            {ASKS.map((row, i) => {
              const pct = (row.cumulative / MAX_CUM) * 100;
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "1px 8px", position: "relative", cursor: "default",
                }}>
                  {/* Depth bar */}
                  <div aria-hidden="true" style={{
                    position: "absolute", right: 0, top: 0, bottom: 0,
                    width: `${pct}%`,
                    background: "rgba(239,68,68,0.08)",
                    pointerEvents: "none",
                  }} />
                  <span className="tabular" style={{ fontSize: "var(--text-xs)", color: "var(--short)", zIndex: 1, flexShrink: 0 }}>
                    {row.price.toFixed(2)}
                  </span>
                  <span className="tabular" style={{ fontSize: "var(--text-xs)", color: "var(--t2)", zIndex: 1 }}>
                    {row.size.toFixed(2)}
                  </span>
                  <span className="tabular" style={{ fontSize: "var(--text-xs)", color: "var(--t3)", zIndex: 1 }}>
                    {row.cumulative.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Spread row */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "4px 8px", background: "var(--raised)", flexShrink: 0,
            borderTop: "1px solid var(--b1)", borderBottom: "1px solid var(--b1)",
          }}>
            <span className="tabular" style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--t1)" }}>
              ${MARK_PRICE}
            </span>
            <span style={{ fontSize: "var(--text-2xs)", color: "var(--t3)" }}>
              Spread: {SPREAD}
            </span>
          </div>

          {/* Bids */}
          <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
            {BIDS.map((row, i) => {
              const pct = (row.cumulative / MAX_CUM) * 100;
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "1px 8px", position: "relative", cursor: "default",
                }}>
                  <div aria-hidden="true" style={{
                    position: "absolute", right: 0, top: 0, bottom: 0,
                    width: `${pct}%`,
                    background: "rgba(34,197,94,0.08)",
                    pointerEvents: "none",
                  }} />
                  <span className="tabular" style={{ fontSize: "var(--text-xs)", color: "var(--long)", zIndex: 1, flexShrink: 0 }}>
                    {row.price.toFixed(2)}
                  </span>
                  <span className="tabular" style={{ fontSize: "var(--text-xs)", color: "var(--t2)", zIndex: 1 }}>
                    {row.size.toFixed(2)}
                  </span>
                  <span className="tabular" style={{ fontSize: "var(--text-xs)", color: "var(--t3)", zIndex: 1 }}>
                    {row.cumulative.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "Trades" && (
        <div style={{ flex: 1, overflowY: "auto" }}>
          {/* Column headers */}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", flexShrink: 0 }}>
            <span style={{ ...TH, textAlign: "left" }}>Price</span>
            <span style={TH}>Size</span>
            <span style={TH}>Time</span>
          </div>
          {RECENT_TRADES.map((t, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "2px 8px",
            }}>
              <span className="tabular" style={{
                fontSize: "var(--text-xs)",
                color: t.isLong ? "var(--long)" : "var(--short)",
                flexShrink: 0,
              }}>
                {t.price}
              </span>
              <span className="tabular" style={{ fontSize: "var(--text-xs)", color: "var(--t2)" }}>
                {t.size}
              </span>
              <span style={{ fontSize: "var(--text-2xs)", color: "var(--t3)" }}>
                {t.time}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
