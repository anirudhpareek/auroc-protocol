'use client';

import { useAccount, useReadContract, useReadContracts } from 'wagmi';
import { CONTRACTS, PerpEngineAbi } from '@/lib/contracts';
import { Position, PositionEquity } from '@/types';

export function useTraderPositions() {
  const { address } = useAccount();

  const { data: positionIds, isLoading: idsLoading, refetch } = useReadContract({
    address: CONTRACTS.perpEngine,
    abi: PerpEngineAbi,
    functionName: 'getTraderPositions',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 10000,
    },
  });

  return {
    positionIds: (positionIds as `0x${string}`[]) || [],
    isLoading: idsLoading,
    refetch,
  };
}

export function usePositionDetails(positionId: `0x${string}`) {
  const { data, isLoading, error, refetch } = useReadContracts({
    contracts: [
      {
        address: CONTRACTS.perpEngine,
        abi: PerpEngineAbi,
        functionName: 'getPosition',
        args: [positionId],
      },
      {
        address: CONTRACTS.perpEngine,
        abi: PerpEngineAbi,
        functionName: 'getPositionEquity',
        args: [positionId],
      },
    ],
    query: {
      refetchInterval: 5000,
    },
  });

  const position: Position | null = data?.[0]?.result as Position | null;
  const equity: PositionEquity | null = data?.[1]?.result as PositionEquity | null;

  return {
    position,
    equity,
    isLoading,
    error,
    refetch,
  };
}
