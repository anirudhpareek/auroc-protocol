'use client';

import { useReadContracts } from 'wagmi';
import { CONTRACTS, MARKETS, IndexEngineAbi } from '@/lib/contracts';
import { MarketInfo, Regime } from '@/types';

export function useMarketData(marketId: `0x${string}`) {
  const { data, isLoading, error, refetch } = useReadContracts({
    contracts: [
      {
        address: CONTRACTS.indexEngine,
        abi: IndexEngineAbi,
        functionName: 'getIndexPrice',
        args: [marketId],
      },
      {
        address: CONTRACTS.indexEngine,
        abi: IndexEngineAbi,
        functionName: 'getMarkPrice',
        args: [marketId],
      },
      {
        address: CONTRACTS.indexEngine,
        abi: IndexEngineAbi,
        functionName: 'getRegime',
        args: [marketId],
      },
      {
        address: CONTRACTS.indexEngine,
        abi: IndexEngineAbi,
        functionName: 'getConfidence',
        args: [marketId],
      },
    ],
    query: {
      refetchInterval: 5000,
    },
  });

  const marketInfo: MarketInfo | null = data ? {
    id: marketId,
    symbol: marketId === MARKETS.XAU_USD ? 'XAU/USD' : 'SPX/USD',
    name: marketId === MARKETS.XAU_USD ? 'Gold' : 'S&P 500',
    indexPrice: (data[0]?.result as bigint) || 0n,
    markPrice: (data[1]?.result as bigint) || 0n,
    regime: ((data[2]?.result as number) || 0) as Regime,
    confidence: (data[3]?.result as bigint) || 0n,
  } : null;

  return {
    marketInfo,
    isLoading,
    error,
    refetch,
  };
}

export function useAllMarkets() {
  const xauData = useMarketData(MARKETS.XAU_USD);
  const spxData = useMarketData(MARKETS.SPX_USD);

  return {
    markets: [xauData.marketInfo, spxData.marketInfo].filter(Boolean) as MarketInfo[],
    isLoading: xauData.isLoading || spxData.isLoading,
    error: xauData.error || spxData.error,
    refetch: () => {
      xauData.refetch();
      spxData.refetch();
    },
  };
}
