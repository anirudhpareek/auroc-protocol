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

export function OrderBook() {
  const [tab, setTab] = useState<BookTab>("Book");

  return (
    <div
      className="flex flex-col shrink-0 overflow-hidden"
      style={{
        width: 220,
        borderLeft: "1px solid var(--b1)",
        background: "var(--surface)",
      }}
    >
      {/* ── Tab bar ── */}
      <div
        className="flex shrink-0"
        style={{ borderBottom: "1px solid var(--b1)" }}
      >
        {(["Book", "Trades"] as BookTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className="flex-1 font-semibold transition-colors duration-100"
            style={{
              height: 34,
              fontSize: "var(--text-xs)",
              color: tab === t ? "var(--t1)" : "var(--t3)",
              borderBottom: tab === t
                ? "2px solid var(--gold)"
                : "2px solid transparent",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Book view ── */}
      {tab === "Book" && (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Column headers */}
          <div
            className="flex shrink-0 uppercase"
            style={{ padding: "4px 8px", fontSize: "var(--text-2xs)", color: "var(--t3)", fontWeight: 500, letterSpacing: "0.06em" }}
          >
            <span className="flex-1 text-left">Price (USD)</span>
            <span className="w-14 text-right">Size</span>
            <span className="w-14 text-right">Total</span>
          </div>

          {/* Asks section */}
          <div className="flex flex-1 flex-col overflow-y-auto min-h-0">
            {ASKS.map((row, i) => {
              const pct = (row.cumulative / MAX_CUM) * 100;
              return (
                <div
                  key={i}
                  className="group relative flex items-center cursor-default select-none"
                  style={{ padding: "1.5px 8px" }}
                >
                  {/* Depth bar */}
                  <div
                    aria-hidden="true"
                    className="absolute right-0 top-0 bottom-0 pointer-events-none"
                    style={{
                      width: `${pct}%`,
                      background: "var(--short-dim)",
                    }}
                  />
                  <span
                    className="tabular relative z-[1] flex-1 text-left"
                    style={{ fontSize: "var(--text-xs)", color: "var(--short)" }}
                  >
                    {row.price.toFixed(2)}
                  </span>
                  <span
                    className="tabular relative z-[1] w-14 text-right"
                    style={{ fontSize: "var(--text-xs)", color: "var(--t2)" }}
                  >
                    {row.size.toFixed(2)}
                  </span>
                  <span
                    className="tabular relative z-[1] w-14 text-right"
                    style={{ fontSize: "var(--text-xs)", color: "var(--t3)" }}
                  >
                    {row.cumulative.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Spread row */}
          <div
            className="flex items-center justify-between shrink-0"
            style={{
              padding: "5px 8px",
              background: "var(--raised)",
              borderTop: "1px solid var(--b1)",
              borderBottom: "1px solid var(--b1)",
            }}
          >
            <span
              className="tabular font-semibold"
              style={{ fontSize: "var(--text-sm)", color: "var(--t1)" }}
            >
              ${MARK_PRICE}
            </span>
            <span
              style={{ fontSize: "var(--text-2xs)", color: "var(--t3)" }}
            >
              Spread: {SPREAD}
            </span>
          </div>

          {/* Bids section */}
          <div className="flex flex-1 flex-col overflow-y-auto min-h-0">
            {BIDS.map((row, i) => {
              const pct = (row.cumulative / MAX_CUM) * 100;
              return (
                <div
                  key={i}
                  className="group relative flex items-center cursor-default select-none"
                  style={{ padding: "1.5px 8px" }}
                >
                  {/* Depth bar */}
                  <div
                    aria-hidden="true"
                    className="absolute right-0 top-0 bottom-0 pointer-events-none"
                    style={{
                      width: `${pct}%`,
                      background: "var(--long-dim)",
                    }}
                  />
                  <span
                    className="tabular relative z-[1] flex-1 text-left"
                    style={{ fontSize: "var(--text-xs)", color: "var(--long)" }}
                  >
                    {row.price.toFixed(2)}
                  </span>
                  <span
                    className="tabular relative z-[1] w-14 text-right"
                    style={{ fontSize: "var(--text-xs)", color: "var(--t2)" }}
                  >
                    {row.size.toFixed(2)}
                  </span>
                  <span
                    className="tabular relative z-[1] w-14 text-right"
                    style={{ fontSize: "var(--text-xs)", color: "var(--t3)" }}
                  >
                    {row.cumulative.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Trades view ── */}
      {tab === "Trades" && (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Column headers */}
          <div
            className="flex shrink-0 uppercase"
            style={{ padding: "4px 8px", fontSize: "var(--text-2xs)", color: "var(--t3)", fontWeight: 500, letterSpacing: "0.06em" }}
          >
            <span className="flex-1 text-left">Price</span>
            <span className="w-14 text-right">Size</span>
            <span className="w-14 text-right">Time</span>
          </div>

          {/* Trade rows */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {RECENT_TRADES.map((t, i) => (
              <div
                key={i}
                className="flex items-center cursor-default select-none"
                style={{ padding: "2px 8px" }}
              >
                <span
                  className="tabular flex-1 text-left"
                  style={{
                    fontSize: "var(--text-xs)",
                    color: t.isLong ? "var(--long)" : "var(--short)",
                  }}
                >
                  {t.price}
                </span>
                <span
                  className="tabular w-14 text-right"
                  style={{ fontSize: "var(--text-xs)", color: "var(--t2)" }}
                >
                  {t.size}
                </span>
                <span
                  className="tabular w-14 text-right"
                  style={{ fontSize: "var(--text-2xs)", color: "var(--t3)" }}
                >
                  {t.time}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
