'use client';

import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { CONTRACTS, MARKETS, PerpEngineAbi, ERC20Abi } from '@/lib/contracts';
import { useMarketData } from '@/hooks/useMarketData';

export function TradePanel() {
  const { isConnected } = useAccount();
  const [selectedMarket, setSelectedMarket] = useState<`0x${string}`>(MARKETS.XAU_USD);
  const [side, setSide] = useState<'long' | 'short'>('long');
  const [size, setSize] = useState('');
  const [margin, setMargin] = useState('');

  const { marketInfo } = useMarketData(selectedMarket);
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const handleTrade = async () => {
    if (!size || !margin) return;

    const sizeWad = parseUnits(size, 18);
    const marginUsdc = parseUnits(margin, 6);
    const positionSize = side === 'long' ? sizeWad : -sizeWad;

    // First approve USDC
    writeContract({
      address: CONTRACTS.usdc,
      abi: ERC20Abi,
      functionName: 'approve',
      args: [CONTRACTS.perpEngine, marginUsdc],
    });

    // Then open position (in practice, wait for approval)
    writeContract({
      address: CONTRACTS.perpEngine,
      abi: PerpEngineAbi,
      functionName: 'openPosition',
      args: [selectedMarket, positionSize, marginUsdc],
    });
  };

  const formatPrice = (price: bigint) => {
    return Number(formatUnits(price, 18)).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });
  };

  const leverage = margin && size && marketInfo?.markPrice
    ? (Number(size) * Number(formatUnits(marketInfo.markPrice, 18))) / Number(margin)
    : 0;

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700">
      <div className="p-6 border-b border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Open Position</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Market</label>
            <select
              value={selectedMarket}
              onChange={(e) => setSelectedMarket(e.target.value as `0x${string}`)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-4 py-2 text-white focus:outline-none focus:border-purple-500"
            >
              <option value={MARKETS.XAU_USD}>XAU/USD - Gold</option>
              <option value={MARKETS.SPX_USD}>SPX/USD - S&P 500</option>
            </select>
          </div>

          {marketInfo && (
            <div className="text-sm text-gray-400">
              Mark Price: {formatPrice(marketInfo.markPrice)}
            </div>
          )}

          <div className="flex space-x-2">
            <button
              onClick={() => setSide('long')}
              className={`flex-1 py-2 px-4 rounded font-medium transition ${
                side === 'long'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Long
            </button>
            <button
              onClick={() => setSide('short')}
              className={`flex-1 py-2 px-4 rounded font-medium transition ${
                side === 'short'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Short
            </button>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Size</label>
            <input
              type="number"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              placeholder="0.00"
              className="w-full bg-gray-700 border border-gray-600 rounded px-4 py-2 text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Margin (USDC)</label>
            <input
              type="number"
              value={margin}
              onChange={(e) => setMargin(e.target.value)}
              placeholder="0.00"
              className="w-full bg-gray-700 border border-gray-600 rounded px-4 py-2 text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          {leverage > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Leverage</span>
              <span className={`font-medium ${leverage > 5 ? 'text-yellow-400' : 'text-white'}`}>
                {leverage.toFixed(2)}x
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="p-6">
        {isConnected ? (
          <button
            onClick={handleTrade}
            disabled={!size || !margin || isPending || isConfirming}
            className={`w-full py-3 px-4 rounded font-medium transition ${
              side === 'long'
                ? 'bg-green-600 hover:bg-green-700 disabled:bg-gray-600'
                : 'bg-red-600 hover:bg-red-700 disabled:bg-gray-600'
            } disabled:cursor-not-allowed text-white`}
          >
            {isPending ? 'Confirming...' :
             isConfirming ? 'Processing...' :
             isSuccess ? 'Success!' :
             `Open ${side.charAt(0).toUpperCase() + side.slice(1)}`}
          </button>
        ) : (
          <p className="text-center text-gray-400">
            Connect wallet to trade
          </p>
        )}
      </div>
    </div>
  );
}
