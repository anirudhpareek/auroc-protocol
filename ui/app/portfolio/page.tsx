"use client";

import { useAccount } from "wagmi";
import { Header } from "@/components/layout";
import { PositionsPanel } from "@/components/trading";
import { usePositions } from "@/hooks/usePositions";
import { Card, StatCard, Button } from "@/components/ui";

export default function PortfolioPage() {
  const { isConnected, address } = useAccount();
  const { positions, isLoading } = usePositions();

  // Calculate portfolio stats
  const totalValue = positions.reduce((acc, pos) => {
    return acc + Number(pos.margin) / 1e6;
  }, 0);

  const totalPnL = positions.reduce((acc, pos) => {
    return acc + Number(pos.unrealizedPnL) / 1e18;
  }, 0);

  const positionsForPanel = positions.map((p, i) => ({
    id: p.id,
    market: "XAU/USD", // TODO: Map asset ID to symbol
    side: p.isLong ? ("long" as const) : ("short" as const),
    size: (Number(p.size) / 1e18).toFixed(2),
    entryPrice: (Number(p.entryPrice) / 1e18).toFixed(2),
    markPrice: "2341.50", // TODO: Get actual mark price
    pnl: Number(p.unrealizedPnL) / 1e18,
    pnlPercent: ((Number(p.unrealizedPnL) / 1e18) / (Number(p.margin) / 1e6)) * 100 || 0,
    margin: (Number(p.margin) / 1e6).toFixed(2),
    leverage: 5,
    liquidationPrice: ((Number(p.entryPrice) / 1e18) * 0.85).toFixed(2),
  }));

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-base)]">
      <Header />
      <main className="flex-1">
        <div className="max-w-6xl mx-auto p-6 space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-[var(--text-2xl)] font-bold">Portfolio</h1>
            <p className="text-[var(--text-secondary)] mt-1">
              Manage your positions and view performance
            </p>
          </div>

          {!isConnected ? (
            <Card padding="lg" className="text-center">
              <p className="text-[var(--text-muted)] mb-4">
                Connect your wallet to view your portfolio
              </p>
              <Button variant="primary">Connect Wallet</Button>
            </Card>
          ) : (
            <>
              {/* Portfolio Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card padding="md">
                  <StatCard
                    label="Total Margin"
                    value={totalValue.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                    prefix="$"
                  />
                </Card>
                <Card padding="md">
                  <StatCard
                    label="Unrealized PnL"
                    value={Math.abs(totalPnL).toFixed(2)}
                    prefix={totalPnL >= 0 ? "+$" : "-$"}
                    change={totalPnL >= 0 ? totalPnL : -Math.abs(totalPnL)}
                  />
                </Card>
                <Card padding="md">
                  <StatCard
                    label="Open Positions"
                    value={positions.length.toString()}
                  />
                </Card>
                <Card padding="md">
                  <StatCard
                    label="Account"
                    value={
                      address
                        ? `${address.slice(0, 6)}...${address.slice(-4)}`
                        : "—"
                    }
                  />
                </Card>
              </div>

              {/* Positions Table */}
              <Card padding="none" className="overflow-hidden">
                <div className="h-[400px]">
                  <PositionsPanel
                    positions={positionsForPanel}
                    orders={[]}
                    trades={[]}
                    isLoading={isLoading}
                    onClosePosition={async (id) => {
                      console.log("Close position:", id);
                    }}
                  />
                </div>
              </Card>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
