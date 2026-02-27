'use client';

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CONTRACTS, VaultAbi, ERC20Abi } from '@/lib/contracts';
import { parseUnits } from 'viem';

export function useVaultData() {
  const { address } = useAccount();

  const { data: sharePrice, isLoading: l1 } = useReadContract({
    address: CONTRACTS.vault,
    abi: VaultAbi,
    functionName: 'getSharePrice',
    query: { refetchInterval: 10000 },
  });

  const { data: utilization, isLoading: l2 } = useReadContract({
    address: CONTRACTS.vault,
    abi: VaultAbi,
    functionName: 'getUtilization',
    query: { refetchInterval: 10000 },
  });

  const { data: totalAssets, isLoading: l3 } = useReadContract({
    address: CONTRACTS.vault,
    abi: VaultAbi,
    functionName: 'totalAssets',
    query: { refetchInterval: 10000 },
  });

  const { data: userShares, isLoading: l4, refetch } = useReadContract({
    address: CONTRACTS.vault,
    abi: VaultAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 10000,
    },
  });

  return {
    sharePrice: (sharePrice as bigint) || 0n,
    utilization: (utilization as bigint) || 0n,
    totalAssets: (totalAssets as bigint) || 0n,
    userShares: (userShares as bigint) || 0n,
    isLoading: l1 || l2 || l3 || l4,
    refetch,
  };
}

export function useVaultDeposit() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const deposit = (amountUsdc: string) => {
    const amount = parseUnits(amountUsdc, 6);
    writeContract({
      address: CONTRACTS.vault,
      abi: VaultAbi,
      functionName: 'deposit',
      args: [amount],
    });
  };

  return {
    deposit,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
  };
}

export function useVaultWithdraw() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const withdraw = (shares: bigint) => {
    writeContract({
      address: CONTRACTS.vault,
      abi: VaultAbi,
      functionName: 'withdraw',
      args: [shares],
    });
  };

  return {
    withdraw,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
  };
}

export function useUsdcApproval() {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const { data: allowance } = useReadContract({
    address: CONTRACTS.usdc,
    abi: ERC20Abi,
    functionName: 'allowance',
    args: address ? [address, CONTRACTS.vault] : undefined,
    query: { enabled: !!address },
  });

  const approve = (amount: bigint) => {
    writeContract({
      address: CONTRACTS.usdc,
      abi: ERC20Abi,
      functionName: 'approve',
      args: [CONTRACTS.vault, amount],
    });
  };

  return {
    allowance: (allowance as bigint) || 0n,
    approve,
    isPending,
    isConfirming,
    isSuccess,
  };
}
