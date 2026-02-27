"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { cn } from "@/lib/cn";
import {
  Button,
  NumericInput,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Card,
  StatCard,
} from "@/components/ui";

interface VaultPanelProps {
  totalDeposits?: string;
  sharePrice?: string;
  userShares?: string;
  userValue?: string;
  apr?: string;
  utilization?: string;
  onDeposit?: (amount: string) => Promise<void>;
  onWithdraw?: (shares: string) => Promise<void>;
  isLoading?: boolean;
}

export function VaultPanel({
  totalDeposits = "1,234,567.89",
  sharePrice = "1.0234",
  userShares = "0.00",
  userValue = "0.00",
  apr = "12.5",
  utilization = "65.4",
  onDeposit,
  onWithdraw,
  isLoading = false,
}: VaultPanelProps) {
  const { isConnected } = useAccount();

  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawShares, setWithdrawShares] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDeposit = async () => {
    if (!depositAmount) return;
    setIsSubmitting(true);
    try {
      await onDeposit?.(depositAmount);
      setDepositAmount("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawShares) return;
    setIsSubmitting(true);
    try {
      await onWithdraw?.(withdrawShares);
      setWithdrawShares("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border-subtle)]">
        <h2 className="text-[var(--text-base)] font-semibold">Liquidity Vault</h2>
        <p className="text-[var(--text-xs)] text-[var(--text-muted)] mt-0.5">
          Provide liquidity and earn trading fees
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Vault Stats */}
        <Card padding="sm">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Total Deposits" value={totalDeposits} prefix="$" />
            <StatCard label="Share Price" value={sharePrice} prefix="$" />
            <StatCard label="APR" value={apr} suffix="%" />
            <StatCard label="Utilization" value={utilization} suffix="%" />
          </div>
        </Card>

        {/* User Position */}
        {isConnected && (
          <Card padding="sm" elevated>
            <div className="text-[var(--text-2xs)] text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Your Position
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="LP Shares" value={userShares} />
              <StatCard label="Value" value={userValue} prefix="$" />
            </div>
          </Card>
        )}

        {/* Deposit/Withdraw Tabs */}
        <Tabs defaultValue="deposit">
          <TabsList>
            <TabsTrigger value="deposit">Deposit</TabsTrigger>
            <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
          </TabsList>

          <TabsContent value="deposit">
            <div className="space-y-3 pt-3">
              <NumericInput
                label="Deposit Amount"
                value={depositAmount}
                onChange={setDepositAmount}
                placeholder="0.00"
                rightAddon="USDC"
                decimals={6}
              />

              <div className="flex gap-1.5">
                {[25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => setDepositAmount((1000 * pct / 100).toString())}
                    className={cn(
                      "flex-1 py-1 rounded-[var(--radius-sm)]",
                      "text-[var(--text-2xs)] font-medium",
                      "bg-[var(--bg-hover)] text-[var(--text-muted)]",
                      "hover:text-[var(--text-secondary)]",
                      "transition-colors duration-[var(--transition-fast)]"
                    )}
                  >
                    {pct}%
                  </button>
                ))}
              </div>

              {depositAmount && (
                <div className="p-2.5 rounded-[var(--radius-md)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                  <div className="flex items-center justify-between text-[var(--text-sm)]">
                    <span className="text-[var(--text-muted)]">
                      Expected Shares
                    </span>
                    <span className="tabular-nums font-medium">
                      {(parseFloat(depositAmount) / parseFloat(sharePrice)).toFixed(4)} LP
                    </span>
                  </div>
                </div>
              )}

              {isConnected ? (
                <Button
                  variant="primary"
                  fullWidth
                  size="lg"
                  loading={isSubmitting}
                  disabled={!depositAmount || parseFloat(depositAmount) <= 0}
                  onClick={handleDeposit}
                >
                  Deposit USDC
                </Button>
              ) : (
                <Button variant="primary" fullWidth size="lg" disabled>
                  Connect Wallet
                </Button>
              )}
            </div>
          </TabsContent>

          <TabsContent value="withdraw">
            <div className="space-y-3 pt-3">
              <NumericInput
                label="Withdraw Shares"
                value={withdrawShares}
                onChange={setWithdrawShares}
                placeholder="0.00"
                rightAddon="LP"
                decimals={6}
              />

              <div className="flex gap-1.5">
                {[25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => setWithdrawShares((parseFloat(userShares) * pct / 100).toString())}
                    className={cn(
                      "flex-1 py-1 rounded-[var(--radius-sm)]",
                      "text-[var(--text-2xs)] font-medium",
                      "bg-[var(--bg-hover)] text-[var(--text-muted)]",
                      "hover:text-[var(--text-secondary)]",
                      "transition-colors duration-[var(--transition-fast)]"
                    )}
                  >
                    {pct}%
                  </button>
                ))}
              </div>

              {withdrawShares && (
                <div className="p-2.5 rounded-[var(--radius-md)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                  <div className="flex items-center justify-between text-[var(--text-sm)]">
                    <span className="text-[var(--text-muted)]">
                      Expected USDC
                    </span>
                    <span className="tabular-nums font-medium">
                      ${(parseFloat(withdrawShares) * parseFloat(sharePrice)).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {isConnected ? (
                <Button
                  variant="secondary"
                  fullWidth
                  size="lg"
                  loading={isSubmitting}
                  disabled={!withdrawShares || parseFloat(withdrawShares) <= 0}
                  onClick={handleWithdraw}
                >
                  Withdraw USDC
                </Button>
              ) : (
                <Button variant="secondary" fullWidth size="lg" disabled>
                  Connect Wallet
                </Button>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className="text-[var(--text-2xs)] text-[var(--text-muted)] space-y-1">
          <p>
            By depositing, you provide liquidity to traders and earn a share of
            trading fees.
          </p>
          <p>
            Your position value may fluctuate based on trader PnL. Withdrawals
            are subject to available liquidity.
          </p>
        </div>
      </div>
    </div>
  );
}

interface VaultPageProps {
  vaultData?: {
    totalDeposits: string;
    sharePrice: string;
    totalShares: string;
    apr: string;
    utilization: string;
    tradingVolume24h: string;
    fees24h: string;
    traderPnL24h: number;
  };
  userPosition?: {
    shares: string;
    value: string;
    depositedAt?: string;
  };
  onDeposit?: (amount: string) => Promise<void>;
  onWithdraw?: (shares: string) => Promise<void>;
}

export function VaultPage({
  vaultData = {
    totalDeposits: "1,234,567.89",
    sharePrice: "1.0234",
    totalShares: "1,206,782.00",
    apr: "12.5",
    utilization: "65.4",
    tradingVolume24h: "5,432,100.00",
    fees24h: "2,716.05",
    traderPnL24h: -1234.56,
  },
  userPosition,
  onDeposit,
  onWithdraw,
}: VaultPageProps) {
  return (
    <div className="max-w-4xl mx-auto px-6 space-y-5">
      <div>
        <h1 className="text-[var(--text-xl)] font-bold">Liquidity Vault</h1>
        <p className="text-[var(--text-secondary)] text-[var(--text-sm)] mt-0.5">
          Provide liquidity to the perpetual trading pool and earn fees
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card padding="md">
          <StatCard
            label="Total Value Locked"
            value={vaultData.totalDeposits}
            prefix="$"
          />
        </Card>
        <Card padding="md">
          <StatCard label="Share Price" value={vaultData.sharePrice} prefix="$" />
        </Card>
        <Card padding="md">
          <StatCard label="APR" value={vaultData.apr} suffix="%" />
        </Card>
        <Card padding="md">
          <StatCard
            label="Utilization"
            value={vaultData.utilization}
            suffix="%"
          />
        </Card>
      </div>

      {/* 24h Stats */}
      <Card padding="md">
        <h3 className="text-[var(--text-sm)] font-semibold mb-3">
          24 Hour Performance
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="Trading Volume"
            value={vaultData.tradingVolume24h}
            prefix="$"
          />
          <StatCard label="Fees Earned" value={vaultData.fees24h} prefix="$" />
          <StatCard
            label="Trader PnL"
            value={Math.abs(vaultData.traderPnL24h).toFixed(2)}
            prefix={vaultData.traderPnL24h >= 0 ? "-$" : "+$"}
            change={
              vaultData.traderPnL24h >= 0
                ? -Math.abs(vaultData.traderPnL24h) / 100
                : Math.abs(vaultData.traderPnL24h) / 100
            }
          />
        </div>
      </Card>

      {/* User Actions */}
      <div className="grid md:grid-cols-2 gap-5">
        <Card padding="md">
          <VaultPanel
            totalDeposits={vaultData.totalDeposits}
            sharePrice={vaultData.sharePrice}
            userShares={userPosition?.shares || "0.00"}
            userValue={userPosition?.value || "0.00"}
            apr={vaultData.apr}
            utilization={vaultData.utilization}
            onDeposit={onDeposit}
            onWithdraw={onWithdraw}
          />
        </Card>
      </div>
    </div>
  );
}
