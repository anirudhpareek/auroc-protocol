"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { RegimeBadge, type RegimeType } from "@/components/ui";

interface Market {
  id: string;
  name: string;
  symbol: string;
  price: string;
  change24h: number;
  regime: RegimeType;
  volume24h: string;
}

interface MarketSelectorProps {
  markets: Market[];
  selectedMarket: string;
  onSelectMarket: (marketId: string) => void;
  isLoading?: boolean;
}

export function MarketSelector({
  markets,
  selectedMarket,
  onSelectMarket,
  isLoading = false,
}: MarketSelectorProps) {
  const [search, setSearch] = useState("");

  const filteredMarkets = markets.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.symbol.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-[var(--bg-surface)]/60 backdrop-blur-sm">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border-subtle)]">
        <h2 className="text-[var(--text-2xs)] font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-3">
          Markets
        </h2>
        <div className="relative">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              "w-full h-9 pl-9 pr-3",
              "bg-[var(--bg-void)]",
              "border border-[var(--border-subtle)]",
              "rounded-[var(--radius-md)]",
              "text-[var(--text-sm)]",
              "placeholder:text-[var(--text-muted)]",
              "focus:outline-none focus:border-[var(--accent-primary)]",
              "focus:shadow-[0_0_0_3px_var(--accent-primary-subtle)]",
              "transition-all duration-200"
            )}
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      {/* Market List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-3 space-y-2">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-16 rounded-[var(--radius-md)] skeleton"
              />
            ))}
          </div>
        ) : filteredMarkets.length === 0 ? (
          <div className="p-4 text-center text-[var(--text-muted)] text-[var(--text-sm)]">
            No markets found
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filteredMarkets.map((market) => (
              <MarketItem
                key={market.id}
                market={market}
                isSelected={market.id === selectedMarket}
                onClick={() => onSelectMarket(market.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface MarketItemProps {
  market: Market;
  isSelected: boolean;
  onClick: () => void;
}

function MarketItem({ market, isSelected, onClick }: MarketItemProps) {
  const isPositive = market.change24h >= 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full p-3",
        "rounded-[var(--radius-md)]",
        "text-left",
        "transition-all duration-200",
        isSelected
          ? "bg-[var(--accent-primary-subtle)] border border-[var(--accent-primary)] shadow-[0_0_12px_-4px_var(--accent-primary-glow)]"
          : "bg-transparent hover:bg-[var(--bg-hover)] border border-transparent"
      )}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-[var(--text-sm)] font-semibold tracking-tight",
            isSelected && "text-[var(--accent-primary)]"
          )}>
            {market.symbol}
          </span>
          <RegimeBadge regime={market.regime} />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className={cn(
          "price-display text-[var(--text-lg)] font-semibold",
          isPositive ? "price-up" : "price-down"
        )}>
          ${market.price}
        </span>
        <span
          className={cn(
            "text-[var(--text-xs)] tabular-nums font-semibold",
            isPositive ? "text-[var(--color-long)]" : "text-[var(--color-short)]"
          )}
        >
          {isPositive ? "+" : ""}
          {market.change24h.toFixed(2)}%
        </span>
      </div>

      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[var(--text-2xs)] text-[var(--text-muted)]">
          {market.name}
        </span>
        <span className="text-[var(--text-2xs)] text-[var(--text-muted)] tabular-nums">
          Vol: ${market.volume24h}
        </span>
      </div>
    </button>
  );
}

// Market info header for display above chart
interface MarketInfoProps {
  market: Market | null;
  markPrice?: string;
  indexPrice?: string;
  fundingRate?: string;
  nextFunding?: string;
}

export function MarketInfo({
  market,
  markPrice,
  indexPrice,
  fundingRate,
  nextFunding,
}: MarketInfoProps) {
  if (!market) {
    return (
      <div className="h-16 flex items-center px-4 border-b border-[var(--border-subtle)]">
        <div className="skeleton h-6 w-32" />
      </div>
    );
  }

  const isPositive = market.change24h >= 0;

  return (
    <div className="h-16 flex items-center gap-6 px-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/80 backdrop-blur-sm overflow-x-auto">
      {/* Symbol & Price */}
      <div className="flex items-center gap-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-lg)] font-bold tracking-tight">
            {market.symbol}
          </span>
          <RegimeBadge regime={market.regime} />
        </div>

        <div className="flex items-baseline gap-2">
          <span className={cn(
            "price-display text-[var(--text-2xl)] font-bold tracking-tight",
            isPositive ? "price-up" : "price-down"
          )}>
            ${market.price}
          </span>
          <span
            className={cn(
              "text-[var(--text-sm)] tabular-nums font-semibold",
              isPositive ? "text-[var(--color-long)]" : "text-[var(--color-short)]"
            )}
          >
            {isPositive ? "+" : ""}
            {market.change24h.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="h-8 w-px bg-[var(--border-default)]" />

      {/* Stats */}
      <div className="flex items-center gap-6 flex-shrink-0">
        <InfoStat label="Mark" value={markPrice || market.price} prefix="$" />
        <InfoStat label="Index" value={indexPrice || market.price} prefix="$" />
        <InfoStat
          label="Funding"
          value={fundingRate || "0.0100"}
          suffix="%"
          highlight={fundingRate ? parseFloat(fundingRate) > 0 : undefined}
        />
        <InfoStat label="Next Funding" value={nextFunding || "00:42:15"} mono />
      </div>
    </div>
  );
}

interface InfoStatProps {
  label: string;
  value: string;
  prefix?: string;
  suffix?: string;
  highlight?: boolean;
  mono?: boolean;
}

function InfoStat({ label, value, prefix, suffix, highlight, mono }: InfoStatProps) {
  return (
    <div className="flex flex-col">
      <span className="text-[var(--text-2xs)] text-[var(--text-muted)] uppercase tracking-wider">
        {label}
      </span>
      <span
        className={cn(
          "text-[var(--text-sm)] font-medium",
          mono ? "font-mono" : "tabular-nums",
          highlight === true && "text-[var(--color-long)]",
          highlight === false && "text-[var(--color-short)]",
          highlight === undefined && "text-[var(--text-primary)]"
        )}
      >
        {prefix}
        {value}
        {suffix}
      </span>
    </div>
  );
}
