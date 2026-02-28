"use client";

import { useState } from "react";
import { Header } from "@/components/layout";
import { Button, Input } from "@/components/ui";

export default function VaultPage() {
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  return (
    <div className="min-h-screen flex flex-col bg-[var(--black)]">
      <Header />
      <main className="flex-1 py-8">
        <div className="max-w-4xl mx-auto px-4">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">Liquidity Vault</h1>
            <p className="text-[var(--gray-500)] text-sm mt-1">
              Provide liquidity and earn fees from perpetual trading
            </p>
          </div>

          {/* Vault Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatBox label="Total Deposits" value="$1,234,567" />
            <StatBox label="Share Price" value="$1.0234" />
            <StatBox label="APR" value="12.5%" highlight />
            <StatBox label="Utilization" value="65.4%" />
          </div>

          {/* Deposit/Withdraw */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Deposit */}
            <div className="bg-[var(--gray-900)] rounded-xl p-6 border border-[var(--gray-800)]">
              <h3 className="text-lg font-semibold mb-4">Deposit</h3>
              <div className="space-y-4">
                <Input
                  label="Amount"
                  value={depositAmount}
                  onChange={setDepositAmount}
                  placeholder="0.00"
                  suffix="USDC"
                />
                <div className="flex justify-between text-xs text-[var(--gray-500)]">
                  <span>Available</span>
                  <span>10,000.00 USDC</span>
                </div>
                <Button variant="primary" className="w-full">
                  Deposit
                </Button>
              </div>
            </div>

            {/* Withdraw */}
            <div className="bg-[var(--gray-900)] rounded-xl p-6 border border-[var(--gray-800)]">
              <h3 className="text-lg font-semibold mb-4">Withdraw</h3>
              <div className="space-y-4">
                <Input
                  label="Shares"
                  value={withdrawAmount}
                  onChange={setWithdrawAmount}
                  placeholder="0.00"
                  suffix="LP"
                />
                <div className="flex justify-between text-xs text-[var(--gray-500)]">
                  <span>Your Shares</span>
                  <span>0.00 LP</span>
                </div>
                <Button variant="secondary" className="w-full">
                  Withdraw
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatBox({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-[var(--gray-900)] rounded-lg p-4 border border-[var(--gray-800)]">
      <div className="text-xs text-[var(--gray-500)] mb-1">{label}</div>
      <div
        className={`text-lg font-semibold tabular ${
          highlight ? "text-[var(--green)]" : "text-white"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
