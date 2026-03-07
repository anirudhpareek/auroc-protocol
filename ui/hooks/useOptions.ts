'use client';

import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { parseUnits } from 'viem';
import type { Address } from 'viem';
import { CONTRACTS_V3, OptionsPoolAbi, ERC20Abi, CONTRACTS } from '@/lib/contracts';
import { OptionLeg, Greeks, CollateralRequirement, OptionPosition } from '@/types';
import { computeGreeks } from '@/lib/options';

// ─── Read hooks ──────────────────────────────────────────────────────────────

/** Fetch all option position IDs for the connected trader */
export function useOptionPositionIds(trader?: Address) {
  return useReadContract({
    address: CONTRACTS_V3.optionsPool,
    abi:     OptionsPoolAbi,
    functionName: 'getTraderOptions',
    args:    trader ? [trader] : undefined,
    query:   { enabled: !!trader, refetchInterval: 10_000 },
  });
}

/** Fetch a single option position by ID */
export function useOptionPosition(positionId?: `0x${string}`) {
  return useReadContract({
    address: CONTRACTS_V3.optionsPool,
    abi:     OptionsPoolAbi,
    functionName: 'getOptionPosition',
    args:    positionId ? [positionId] : undefined,
    query:   { enabled: !!positionId && positionId !== '0x', refetchInterval: 10_000 },
  });
}

/** Fetch on-chain Greeks for a given market, strike, and option type */
export function useOnChainGreeks(
  marketId?: `0x${string}`,
  strike?: bigint,
  isCall?: boolean
) {
  return useReadContract({
    address: CONTRACTS_V3.optionsPool,
    abi:     OptionsPoolAbi,
    functionName: 'getGreeks',
    args:    marketId && strike !== undefined && isCall !== undefined
      ? [marketId, strike, isCall]
      : undefined,
    query:   { enabled: !!(marketId && strike !== undefined && isCall !== undefined), refetchInterval: 5_000 },
  });
}

/** Compute collateral required for a set of legs */
export function useCollateralRequired(legs: OptionLeg[]) {
  const encodedLegs = legs.map(l => ({
    marketId:   l.marketId,
    strike:     l.strike,
    optionType: l.optionType,
    side:       l.side,
    notional:   l.notional,
  }));

  return useReadContract({
    address: CONTRACTS_V3.optionsPool,
    abi:     OptionsPoolAbi,
    functionName: 'getRequiredCollateral',
    args:    legs.length > 0 ? [encodedLegs] : undefined,
    query:   { enabled: legs.length > 0, refetchInterval: 5_000 },
  });
}

/** Current value of an open option position (USDC 6 dec) */
export function useCurrentOptionValue(positionId?: `0x${string}`) {
  return useReadContract({
    address: CONTRACTS_V3.optionsPool,
    abi:     OptionsPoolAbi,
    functionName: 'getCurrentValue',
    args:    positionId ? [positionId] : undefined,
    query:   { enabled: !!positionId, refetchInterval: 10_000 },
  });
}

// ─── Client-side Greeks (instant, no RPC round-trip) ────────────────────────

/** Compute Greeks client-side (approximate, for UI preview while on-chain loads) */
export function useClientGreeks(params: {
  spot: bigint;
  strike: bigint;
  iv: bigint;
  isCall: boolean;
}): Greeks {
  const { spot, strike, iv, isCall } = params;
  if (!spot || !strike || !iv) {
    return { delta: 0n, gamma: 0n, theta: 0n, vega: 0n, iv: 0n, premium: 0n };
  }
  return computeGreeks({ spot, strike, iv, isCall });
}

// ─── Write hooks ─────────────────────────────────────────────────────────────

/** Approve USDC spend for options pool */
export function useApproveForOptions() {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const approve = (amount: bigint) =>
    writeContract({
      address: CONTRACTS.usdc,
      abi:     ERC20Abi,
      functionName: 'approve',
      args:    [CONTRACTS_V3.optionsPool, amount],
    });

  return { approve, isPending, isConfirming, isSuccess, hash };
}

/** Mint a new option position */
export function useMintOption() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const mint = (legs: OptionLeg[], maxCost: bigint) =>
    writeContract({
      address: CONTRACTS_V3.optionsPool,
      abi:     OptionsPoolAbi,
      functionName: 'mintOption',
      args:    [
        legs.map(l => ({
          marketId:   l.marketId,
          strike:     l.strike,
          optionType: l.optionType,
          side:       l.side,
          notional:   l.notional,
        })),
        maxCost,
      ],
    });

  return { mint, isPending, isConfirming, isSuccess, error, hash };
}

/** Burn (close) an existing option position */
export function useBurnOption() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const burn = (positionId: `0x${string}`, minPayout: bigint = 0n) =>
    writeContract({
      address: CONTRACTS_V3.optionsPool,
      abi:     OptionsPoolAbi,
      functionName: 'burnOption',
      args:    [positionId, minPayout],
    });

  return { burn, isPending, isConfirming, isSuccess, error, hash };
}

// ─── Compound hook: all open option positions for connected wallet ────────────

export function useOptionPositions() {
  const { address } = useAccount();
  const { data: ids, isLoading: idsLoading } = useOptionPositionIds(address);

  return {
    positionIds: (ids as `0x${string}`[]) ?? [],
    isLoading:   idsLoading,
  };
}
