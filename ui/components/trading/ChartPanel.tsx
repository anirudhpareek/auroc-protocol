"use client";

import { useState } from "react";

const assets = [
  { symbol: "BTC", name: "Bitcoin", price: "97,432.50", change: "+2.34%" },
  { symbol: "XAU", name: "Gold", price: "2,892.40", change: "+0.45%" },
  { symbol: "SPX", name: "S&P 500", price: "5,234.18", change: "-0.12%" },
];

const timeframes = ["1m", "5m", "15m", "1H", "4H", "1D"];

export function ChartPanel() {
  const [selectedAsset, setSelectedAsset] = useState(assets[0]);
  const [selectedTimeframe, setSelectedTimeframe] = useState("15m");
  const [showAssetDropdown, setShowAssetDropdown] = useState(false);

  return (
    <div className="h-full flex flex-col bg-[var(--black)]">
      {/* Chart Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--gray-900)]">
        {/* Asset Selector */}
        <div className="relative">
          <button
            onClick={() => setShowAssetDropdown(!showAssetDropdown)}
            className="flex items-center gap-3 hover:bg-[var(--gray-900)] px-3 py-1.5 rounded-lg transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-[var(--yellow)] flex items-center justify-center">
                <span className="text-black text-xs font-bold">
                  {selectedAsset.symbol[0]}
                </span>
              </div>
              <span className="font-semibold">{selectedAsset.symbol}/USD</span>
            </div>
            <svg
              className="w-4 h-4 text-[var(--gray-500)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {showAssetDropdown && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-[var(--gray-900)] border border-[var(--gray-800)] rounded-lg shadow-xl z-50">
              {assets.map((asset) => (
                <button
                  key={asset.symbol}
                  onClick={() => {
                    setSelectedAsset(asset);
                    setShowAssetDropdown(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--gray-800)] transition-colors first:rounded-t-lg last:rounded-b-lg"
                >
                  <div className="w-6 h-6 rounded-full bg-[var(--yellow)] flex items-center justify-center">
                    <span className="text-black text-xs font-bold">
                      {asset.symbol[0]}
                    </span>
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium">{asset.symbol}/USD</div>
                    <div className="text-xs text-[var(--gray-500)]">{asset.name}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Price & Stats */}
        <div className="flex items-center gap-6">
          <div>
            <span className="text-lg font-semibold tabular">
              ${selectedAsset.price}
            </span>
            <span
              className={`ml-2 text-sm ${
                selectedAsset.change.startsWith("+")
                  ? "text-[var(--green)]"
                  : "text-[var(--red)]"
              }`}
            >
              {selectedAsset.change}
            </span>
          </div>

          <div className="hidden lg:flex items-center gap-6 text-xs">
            <div>
              <span className="text-[var(--gray-500)]">24h Vol</span>
              <span className="ml-2 text-white tabular">$1.2B</span>
            </div>
            <div>
              <span className="text-[var(--gray-500)]">Open Interest</span>
              <span className="ml-2 text-white tabular">$458M</span>
            </div>
            <div>
              <span className="text-[var(--gray-500)]">Funding</span>
              <span className="ml-2 text-[var(--green)] tabular">+0.0125%</span>
            </div>
          </div>
        </div>

        {/* Timeframe Selector */}
        <div className="flex gap-1">
          {timeframes.map((tf) => (
            <button
              key={tf}
              onClick={() => setSelectedTimeframe(tf)}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                selectedTimeframe === tf
                  ? "bg-[var(--gray-800)] text-white"
                  : "text-[var(--gray-500)] hover:text-white"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Area */}
      <div className="flex-1 flex items-center justify-center bg-[var(--gray-950)]">
        <div className="text-center">
          <div className="text-[var(--gray-600)] text-sm mb-2">
            TradingView Chart
          </div>
          <div className="text-[var(--gray-700)] text-xs">
            Connect TradingView widget here
          </div>
        </div>
      </div>
    </div>
  );
}
