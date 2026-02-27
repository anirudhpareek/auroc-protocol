'use client';

import { useTraderPositions, usePositionDetails } from '@/hooks/usePositions';
import { formatUnits } from 'viem';
import { MARKETS } from '@/lib/contracts';

function PositionRow({ positionId }: { positionId: `0x${string}` }) {
  const { position, equity, isLoading } = usePositionDetails(positionId);

  if (isLoading || !position) {
    return (
      <tr className="animate-pulse">
        <td colSpan={6} className="px-4 py-3">
          <div className="h-4 bg-gray-700 rounded w-full" />
        </td>
      </tr>
    );
  }

  const isLong = position.size > 0n;
  const sizeAbs = isLong ? position.size : -position.size;
  const pnl = equity?.totalEquity ? equity.totalEquity - BigInt(position.margin) : 0n;
  const pnlPositive = pnl > 0n;

  const getMarketSymbol = (marketId: `0x${string}`) => {
    if (marketId === MARKETS.XAU_USD) return 'XAU/USD';
    if (marketId === MARKETS.SPX_USD) return 'SPX/USD';
    return 'Unknown';
  };

  const formatPrice = (price: bigint) => {
    const value = Number(formatUnits(price, 18));
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    });
  };

  const formatUsd = (amount: bigint, decimals: number = 6) => {
    const value = Number(formatUnits(amount, decimals));
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    });
  };

  return (
    <tr className="border-b border-gray-700 hover:bg-gray-800/50">
      <td className="px-4 py-3 text-white">
        {getMarketSymbol(position.marketId)}
      </td>
      <td className="px-4 py-3">
        <span className={isLong ? 'text-green-400' : 'text-red-400'}>
          {isLong ? 'Long' : 'Short'}
        </span>
      </td>
      <td className="px-4 py-3 text-white">
        {formatUnits(sizeAbs, 18)}
      </td>
      <td className="px-4 py-3 text-white">
        {formatPrice(position.entryPrice)}
      </td>
      <td className="px-4 py-3 text-white">
        {formatUsd(position.margin)}
      </td>
      <td className="px-4 py-3">
        <span className={pnlPositive ? 'text-green-400' : 'text-red-400'}>
          {pnlPositive ? '+' : ''}{formatUsd(pnl, 18)}
        </span>
      </td>
      <td className="px-4 py-3">
        {equity?.isLiquidatable && (
          <span className="text-red-500 text-xs font-medium">
            At Risk
          </span>
        )}
      </td>
    </tr>
  );
}

export function PositionList() {
  const { positionIds, isLoading } = useTraderPositions();

  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-700 rounded w-1/4" />
          <div className="h-20 bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  if (positionIds.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-center">
        <p className="text-gray-400">No open positions</p>
        <p className="text-sm text-gray-500 mt-2">
          Open a position to start trading
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-900">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
              Market
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
              Side
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
              Size
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
              Entry
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
              Margin
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
              PnL
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {positionIds.map((id) => (
            <PositionRow key={id} positionId={id} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
