"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/cn";
import type { LivelinePoint, CandlePoint } from "liveline";

// Dynamically import Liveline to avoid SSR issues with canvas
const Liveline = dynamic(
  () => import("liveline").then((mod) => mod.Liveline),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-[var(--bg-void)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
          <span className="text-[var(--text-2xs)] text-[var(--text-muted)] uppercase tracking-widest">
            Loading Chart
          </span>
        </div>
      </div>
    )
  }
);

interface ChartPanelProps {
  symbol: string;
  currentPrice?: number;
  className?: string;
}

export function ChartPanel({
  symbol,
  currentPrice = 2341.5,
  className,
}: ChartPanelProps) {
  const [mode, setMode] = useState<"line" | "candle">("line");
  const [windowSecs, setWindowSecs] = useState(3600); // 1H in seconds
  const [lineData, setLineData] = useState<LivelinePoint[]>([]);
  const [candleData, setCandleData] = useState<CandlePoint[]>([]);
  const [currentValue, setCurrentValue] = useState(currentPrice);
  const [isClient, setIsClient] = useState(false);

  const timeframes = [
    { label: "1M", secs: 60 },
    { label: "5M", secs: 300 },
    { label: "15M", secs: 900 },
    { label: "1H", secs: 3600 },
    { label: "4H", secs: 14400 },
    { label: "1D", secs: 86400 },
  ];

  // Ensure client-side only rendering
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Generate mock data on mount
  useEffect(() => {
    if (!isClient) return;

    const now = Date.now();
    const points: LivelinePoint[] = [];
    const candles: CandlePoint[] = [];
    let price = currentPrice;

    // Generate historical data - 100 points
    for (let i = 100; i >= 0; i--) {
      const time = now - i * 60000; // 1 minute intervals
      const change = (Math.random() - 0.5) * 5;
      price += change;

      points.push({ time, value: price });

      // Generate candle data every 5 minutes
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
  }, [currentPrice, isClient]);

  // Simulate live updates
  useEffect(() => {
    if (!isClient || lineData.length === 0) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const change = (Math.random() - 0.5) * 2;

      setCurrentValue((prev) => {
        const newValue = prev + change;

        // Update line data
        setLineData((prevData) => {
          const newData = [...prevData.slice(-99), { time: now, value: newValue }];
          return newData;
        });

        // Update last candle
        setCandleData((prevCandles) => {
          if (prevCandles.length === 0) return prevCandles;
          const newCandles = [...prevCandles];
          const lastCandle = { ...newCandles[newCandles.length - 1] };
          lastCandle.close = newValue;
          lastCandle.high = Math.max(lastCandle.high, newValue);
          lastCandle.low = Math.min(lastCandle.low, newValue);
          newCandles[newCandles.length - 1] = lastCandle;
          return newCandles;
        });

        return newValue;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isClient, lineData.length]);

  const formatValue = (v: number) => `$${v.toFixed(2)}`;

  return (
    <div className={cn("h-full flex flex-col bg-[var(--bg-void)]", className)}>
      {/* Chart Controls */}
      <div className="h-11 flex items-center justify-between px-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/80 backdrop-blur-sm">
        {/* Left: Timeframe Selector */}
        <div className="flex items-center gap-0.5">
          {timeframes.map((tf) => (
            <button
              key={tf.secs}
              onClick={() => setWindowSecs(tf.secs)}
              className={cn(
                "px-2.5 py-1 rounded-[var(--radius-sm)]",
                "text-[var(--text-2xs)] font-semibold uppercase tracking-wider",
                "transition-all duration-200",
                windowSecs === tf.secs
                  ? "bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)] border border-[var(--accent-primary-glow)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-transparent"
              )}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {/* Right: Chart Type & Tools */}
        <div className="flex items-center gap-2">
          {/* Mode Toggle */}
          <div className="flex items-center gap-0.5 p-0.5 bg-[var(--bg-void)] rounded-[var(--radius-sm)] border border-[var(--border-subtle)]">
            <button
              onClick={() => setMode("line")}
              className={cn(
                "px-2.5 py-1 rounded-[var(--radius-sm)]",
                "text-[var(--text-2xs)] font-semibold uppercase tracking-wider",
                "transition-all duration-200",
                mode === "line"
                  ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              )}
            >
              Line
            </button>
            <button
              onClick={() => setMode("candle")}
              className={cn(
                "px-2.5 py-1 rounded-[var(--radius-sm)]",
                "text-[var(--text-2xs)] font-semibold uppercase tracking-wider",
                "transition-all duration-200",
                mode === "candle"
                  ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              )}
            >
              Candles
            </button>
          </div>

          {/* Fullscreen */}
          <button
            className={cn(
              "p-1.5 rounded-[var(--radius-sm)]",
              "text-[var(--text-muted)]",
              "hover:text-[var(--accent-primary)] hover:bg-[var(--bg-hover)]",
              "transition-all duration-200"
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
      <div className="flex-1 relative min-h-0">
        {isClient && lineData.length > 0 ? (
          <Liveline
            data={lineData}
            value={currentValue}
            theme="dark"
            color="#00d4aa"
            window={windowSecs}
            grid={true}
            badge={true}
            momentum={true}
            fill={true}
            scrub={true}
            showValue={true}
            valueMomentumColor={true}
            formatValue={formatValue}
            mode={mode}
            candles={mode === "candle" ? candleData : undefined}
            candleWidth={8}
            liveCandle={mode === "candle" ? candleData[candleData.length - 1] : undefined}
            referenceLine={{
              value: currentPrice,
              label: "Entry",
            }}
            padding={{
              top: 24,
              right: 70,
              bottom: 32,
              left: 12,
            }}
            className="w-full h-full"
            style={{ background: "#05060a" }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-void)]">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
              <span className="text-[var(--text-2xs)] text-[var(--text-muted)] uppercase tracking-widest">
                Loading Chart
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
