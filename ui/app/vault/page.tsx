"use client";

import { Header } from "@/components/layout";
import { VaultPage } from "@/components/trading";
import { useVault } from "@/hooks/useVault";
import { useToast } from "@/components/ui/toast";

export default function VaultRoute() {
  const { addToast } = useToast();
  const {
    sharePrice,
    totalAssets,
    userShares,
    isLoading,
    deposit,
    withdraw,
  } = useVault();

  const handleDeposit = async (amount: string) => {
    try {
      await deposit(parseFloat(amount));
      addToast({
        type: "success",
        title: "Deposit Successful",
        description: `Deposited ${amount} USDC`,
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Deposit Failed",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const handleWithdraw = async (shares: string) => {
    try {
      await withdraw(parseFloat(shares));
      addToast({
        type: "success",
        title: "Withdrawal Successful",
        description: `Withdrew ${shares} LP shares`,
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Withdrawal Failed",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  // Format vault data
  const vaultData = {
    totalDeposits: totalAssets
      ? (Number(totalAssets) / 1e6).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : "0.00",
    sharePrice: sharePrice
      ? (Number(sharePrice) / 1e18).toFixed(4)
      : "1.0000",
    totalShares: "0.00",
    apr: "12.5",
    utilization: "65.4",
    tradingVolume24h: "5,432,100.00",
    fees24h: "2,716.05",
    traderPnL24h: -1234.56,
  };

  const userPosition = userShares
    ? {
        shares: (Number(userShares) / 1e18).toFixed(4),
        value: (
          (Number(userShares) / 1e18) *
          (Number(sharePrice || 1e18) / 1e18)
        ).toFixed(2),
      }
    : undefined;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-base)]">
      <Header />
      <main className="flex-1 py-8">
        <VaultPage
          vaultData={vaultData}
          userPosition={userPosition}
          onDeposit={handleDeposit}
          onWithdraw={handleWithdraw}
        />
      </main>
    </div>
  );
}
