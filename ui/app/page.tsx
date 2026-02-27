'use client';

import { useAllMarkets } from '@/hooks/useMarketData';
import { MarketCard } from '@/components/MarketCard';
import { PositionList } from '@/components/PositionList';
import { VaultPanel } from '@/components/VaultPanel';
import { TradePanel } from '@/components/TradePanel';
import { useAccount } from 'wagmi';

export default function Home() {
  const { isConnected } = useAccount();
  const { markets, isLoading } = useAllMarkets();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <section id="markets" className="mb-12">
        <h2 className="text-2xl font-bold text-white mb-6">Markets</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {isLoading ? (
            <>
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 animate-pulse h-48" />
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 animate-pulse h-48" />
            </>
          ) : (
            markets.map((market) => (
              <MarketCard key={market.id} market={market} />
            ))
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section id="positions">
            <h2 className="text-2xl font-bold text-white mb-6">Your Positions</h2>
            {isConnected ? (
              <PositionList />
            ) : (
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-center">
                <p className="text-gray-400">Connect wallet to view positions</p>
              </div>
            )}
          </section>

          <section id="vault">
            <h2 className="text-2xl font-bold text-white mb-6">Liquidity Pool</h2>
            <VaultPanel />
          </section>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-white mb-6">Trade</h2>
          <TradePanel />
        </div>
      </div>

      <footer className="mt-16 pt-8 border-t border-gray-800">
        <div className="text-center text-gray-500 text-sm">
          <p>RWA Perp DEX - 24/7 Perpetual Futures for Real World Assets</p>
          <p className="mt-2">Testnet only - Arbitrum Sepolia</p>
        </div>
      </footer>
    </div>
  );
}
