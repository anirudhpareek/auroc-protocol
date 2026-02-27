'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useVaultData, useVaultDeposit, useVaultWithdraw, useUsdcApproval } from '@/hooks/useVault';
import { formatUnits, parseUnits } from 'viem';

export function VaultPanel() {
  const { isConnected } = useAccount();
  const { sharePrice, utilization, totalAssets, userShares, isLoading } = useVaultData();
  const { deposit, isPending: depositPending, isConfirming: depositConfirming } = useVaultDeposit();
  const { withdraw, isPending: withdrawPending, isConfirming: withdrawConfirming } = useVaultWithdraw();
  const { allowance, approve, isPending: approvePending } = useUsdcApproval();

  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');

  const formatUsd = (amount: bigint, decimals: number = 6) => {
    const value = Number(formatUnits(amount, decimals));
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    });
  };

  const formatPercent = (value: bigint) => {
    const percent = Number(formatUnits(value, 16));
    return `${percent.toFixed(2)}%`;
  };

  const handleDeposit = () => {
    if (!depositAmount) return;
    const amount = parseUnits(depositAmount, 6);

    if (allowance < amount) {
      approve(amount * 2n);
    } else {
      deposit(depositAmount);
    }
  };

  const handleWithdraw = () => {
    if (!withdrawAmount) return;
    const shares = parseUnits(withdrawAmount, 18);
    withdraw(shares);
  };

  const userValue = userShares > 0n && sharePrice > 0n
    ? (userShares * sharePrice) / BigInt(1e18)
    : 0n;

  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 animate-pulse">
        <div className="h-6 bg-gray-700 rounded w-1/3 mb-4" />
        <div className="space-y-3">
          <div className="h-4 bg-gray-700 rounded w-full" />
          <div className="h-4 bg-gray-700 rounded w-2/3" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700">
      <div className="p-6 border-b border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">LP Vault</h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-400">Total Value Locked</p>
            <p className="text-xl font-semibold text-white">{formatUsd(totalAssets)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">Share Price</p>
            <p className="text-xl font-semibold text-white">{formatUsd(sharePrice, 18)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">Utilization</p>
            <p className="text-xl font-semibold text-white">{formatPercent(utilization)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">Your Value</p>
            <p className="text-xl font-semibold text-white">{formatUsd(userValue, 18)}</p>
          </div>
        </div>
      </div>

      {isConnected && (
        <div className="p-6">
          <div className="flex space-x-2 mb-4">
            <button
              onClick={() => setActiveTab('deposit')}
              className={`flex-1 py-2 px-4 rounded font-medium transition ${
                activeTab === 'deposit'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Deposit
            </button>
            <button
              onClick={() => setActiveTab('withdraw')}
              className={`flex-1 py-2 px-4 rounded font-medium transition ${
                activeTab === 'withdraw'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Withdraw
            </button>
          </div>

          {activeTab === 'deposit' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Amount (USDC)
                </label>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-gray-700 border border-gray-600 rounded px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <button
                onClick={handleDeposit}
                disabled={!depositAmount || depositPending || depositConfirming || approvePending}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-3 px-4 rounded font-medium transition"
              >
                {approvePending ? 'Approving...' :
                 depositPending ? 'Confirming...' :
                 depositConfirming ? 'Processing...' :
                 'Deposit'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Shares to Withdraw
                </label>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-gray-700 border border-gray-600 rounded px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Your shares: {formatUnits(userShares, 18)}
                </p>
              </div>
              <button
                onClick={handleWithdraw}
                disabled={!withdrawAmount || withdrawPending || withdrawConfirming}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-3 px-4 rounded font-medium transition"
              >
                {withdrawPending ? 'Confirming...' :
                 withdrawConfirming ? 'Processing...' :
                 'Withdraw'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
