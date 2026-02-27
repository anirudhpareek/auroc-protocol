"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/cn";

// Dynamically import Liveline to avoid SSR issues with canvas
const Liveline = dynamic(
  () => import("liveline").then((mod) => mod.Liveline),
  { ssr: false }
);

interface ChartPanelProps {
  symbol: string;
  currentPrice?: number;
  className?: string;
}

interface DataPoint {
  time: number;
  value: number;
}

interface CandlePoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export function ChartPanel({
  symbol,
  currentPrice = 2341.5,
  className,
}: ChartPanelProps) {
  const [mode, setMode] = useState<"line" | "candle">("line");
  const [timeframe, setTimeframe] = useState(3600); // 1H in seconds
  const [lineData, setLineData] = useState<DataPoint[]>([]);
  const [candleData, setCandleData] = useState<CandlePoint[]>([]);
  const [currentValue, setCurrentValue] = useState(currentPrice);

  const timeframes = [
    { label: "1M", secs: 60 },
    { label: "5M", secs: 300 },
    { label: "15M", secs: 900 },
    { label: "1H", secs: 3600 },
    { label: "4H", secs: 14400 },
    { label: "1D", secs: 86400 },
  ];

  // Generate mock data on mount
  useEffect(() => {
    const now = Date.now();
    const points: DataPoint[] = [];
    const candles: CandlePoint[] = [];
    let price = currentPrice;

    // Generate historical data
    for (let i = 100; i >= 0; i--) {
      const time = now - i * 60000; // 1 minute intervals
      const change = (Math.random() - 0.5) * 5;
      price += change;

      points.push({ time, value: price });

      // Generate candle data
      if (i % 5 === 0) {
        const open = price;
        const volatility = Math.random() * 10;
        const close = open + (Math.random() - 0.5) * volatility;
        const high = Math.max(open, close) + Math.random() * 5;
        const low = Math.min(open, close) - Math.random() * 5;

        candles.push({ time, open, high, low, close });
      }
    }

    setLineData(points);
    setCandleData(candles);
    setCurrentValue(price);
  }, [currentPrice]);

  // Simulate live updates
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const change = (Math.random() - 0.5) * 2;
      const newValue = currentValue + change;

      setCurrentValue(newValue);
      setLineData((prev) => [...prev.slice(-99), { time: now, value: newValue }]);

      // Update last candle
      setCandleData((prev) => {
        if (prev.length === 0) return prev;
        const newCandles = [...prev];
        const lastCandle = { ...newCandles[newCandles.length - 1] };
        lastCandle.close = newValue;
        lastCandle.high = Math.max(lastCandle.high, newValue);
        lastCandle.low = Math.min(lastCandle.low, newValue);
        newCandles[newCandles.length - 1] = lastCandle;
        return newCandles;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentValue]);

  const formatValue = (v: number) => `$${v.toFixed(2)}`;

  return (
    <div className={cn("h-full flex flex-col bg-[var(--bg-base)]", className)}>
      {/* Chart Controls */}
      <div className="h-10 flex items-center justify-between px-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        {/* Left: Timeframe Selector */}
        <div className="flex items-center gap-1">
          {timeframes.map((tf) => (
            <button
              key={tf.secs}
              onClick={() => setTimeframe(tf.secs)}
              className={cn(
                "px-2 py-1 rounded-[var(--radius-sm)]",
                "text-[var(--text-xs)] font-medium",
                "transition-colors duration-[var(--transition-fast)]",
                timeframe === tf.secs
                  ? "bg-[var(--bg-hover)] text-[var(--text-primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              )}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {/* Right: Chart Type & Tools */}
        <div className="flex items-center gap-2">
          {/* Mode Toggle */}
          <div className="flex items-center gap-1 p-0.5 bg-[var(--bg-elevated)] rounded-[var(--radius-sm)]">
            <button
              onClick={() => setMode("line")}
              className={cn(
                "px-2 py-1 rounded-[var(--radius-sm)]",
                "text-[var(--text-xs)]",
                "transition-colors duration-[var(--transition-fast)]",
                mode === "line"
                  ? "bg-[var(--bg-hover)] text-[var(--text-primary)]"
                  : "text-[var(--text-muted)]"
              )}
            >
              Line
            </button>
            <button
              onClick={() => setMode("candle")}
              className={cn(
                "px-2 py-1 rounded-[var(--radius-sm)]",
                "text-[var(--text-xs)]",
                "transition-colors duration-[var(--transition-fast)]",
                mode === "candle"
                  ? "bg-[var(--bg-hover)] text-[var(--text-primary)]"
                  : "text-[var(--text-muted)]"
              )}
            >
              Candles
            </button>
          </div>

          {/* Fullscreen */}
          <button
            className={cn(
              "p-1 rounded-[var(--radius-sm)]",
              "text-[var(--text-muted)]",
              "hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]",
              "transition-colors duration-[var(--transition-fast)]"
            )}
            aria-label="Expand chart"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Chart Container */}
      <div className="flex-1 relative">
        {lineData.length > 0 ? (
          <Liveline
            data={lineData}
            value={currentValue}
            theme="dark"
            color="#3b82f6"
            window={timeframe}
            grid={true}
            badge={true}
            momentum={true}
            fill={true}
            scrub={true}
            showValue={true}
            valueMomentumColor={true}
            formatValue={formatValue}
            mode={mode}
            candles={candleData}
            liveCandle={candleData[candleData.length - 1]}
            referenceLine={{
              value: currentPrice,
              label: "Entry",
            }}
            padding={{
              top: 20,
              right: 60,
              bottom: 30,
              left: 10,
            }}
            className="w-full h-full"
            style={{ background: "var(--bg-base)" }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="skeleton w-full h-full" />
          </div>
        )}
      </div>
    </div>
  );
}
