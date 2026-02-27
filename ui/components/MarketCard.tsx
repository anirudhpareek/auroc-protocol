'use client';

import { MarketInfo, RegimeLabels, RegimeColors } from '@/types';
import { formatUnits } from 'viem';

interface MarketCardProps {
  market: MarketInfo;
  onTrade?: (marketId: `0x${string}`) => void;
}

export function MarketCard({ market, onTrade }: MarketCardProps) {
  const formatPrice = (price: bigint) => {
    const value = Number(formatUnits(price, 18));
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatConfidence = (confidence: bigint) => {
    const value = Number(formatUnits(confidence, 18)) * 100;
    return `${value.toFixed(1)}%`;
  };

  const regimeLabel = RegimeLabels[market.regime];
  const regimeColor = RegimeColors[market.regime];

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-gray-600 transition">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">{market.name}</h3>
          <p className="text-sm text-gray-400">{market.symbol}</p>
        </div>
        <span className={`${regimeColor} text-white text-xs px-2 py-1 rounded`}>
          {regimeLabel}
        </span>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between">
          <span className="text-gray-400">Mark Price</span>
          <span className="text-white font-medium">{formatPrice(market.markPrice)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Index Price</span>
          <span className="text-white font-medium">{formatPrice(market.indexPrice)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Confidence</span>
          <span className="text-white font-medium">{formatConfidence(market.confidence)}</span>
        </div>
      </div>

      {onTrade && (
        <div className="mt-4 flex space-x-2">
          <button
            onClick={() => onTrade(market.id)}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded font-medium transition"
          >
            Long
          </button>
          <button
            onClick={() => onTrade(market.id)}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded font-medium transition"
          >
            Short
          </button>
        </div>
      )}
    </div>
  );
}
