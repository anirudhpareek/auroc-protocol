"use client";

import { useMemo } from "react";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { CONTRACTS, PerpEngineAbi } from "@/lib/contracts";

interface Position {
  trader: `0x${string}`;
  assetId: `0x${string}`;
  size: bigint;
  entryPrice: bigint;
  margin: bigint;
  fundingAccum: bigint;
  openTimestamp: bigint;
  isLong: boolean;
}

interface PositionEquity {
  equity: bigint;
  unrealizedPnL: bigint;
  fundingOwed: bigint;
  marginRatio: bigint;
}

export function useTraderPositions() {
  const { address } = useAccount();

  const {
    data: positionIds,
    isLoading: idsLoading,
    refetch,
  } = useReadContract({
    address: CONTRACTS.perpEngine,
    abi: PerpEngineAbi,
    functionName: "getTraderPositions",
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
        functionName: "getPosition",
        args: [positionId],
      },
      {
        address: CONTRACTS.perpEngine,
        abi: PerpEngineAbi,
        functionName: "getPositionEquity",
        args: [positionId],
      },
    ],
    query: {
      refetchInterval: 5000,
    },
  });

  const position = data?.[0]?.result as Position | undefined;
  const equity = data?.[1]?.result as PositionEquity | undefined;

  return {
    position,
    equity,
    isLoading,
    error,
    refetch,
  };
}

// Combined hook that fetches position IDs and all their details
export function usePositions(traderAddress?: `0x${string}`) {
  const { address: connectedAddress } = useAccount();
  const address = traderAddress || connectedAddress;

  const {
    data: positionIds,
    isLoading: idsLoading,
    refetch: refetchIds,
  } = useReadContract({
    address: CONTRACTS.perpEngine,
    abi: PerpEngineAbi,
    functionName: "getTraderPositions",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 10000,
    },
  });

  const ids = (positionIds as `0x${string}`[]) || [];

  // Build contracts array for batch fetching
  const contracts = useMemo(() => {
    return ids.flatMap((id) => [
      {
        address: CONTRACTS.perpEngine,
        abi: PerpEngineAbi,
        functionName: "getPosition" as const,
        args: [id] as const,
      },
      {
        address: CONTRACTS.perpEngine,
        abi: PerpEngineAbi,
        functionName: "getPositionEquity" as const,
        args: [id] as const,
      },
    ]);
  }, [ids]);

  const { data: positionsData, isLoading: positionsLoading } = useReadContracts({
    contracts: contracts.length > 0 ? contracts : undefined,
    query: {
      enabled: contracts.length > 0,
      refetchInterval: 5000,
    },
  });

  // Transform data into usable format
  const positions = useMemo(() => {
    if (!positionsData || ids.length === 0) return [];

    return ids.map((id, index) => {
      const positionResult = positionsData[index * 2];
      const equityResult = positionsData[index * 2 + 1];

      const position = positionResult?.result as Position | undefined;
      const equity = equityResult?.result as PositionEquity | undefined;

      return {
        id,
        position,
        equity,
        // Convenience fields
        size: position?.size || 0n,
        entryPrice: position?.entryPrice || 0n,
        margin: position?.margin || 0n,
        isLong: position?.isLong ?? true,
        unrealizedPnL: equity?.unrealizedPnL || 0n,
        marginRatio: equity?.marginRatio || 0n,
      };
    });
  }, [ids, positionsData]);

  return {
    positions,
    positionIds: ids,
    isLoading: idsLoading || positionsLoading,
    refetch: refetchIds,
  };
}
