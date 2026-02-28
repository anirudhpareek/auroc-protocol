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
      <div className="p-3 border-b border-[var(--border-subtle)]">
        <h2 className="text-[var(--text-2xs)] font-medium text-[var(--text-muted)] uppercase tracking-widest mb-2">
          Markets
        </h2>
        <div className="relative">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              "w-full h-8 pl-8 pr-3",
              "bg-[var(--bg-void)]",
              "border border-[var(--border-subtle)]",
              "rounded-[var(--radius-md)]",
              "text-[var(--text-xs)]",
              "placeholder:text-[var(--text-muted)]",
              "focus:outline-none focus:border-[var(--accent-primary)]",
              "transition-colors duration-[var(--transition-fast)]"
            )}
          />
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]"
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
          <div className="p-2 space-y-1">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-14 rounded-[var(--radius-sm)] skeleton"
              />
            ))}
          </div>
        ) : filteredMarkets.length === 0 ? (
          <div className="p-4 text-center text-[var(--text-muted)] text-[var(--text-xs)]">
            No markets found
          </div>
        ) : (
          <div className="p-1.5 space-y-0.5">
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
        "w-full px-3 py-2.5",
        "rounded-[var(--radius-sm)]",
        "text-left",
        "transition-colors duration-[var(--transition-fast)]",
        isSelected
          ? "bg-[var(--accent-primary-subtle)] border-l-2 border-l-[var(--accent-primary)]"
          : "bg-transparent hover:bg-[var(--bg-hover)] border-l-2 border-l-transparent"
      )}
    >
      <div className="flex items-center justify-between mb-1">
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
          "price-display text-[var(--text-base)]",
          isPositive ? "price-up" : "price-down"
        )}>
          ${market.price}
        </span>
        <span
          className={cn(
            "text-[var(--text-2xs)] tabular-nums font-semibold",
            isPositive ? "text-[var(--color-long)]" : "text-[var(--color-short)]"
          )}
        >
          {isPositive ? "+" : ""}
          {market.change24h.toFixed(2)}%
        </span>
      </div>

      <div className="flex items-center justify-between mt-1">
        <span className="text-[var(--text-2xs)] text-[var(--text-muted)]">
          {market.name}
        </span>
        <span className="text-[var(--text-2xs)] text-[var(--text-muted)] tabular-nums">
          Vol ${market.volume24h}
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
        <div className="skeleton h-5 w-32" />
      </div>
    );
  }

  const isPositive = market.change24h >= 0;

  return (
    <div className="h-14 flex items-center gap-5 px-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-x-auto">
      {/* Symbol & Price */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-base)] font-bold tracking-tight">
            {market.symbol}
          </span>
          <RegimeBadge regime={market.regime} />
        </div>

        <div className="flex items-baseline gap-2">
          <span className={cn(
            "price-display text-[var(--text-xl)] font-bold tracking-tight",
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
      </div>

      {/* Divider */}
      <div className="h-7 w-px bg-[var(--border-default)] flex-shrink-0" />

      {/* Stats */}
      <div className="flex items-center gap-5 flex-shrink-0">
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
