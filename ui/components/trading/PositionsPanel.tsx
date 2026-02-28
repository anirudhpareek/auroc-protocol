"use client";

import { useState } from "react";
import { Tabs } from "../ui";

const tabs = ["Positions", "Orders", "History"];

interface Position {
  id: string;
  asset: string;
  direction: "long" | "short";
  size: string;
  entryPrice: string;
  markPrice: string;
  pnl: string;
  pnlPercent: string;
  margin: string;
  leverage: string;
}

const mockPositions: Position[] = [
  {
    id: "1",
    asset: "BTC/USD",
    direction: "long",
    size: "0.5 BTC",
    entryPrice: "$96,500.00",
    markPrice: "$97,432.50",
    pnl: "+$466.25",
    pnlPercent: "+4.83%",
    margin: "$4,825.00",
    leverage: "10x",
  },
];

export function PositionsPanel() {
  const [activeTab, setActiveTab] = useState("Positions");

  return (
    <div className="h-full flex flex-col bg-[var(--black)]">
      {/* Tabs */}
      <div className="px-4 py-2 border-b border-[var(--gray-900)]">
        <Tabs tabs={tabs} value={activeTab} onChange={setActiveTab} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === "Positions" && <PositionsTable positions={mockPositions} />}
        {activeTab === "Orders" && <EmptyState message="No open orders" />}
        {activeTab === "History" && <EmptyState message="No trade history" />}
      </div>
    </div>
  );
}

function PositionsTable({ positions }: { positions: Position[] }) {
  if (positions.length === 0) {
    return <EmptyState message="No open positions" />;
  }

  return (
    <table className="w-full">
      <thead>
        <tr className="text-xs text-[var(--gray-500)] border-b border-[var(--gray-900)]">
          <th className="text-left px-4 py-2 font-medium">Market</th>
          <th className="text-left px-4 py-2 font-medium">Size</th>
          <th className="text-right px-4 py-2 font-medium">Entry Price</th>
          <th className="text-right px-4 py-2 font-medium">Mark Price</th>
          <th className="text-right px-4 py-2 font-medium">PnL</th>
          <th className="text-right px-4 py-2 font-medium">Margin</th>
          <th className="text-right px-4 py-2 font-medium">Actions</th>
        </tr>
      </thead>
      <tbody>
        {positions.map((position) => (
          <tr
            key={position.id}
            className="border-b border-[var(--gray-900)] hover:bg-[var(--gray-950)] transition-colors"
          >
            <td className="px-4 py-3">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                    position.direction === "long"
                      ? "bg-[var(--green)]/20 text-[var(--green)]"
                      : "bg-[var(--red)]/20 text-[var(--red)]"
                  }`}
                >
                  {position.direction.toUpperCase()}
                </span>
                <span className="font-medium">{position.asset}</span>
                <span className="text-xs text-[var(--gray-500)]">
                  {position.leverage}
                </span>
              </div>
            </td>
            <td className="px-4 py-3 text-sm tabular">{position.size}</td>
            <td className="px-4 py-3 text-right text-sm tabular">
              {position.entryPrice}
            </td>
            <td className="px-4 py-3 text-right text-sm tabular">
              {position.markPrice}
            </td>
            <td className="px-4 py-3 text-right">
              <div
                className={`text-sm font-medium tabular ${
                  position.pnl.startsWith("+")
                    ? "text-[var(--green)]"
                    : "text-[var(--red)]"
                }`}
              >
                {position.pnl}
              </div>
              <div
                className={`text-xs tabular ${
                  position.pnlPercent.startsWith("+")
                    ? "text-[var(--green)]"
                    : "text-[var(--red)]"
                }`}
              >
                {position.pnlPercent}
              </div>
            </td>
            <td className="px-4 py-3 text-right text-sm tabular">
              {position.margin}
            </td>
            <td className="px-4 py-3 text-right">
              <div className="flex items-center justify-end gap-2">
                <button className="text-xs text-[var(--gray-400)] hover:text-white transition-colors">
                  TP/SL
                </button>
                <button className="text-xs text-[var(--red)] hover:brightness-110 transition-colors">
                  Close
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-[var(--gray-600)] text-sm">{message}</div>
    </div>
  );
}
