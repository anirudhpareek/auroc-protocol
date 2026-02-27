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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border-subtle)]">
        <h2 className="text-[var(--text-sm)] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
          Markets
        </h2>
        <div className="relative">
          <input
            type="text"
            placeholder="Search markets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              "w-full h-9 pl-9 pr-3",
              "bg-[var(--bg-elevated)]",
              "border border-[var(--border-default)]",
              "rounded-[var(--radius-md)]",
              "text-[var(--text-sm)]",
              "placeholder:text-[var(--text-muted)]",
              "focus:outline-none focus:border-[var(--accent-primary)]"
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
          <div className="p-4 space-y-2">
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
          <div className="p-2">
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
        "w-full p-3 mb-1",
        "rounded-[var(--radius-md)]",
        "text-left",
        "transition-colors duration-[var(--transition-fast)]",
        isSelected
          ? "bg-[var(--bg-active)] border border-[var(--accent-primary)]"
          : "bg-transparent hover:bg-[var(--bg-hover)] border border-transparent"
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-base)] font-semibold">
            {market.symbol}
          </span>
          <RegimeBadge regime={market.regime} />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="price-display text-[var(--text-lg)]">
          ${market.price}
        </span>
        <span
          className={cn(
            "text-[var(--text-sm)] tabular-nums font-medium",
            isPositive ? "text-[var(--color-long)]" : "text-[var(--color-short)]"
          )}
        >
          {isPositive ? "+" : ""}
          {market.change24h.toFixed(2)}%
        </span>
      </div>

      <div className="flex items-center justify-between mt-1">
        <span className="text-[var(--text-xs)] text-[var(--text-muted)]">
          {market.name}
        </span>
        <span className="text-[var(--text-xs)] text-[var(--text-muted)]">
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
      <div className="h-14 flex items-center px-4 border-b border-[var(--border-subtle)]">
        <div className="skeleton h-6 w-32" />
      </div>
    );
  }

  const isPositive = market.change24h >= 0;

  return (
    <div className="h-14 flex items-center gap-6 px-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-x-auto">
      {/* Symbol & Price */}
      <div className="flex items-center gap-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-lg)] font-semibold">
            {market.symbol}
          </span>
          <RegimeBadge regime={market.regime} />
        </div>

        <div className="flex items-baseline gap-2">
          <span className="price-display text-[var(--text-xl)] font-semibold">
            ${market.price}
          </span>
          <span
            className={cn(
              "text-[var(--text-sm)] tabular-nums font-medium",
              isPositive ? "text-[var(--color-long)]" : "text-[var(--color-short)]"
            )}
          >
            {isPositive ? "+" : ""}
            {market.change24h.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="h-8 w-px bg-[var(--border-subtle)]" />

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
        <InfoStat label="Next Funding" value={nextFunding || "00:42:15"} />
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
}

function InfoStat({ label, value, prefix, suffix, highlight }: InfoStatProps) {
  return (
    <div className="flex flex-col">
      <span className="text-[var(--text-xs)] text-[var(--text-muted)]">
        {label}
      </span>
      <span
        className={cn(
          "text-[var(--text-sm)] tabular-nums font-medium",
          highlight === true && "text-[var(--color-long)]",
          highlight === false && "text-[var(--color-short)]"
        )}
      >
        {prefix}
        {value}
        {suffix}
      </span>
    </div>
  );
}
