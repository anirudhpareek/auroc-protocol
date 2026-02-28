"use client";

import { useAccount } from "wagmi";
import { Header } from "@/components/layout";
import { PositionsPanel } from "@/components/trading";
import { Button } from "@/components/ui";

export default function PortfolioPage() {
  const { isConnected, address } = useAccount();

  return (
    <div className="min-h-screen flex flex-col bg-[var(--black)]">
      <Header />
      <main className="flex-1 py-8">
        <div className="max-w-5xl mx-auto px-4">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">Portfolio</h1>
            <p className="text-[var(--gray-500)] text-sm mt-1">
              Manage your positions and view performance
            </p>
          </div>

          {!isConnected ? (
            <div className="bg-[var(--gray-900)] rounded-xl p-8 border border-[var(--gray-800)] text-center">
              <p className="text-[var(--gray-500)] text-sm mb-4">
                Connect your wallet to view your portfolio
              </p>
              <Button variant="primary">Connect Wallet</Button>
            </div>
          ) : (
            <>
              {/* Portfolio Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <StatBox label="Total Margin" value="$0.00" />
                <StatBox label="Unrealized PnL" value="$0.00" />
                <StatBox label="Open Positions" value="0" />
                <StatBox
                  label="Account"
                  value={
                    address
                      ? `${address.slice(0, 6)}...${address.slice(-4)}`
                      : "—"
                  }
                />
              </div>

              {/* Positions Table */}
              <div className="bg-[var(--gray-900)] rounded-xl border border-[var(--gray-800)] overflow-hidden">
                <div className="h-[400px]">
                  <PositionsPanel />
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--gray-900)] rounded-lg p-4 border border-[var(--gray-800)]">
      <div className="text-xs text-[var(--gray-500)] mb-1">{label}</div>
      <div className="text-lg font-semibold text-white tabular">{value}</div>
    </div>
  );
}
