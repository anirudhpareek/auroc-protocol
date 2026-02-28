"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/cn";
import { useMarketData } from "@/hooks/useMarketData";
import { MARKETS } from "@/lib/contracts";
import { Regime } from "@/types";
import { formatPrice, formatConfidence } from "@/lib/format";

/* ── Static market config ── */
const MARKET_CONFIG = [
  {
    id: MARKETS.XAU_USD,
    symbol: "XAU",
    name: "Gold",
    pair: "XAU/USD",
    mockChange: "+0.45%",
    mockVol: "$287M",
    mockOi: "$124.7M",
    mockFunding: "+0.0031%",
    fundingPositive: true,
  },
  {
    id: MARKETS.SPX_USD,
    symbol: "SPX",
    name: "S&P 500",
    pair: "SPX/USD",
    mockChange: "-0.12%",
    mockVol: "$156M",
    mockOi: "$89.4M",
    mockFunding: "-0.0018%",
    fundingPositive: false,
  },
] as const;

type MarketConfig = (typeof MARKET_CONFIG)[number];

const TIMEFRAMES = ["1m", "5m", "15m", "1H", "4H", "1D", "1W"];

const REGIME_STYLES: Record<number, { label: string; bg: string; text: string; glow: string }> = {
  [Regime.OPEN]:       { label: "OPEN",       bg: "var(--long-dim)",    text: "var(--long)",    glow: "var(--long)"    },
  [Regime.OFF_HOURS]:  { label: "OFF-HOURS",  bg: "var(--accent-dim)",  text: "var(--accent)",  glow: "var(--accent)"  },
  [Regime.TRANSITION]: { label: "TRANSITION", bg: "var(--info-dim)",    text: "var(--info)",    glow: "var(--info)"    },
  [Regime.STRESS]:     { label: "STRESS",     bg: "var(--short-dim)",   text: "var(--short)",   glow: "var(--short)"   },
};

/* ── Fake candlestick chart (SVG) ── */
function CandlestickChart() {
  const candles = [
    { o:60,  c:75,  h:80,  l:55  },
    { o:75,  c:68,  h:78,  l:62  },
    { o:68,  c:82,  h:86,  l:65  },
    { o:82,  c:78,  h:90,  l:75  },
    { o:78,  c:95,  h:98,  l:76  },
    { o:95,  c:88,  h:97,  l:84  },
    { o:88,  c:102, h:106, l:86  },
    { o:102, c:96,  h:104, l:93  },
    { o:96,  c:112, h:116, l:94  },
    { o:112, c:106, h:114, l:102 },
    { o:106, c:120, h:124, l:104 },
    { o:120, c:115, h:122, l:111 },
    { o:115, c:128, h:132, l:113 },
    { o:128, c:122, h:130, l:118 },
    { o:122, c:136, h:140, l:120 },
    { o:136, c:130, h:138, l:126 },
    { o:130, c:142, h:146, l:128 },
    { o:142, c:138, h:145, l:134 },
    { o:138, c:150, h:154, l:136 },
    { o:150, c:145, h:153, l:142 },
  ];

  const W = 900; const H = 260; const PAD_X = 16; const PAD_Y = 20;
  const chartW = W - PAD_X * 2;
  const chartH = H - PAD_Y * 2;
  const allP = candles.flatMap(c => [c.h, c.l]);
  const minP = Math.min(...allP) - 8;
  const maxP = Math.max(...allP) + 8;
  const range = maxP - minP;
  const cw = chartW / candles.length;
  const bw = cw * 0.52;

  const toY = (p: number) => PAD_Y + chartH - ((p - minP) / range) * chartH;
  const toX = (i: number) => PAD_X + i * cw + cw / 2;

  const lastClose = candles[candles.length - 1].c;

  /* Area path for gradient fill under price line */
  const areaPath = candles.map((c, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(c.c).toFixed(1)}`).join(" ") +
    ` L${toX(candles.length - 1).toFixed(1)},${PAD_Y + chartH} L${toX(0).toFixed(1)},${PAD_Y + chartH} Z`;

  return (
    <svg
      className="w-full h-full"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ background: "var(--bg-base)" }}
    >
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="var(--long)" stopOpacity="0.06" />
          <stop offset="100%" stopColor="var(--long)" stopOpacity="0"    />
        </linearGradient>
      </defs>

      {/* Grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
        <line key={i} x1={PAD_X} y1={PAD_Y + chartH * t} x2={W - PAD_X} y2={PAD_Y + chartH * t}
          stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
      ))}
      {[0, 0.2, 0.4, 0.6, 0.8, 1].map((t, i) => (
        <line key={i} x1={PAD_X + chartW * t} y1={PAD_Y} x2={PAD_X + chartW * t} y2={PAD_Y + chartH}
          stroke="rgba(255,255,255,0.025)" strokeWidth="1" />
      ))}

      {/* Area fill */}
      <path d={areaPath} fill="url(#areaGrad)" />

      {/* Candles */}
      {candles.map((c, i) => {
        const up = c.c >= c.o;
        const color = up ? "var(--long)" : "var(--short)";
        const bodyTop = toY(Math.max(c.o, c.c));
        const bodyBot = toY(Math.min(c.o, c.c));
        const bh = Math.max(bodyBot - bodyTop, 1.5);
        return (
          <g key={i}>
            <line x1={toX(i)} y1={toY(c.h)} x2={toX(i)} y2={toY(c.l)}
              stroke={color} strokeWidth="1" strokeOpacity="0.55" />
            <rect x={toX(i) - bw / 2} y={bodyTop} width={bw} height={bh}
              fill={color} fillOpacity={up ? "0.9" : "0.75"} rx="1.5" />
          </g>
        );
      })}

      {/* Current price line */}
      <line x1={PAD_X} y1={toY(lastClose)} x2={W - PAD_X} y2={toY(lastClose)}
        stroke="var(--long)" strokeWidth="0.75" strokeOpacity="0.35" strokeDasharray="5 4" />

      {/* Price label */}
      <rect x={W - PAD_X - 2} y={toY(lastClose) - 8} width={2} height={16}
        fill="var(--long)" rx="1" />

      {/* Watermark */}
      <text x={W / 2} y={H - 6} textAnchor="middle"
        fill="rgba(255,255,255,0.04)" fontSize="10" fontFamily="Inter, sans-serif" letterSpacing="4">
        AUROC PROTOCOL · TRADINGVIEW
      </text>
    </svg>
  );
}

/* ── Stat cell ── */
function Stat({
  label, value, color, loading,
}: { label: string; value: string; color?: string; loading?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>{label}</span>
      {loading ? (
        <div className="w-12 h-3 rounded animate-shimmer" />
      ) : (
        <span className="text-[11px] font-medium tabular" style={{ color: color ?? "var(--text-primary)" }}>
          {value}
        </span>
      )}
    </div>
  );
}

/* ── Price display with flash animation ── */
function LivePrice({ price, loading }: { price: string; loading: boolean }) {
  const prevRef = useRef(price);
  const [flashClass, setFlashClass] = useState("");

  useEffect(() => {
    if (price !== prevRef.current && !loading) {
      const isUp = price > prevRef.current;
      setFlashClass(isUp ? "flash-up" : "flash-down");
      prevRef.current = price;
      const t = setTimeout(() => setFlashClass(""), 800);
      return () => clearTimeout(t);
    }
  }, [price, loading]);

  if (loading) {
    return <div className="w-32 h-6 rounded-md animate-shimmer" />;
  }

  return (
    <span
      className={cn("text-xl font-semibold tabular", flashClass)}
      style={{ color: "var(--text-primary)", letterSpacing: "-0.03em" }}
    >
      ${price}
    </span>
  );
}

/* ── Asset selector dropdown ── */
function AssetMenu({
  selected,
  onSelect,
  onClose,
}: {
  selected: MarketConfig;
  onSelect: (m: MarketConfig) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="absolute top-full left-0 mt-1 w-52 rounded-xl overflow-hidden z-50 animate-slide-up"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-strong)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px var(--border-subtle)",
      }}
    >
      {MARKET_CONFIG.map((m) => {
        const active = m.id === selected.id;
        return (
          <button
            key={m.id}
            onClick={() => { onSelect(m); onClose(); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 transition-colors"
            style={{ background: active ? "var(--bg-overlay)" : "transparent" }}
            onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = active ? "var(--bg-overlay)" : "transparent"; }}
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "var(--accent-dim)", border: "1px solid var(--accent-mid)" }}>
              <span className="text-[11px] font-bold" style={{ color: "var(--accent)" }}>{m.symbol[0]}</span>
            </div>
            <div className="text-left">
              <div className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{m.pair}</div>
              <div className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>{m.name} · RWA Perp</div>
            </div>
            {active && (
              <div className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--long)" }} />
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ── Main Component ── */
export function ChartPanel() {
  const [market, setMarket]         = useState<MarketConfig>(MARKET_CONFIG[0]);
  const [tf, setTf]                 = useState("15m");
  const [showDropdown, setDropdown] = useState(false);

  /* Real on-chain market data */
  const { marketInfo, isLoading } = useMarketData(market.id);

  /* Display values — prefer live chain data, fall back to mock */
  const indexPriceStr = marketInfo && marketInfo.indexPrice > 0n
    ? formatPrice(marketInfo.indexPrice)
    : "2,890.15";

  const markPriceStr = marketInfo && marketInfo.markPrice > 0n
    ? formatPrice(marketInfo.markPrice)
    : "2,892.40";

  const regimeNum = marketInfo ? marketInfo.regime : Regime.OPEN;
  const rs = REGIME_STYLES[regimeNum] ?? REGIME_STYLES[Regime.OPEN];

  const confidenceStr = marketInfo && marketInfo.confidence > 0n
    ? formatConfidence(marketInfo.confidence)
    : "98.5%";

  return (
    <div className="h-full flex flex-col" style={{ background: "var(--bg-base)" }}>

      {/* ── Top bar ── */}
      <div
        className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5"
        style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border-default)", minHeight: "52px" }}
      >
        {/* Asset picker */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setDropdown(!showDropdown)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all duration-150"
            style={{
              background: showDropdown ? "var(--bg-elevated)" : "transparent",
              border: `1px solid ${showDropdown ? "var(--border-default)" : "transparent"}`,
            }}
          >
            <div className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ background: "var(--accent-dim)", border: "1px solid var(--accent-mid)" }}>
              <span className="text-[10px] font-bold" style={{ color: "var(--accent)" }}>{market.symbol[0]}</span>
            </div>
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{market.pair}</span>
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
              <path d="M1 1L5 5L9 1" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {showDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setDropdown(false)} />
              <AssetMenu
                selected={market}
                onSelect={setMarket}
                onClose={() => setDropdown(false)}
              />
            </>
          )}
        </div>

        {/* Live price */}
        <LivePrice price={markPriceStr} loading={isLoading} />

        <span className="text-xs font-medium" style={{
          color: market.fundingPositive ? "var(--long)" : "var(--short)"
        }}>
          {market.mockChange}
        </span>

        {/* Divider */}
        <div className="w-px h-5 flex-shrink-0 hidden sm:block" style={{ background: "var(--border-default)" }} />

        {/* Stats row */}
        <div className="hidden lg:flex items-center gap-4 flex-wrap">
          <Stat label="Index"   value={`$${indexPriceStr}`}        loading={isLoading} />
          <Stat label="Mark"    value={`$${markPriceStr}`}          loading={isLoading} />
          <Stat label="Conf."   value={confidenceStr}               loading={isLoading} color="var(--info)" />
          <Stat label="Funding" value={market.mockFunding}          color={market.fundingPositive ? "var(--long)" : "var(--short)"} />
          <Stat label="OI"      value={market.mockOi}               />
          <Stat label="24h Vol" value={market.mockVol}              />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Regime badge */}
        <div
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg flex-shrink-0"
          style={{ background: rs.bg, border: `1px solid ${rs.text}20` }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{
              background: rs.glow,
              boxShadow: `0 0 6px ${rs.glow}`,
              animation: regimeNum === Regime.OPEN ? "live-pulse 2s ease-in-out infinite" : "none",
            }}
          />
          <span className="text-[10px] font-bold tracking-widest" style={{ color: rs.text, letterSpacing: "0.1em" }}>
            {rs.label}
          </span>
        </div>

        {/* Divider */}
        <div className="w-px h-5 flex-shrink-0" style={{ background: "var(--border-default)" }} />

        {/* Timeframes */}
        <div className="flex gap-0.5 flex-shrink-0">
          {TIMEFRAMES.map((t) => (
            <button
              key={t}
              onClick={() => setTf(t)}
              className="px-2 py-1 text-[11px] font-medium rounded transition-all duration-100"
              style={{
                background: t === tf ? "var(--bg-overlay)" : "transparent",
                color: t === tf ? "var(--text-primary)" : "var(--text-tertiary)",
                border: t === tf ? "1px solid var(--border-default)" : "1px solid transparent",
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── Chart body ── */}
      <div className="flex-1 min-h-0 relative">
        <CandlestickChart />
      </div>
    </div>
  );
}
