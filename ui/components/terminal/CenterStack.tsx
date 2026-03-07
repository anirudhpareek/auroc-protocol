"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTerminal } from "./TerminalContext";

/* ── Mock OHLC data ── */
const CANDLES_RAW = [
  { o: 2840, c: 2858, h: 2865, l: 2832 },
  { o: 2858, c: 2850, h: 2868, l: 2845 },
  { o: 2850, c: 2871, h: 2878, l: 2848 },
  { o: 2871, c: 2864, h: 2880, l: 2860 },
  { o: 2864, c: 2882, h: 2890, l: 2862 },
  { o: 2882, c: 2875, h: 2888, l: 2870 },
  { o: 2875, c: 2893, h: 2900, l: 2873 },
  { o: 2893, c: 2886, h: 2898, l: 2882 },
  { o: 2886, c: 2904, h: 2912, l: 2884 },
  { o: 2904, c: 2896, h: 2910, l: 2892 },
  { o: 2896, c: 2915, h: 2922, l: 2894 },
  { o: 2915, c: 2908, h: 2920, l: 2905 },
  { o: 2908, c: 2926, h: 2934, l: 2906 },
  { o: 2926, c: 2919, h: 2930, l: 2915 },
  { o: 2919, c: 2938, h: 2945, l: 2917 },
  { o: 2938, c: 2930, h: 2942, l: 2926 },
  { o: 2930, c: 2948, h: 2955, l: 2928 },
  { o: 2948, c: 2940, h: 2952, l: 2936 },
  { o: 2940, c: 2958, h: 2965, l: 2938 },
  { o: 2958, c: 2950, h: 2962, l: 2946 },
  { o: 2950, c: 2968, h: 2975, l: 2948 },
  { o: 2968, c: 2960, h: 2972, l: 2956 },
  { o: 2960, c: 2878, h: 2965, l: 2862 },
  { o: 2878, c: 2894, h: 2898, l: 2870 },
  { o: 2894, c: 2885, h: 2900, l: 2882 },
  { o: 2885, c: 2892, h: 2896, l: 2880 },
  { o: 2892, c: 2906, h: 2912, l: 2890 },
  { o: 2906, c: 2892, h: 2910, l: 2888 },
];

const INTERVAL = 900;
const BASE_TIME = 1740000000;

const TIMEFRAMES = ["1m", "5m", "15m", "1H", "4H", "1D"] as const;

export function CenterStack() {
  const { market } = useTerminal();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof import("lightweight-charts").createChart> | null>(null);
  const [tf, setTf] = useState("15m");

  const initChart = useCallback(async () => {
    if (!containerRef.current) return;

    const { createChart, ColorType, CrosshairMode } = await import("lightweight-charts");

    // Dispose previous chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#07070a" },
        textColor: "#71717a",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.03)" },
        horzLines: { color: "rgba(255,255,255,0.03)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(255,255,255,0.1)", width: 1, style: 3, labelBackgroundColor: "#17171c" },
        horzLine: { color: "rgba(255,255,255,0.1)", width: 1, style: 3, labelBackgroundColor: "#17171c" },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.07)",
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.07)",
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderDownColor: "#ef5350",
      borderUpColor: "#26a69a",
      wickDownColor: "#ef5350",
      wickUpColor: "#26a69a",
    });

    const candleData = CANDLES_RAW.map((c, i) => ({
      time: (BASE_TIME + i * INTERVAL) as import("lightweight-charts").UTCTimestamp,
      open: c.o,
      high: c.h,
      low: c.l,
      close: c.c,
    }));

    candleSeries.setData(candleData);

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    const volumeData = CANDLES_RAW.map((c, i) => ({
      time: (BASE_TIME + i * INTERVAL) as import("lightweight-charts").UTCTimestamp,
      value: Math.abs(c.c - c.o) * 100 + Math.random() * 5000,
      color: c.c >= c.o ? "rgba(38,166,154,0.3)" : "rgba(239,83,80,0.3)",
    }));

    volumeSeries.setData(volumeData);
    chart.timeScale().fitContent();

    chartRef.current = chart;
  }, []);

  useEffect(() => {
    initChart();
    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [initChart]);

  // Handle resize
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (chartRef.current) {
          const { width, height } = entry.contentRect;
          chartRef.current.applyOptions({ width, height });
        }
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="flex flex-1 flex-col min-w-0" style={{ background: "var(--bg)" }}>
      {/* Toolbar: timeframes */}
      <div
        className="flex items-stretch shrink-0 overflow-hidden"
        style={{
          height: "var(--h-toolbar)",
          background: "var(--surface)",
          borderBottom: "1px solid var(--b1)",
        }}
      >
        {(TIMEFRAMES as readonly string[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTf(t)}
            aria-label={`Timeframe ${t}`}
            className="flex items-center justify-center shrink-0 transition-colors"
            style={{
              padding: "0 10px",
              height: "100%",
              fontSize: "var(--text-xs)",
              fontWeight: tf === t ? 600 : 400,
              color: tf === t ? "var(--t1)" : "var(--t3)",
              background: tf === t ? "var(--active)" : "transparent",
              borderRight: "1px solid var(--b1)",
            }}
          >
            {t}
          </button>
        ))}

        <div className="flex-1" />

        {/* Chart type indicators */}
        <div
          className="flex items-center gap-1 px-2 shrink-0"
          style={{ borderLeft: "1px solid var(--b1)" }}
        >
          <span
            className="tabular"
            style={{
              fontSize: "var(--text-2xs)",
              color: "var(--t3)",
              padding: "2px 6px",
              borderRadius: "var(--radius-sm)",
              background: "var(--active)",
            }}
          >
            Candles
          </span>
        </div>
      </div>

      {/* Chart canvas */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 relative"
        style={{ background: "#07070a" }}
      />
    </div>
  );
}
