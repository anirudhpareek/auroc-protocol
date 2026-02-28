"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { cn } from "@/lib/cn";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Button,
} from "@/components/ui";

interface Position {
  id: string;
  market: string;
  side: "long" | "short";
  size: string;
  entryPrice: string;
  markPrice: string;
  pnl: number;
  pnlPercent: number;
  margin: string;
  leverage: number;
  liquidationPrice: string;
}

interface Order {
  id: string;
  market: string;
  side: "long" | "short";
  type: "limit" | "stop";
  size: string;
  price: string;
  filled: string;
  status: "open" | "partial" | "cancelled";
  createdAt: string;
}

interface Trade {
  id: string;
  market: string;
  side: "long" | "short";
  size: string;
  price: string;
  fee: string;
  pnl?: number;
  timestamp: string;
}

interface PositionsPanelProps {
  positions?: Position[];
  orders?: Order[];
  trades?: Trade[];
  isLoading?: boolean;
  onClosePosition?: (positionId: string) => Promise<void>;
  onCancelOrder?: (orderId: string) => Promise<void>;
}

export function PositionsPanel({
  positions = [],
  orders = [],
  trades = [],
  isLoading = false,
  onClosePosition,
  onCancelOrder,
}: PositionsPanelProps) {
  const { isConnected } = useAccount();
  const [closingId, setClosingId] = useState<string | null>(null);

  const handleClose = async (positionId: string) => {
    setClosingId(positionId);
    try {
      await onClosePosition?.(positionId);
    } finally {
      setClosingId(null);
    }
  };

  if (!isConnected) {
    return (
      <div className="h-full flex items-center justify-center bg-[var(--bg-base)]">
        <div className="text-center space-y-2">
          <p className="text-[var(--text-secondary)] text-[var(--text-sm)]">
            Connect wallet to view positions
          </p>
          <p className="text-[var(--text-xs)] text-[var(--text-muted)]">
            Your positions and orders will appear here
          </p>
        </div>
      </div>
    );
  }

  return (
    <Tabs defaultValue="positions" className="h-full flex flex-col bg-[var(--bg-base)]">
      {/* Tab Header */}
      <div className="flex items-center justify-between px-4 border-b border-[var(--border-subtle)]">
        <TabsList>
          <TabsTrigger value="positions">
            Positions {positions.length > 0 && <span className="ml-1 text-[var(--accent-primary)]">({positions.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="orders">
            Orders {orders.length > 0 && <span className="ml-1 text-[var(--accent-primary)]">({orders.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
      </div>

      {/* Positions Tab */}
      <TabsContent value="positions" className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-4 space-y-2">
            <div className="h-12 skeleton" />
            <div className="h-12 skeleton" />
          </div>
        ) : positions.length === 0 ? (
          <EmptyState message="No open positions" />
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left">Market</th>
                <th className="text-left">Side</th>
                <th className="text-right">Size</th>
                <th className="text-right">Entry</th>
                <th className="text-right">Mark</th>
                <th className="text-right">PnL</th>
                <th className="text-right">Liq. Price</th>
                <th className="text-right"></th>
              </tr>
            </thead>
            <tbody>
              {positions.map((position) => (
                <tr key={position.id} className="group">
                  <td className="font-medium text-white">{position.market}</td>
                  <td>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded text-[var(--text-xs)] font-semibold uppercase",
                        position.side === "long"
                          ? "bg-[var(--color-long-subtle)] text-[var(--color-long)]"
                          : "bg-[var(--color-short-subtle)] text-[var(--color-short)]"
                      )}
                    >
                      {position.side}
                    </span>
                  </td>
                  <td className="text-right tabular-nums text-white">${position.size}</td>
                  <td className="text-right tabular-nums text-[var(--text-secondary)]">
                    ${position.entryPrice}
                  </td>
                  <td className="text-right tabular-nums text-[var(--text-secondary)]">
                    ${position.markPrice}
                  </td>
                  <td className="text-right">
                    <div className="flex flex-col items-end">
                      <span
                        className={cn(
                          "tabular-nums font-medium",
                          position.pnl >= 0
                            ? "text-[var(--color-long)]"
                            : "text-[var(--color-short)]"
                        )}
                      >
                        {position.pnl >= 0 ? "+" : ""}${position.pnl.toFixed(2)}
                      </span>
                      <span
                        className={cn(
                          "text-[var(--text-xs)] tabular-nums",
                          position.pnlPercent >= 0
                            ? "text-[var(--color-long)]"
                            : "text-[var(--color-short)]"
                        )}
                      >
                        {position.pnlPercent >= 0 ? "+" : ""}{position.pnlPercent.toFixed(2)}%
                      </span>
                    </div>
                  </td>
                  <td className="text-right tabular-nums text-[var(--color-warning)]">
                    ${position.liquidationPrice}
                  </td>
                  <td className="text-right">
                    <button
                      onClick={() => handleClose(position.id)}
                      disabled={closingId === position.id}
                      className={cn(
                        "px-3 py-1 rounded-md",
                        "text-[var(--text-xs)] font-medium",
                        "bg-transparent text-[var(--text-muted)]",
                        "border border-[var(--border-default)]",
                        "hover:border-[var(--color-short)] hover:text-[var(--color-short)]",
                        "transition-colors duration-150",
                        "disabled:opacity-50"
                      )}
                    >
                      {closingId === position.id ? "..." : "Close"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TabsContent>

      {/* Orders Tab */}
      <TabsContent value="orders" className="flex-1 overflow-auto">
        {orders.length === 0 ? (
          <EmptyState message="No open orders" />
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left">Market</th>
                <th className="text-left">Type</th>
                <th className="text-left">Side</th>
                <th className="text-right">Size</th>
                <th className="text-right">Price</th>
                <th className="text-right">Filled</th>
                <th className="text-left">Status</th>
                <th className="text-right"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="font-medium text-white">{order.market}</td>
                  <td className="uppercase text-[var(--text-xs)] text-[var(--text-muted)]">
                    {order.type}
                  </td>
                  <td>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded text-[var(--text-xs)] font-semibold uppercase",
                        order.side === "long"
                          ? "bg-[var(--color-long-subtle)] text-[var(--color-long)]"
                          : "bg-[var(--color-short-subtle)] text-[var(--color-short)]"
                      )}
                    >
                      {order.side}
                    </span>
                  </td>
                  <td className="text-right tabular-nums text-white">${order.size}</td>
                  <td className="text-right tabular-nums text-[var(--text-secondary)]">
                    ${order.price}
                  </td>
                  <td className="text-right tabular-nums text-[var(--text-muted)]">
                    {order.filled}
                  </td>
                  <td>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded text-[var(--text-xs)] font-medium",
                        order.status === "open" && "bg-[var(--bg-surface)] text-[var(--text-secondary)]",
                        order.status === "partial" && "bg-[var(--color-warning-subtle)] text-[var(--color-warning)]"
                      )}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="text-right">
                    <button
                      onClick={() => onCancelOrder?.(order.id)}
                      className={cn(
                        "px-3 py-1 rounded-md",
                        "text-[var(--text-xs)] font-medium",
                        "bg-transparent text-[var(--text-muted)]",
                        "border border-[var(--border-default)]",
                        "hover:border-[var(--color-short)] hover:text-[var(--color-short)]",
                        "transition-colors duration-150"
                      )}
                    >
                      Cancel
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TabsContent>

      {/* History Tab */}
      <TabsContent value="history" className="flex-1 overflow-auto">
        {trades.length === 0 ? (
          <EmptyState message="No trade history" />
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left">Time</th>
                <th className="text-left">Market</th>
                <th className="text-left">Side</th>
                <th className="text-right">Size</th>
                <th className="text-right">Price</th>
                <th className="text-right">Fee</th>
                <th className="text-right">PnL</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade) => (
                <tr key={trade.id}>
                  <td className="text-[var(--text-muted)]">{trade.timestamp}</td>
                  <td className="font-medium text-white">{trade.market}</td>
                  <td>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded text-[var(--text-xs)] font-semibold uppercase",
                        trade.side === "long"
                          ? "bg-[var(--color-long-subtle)] text-[var(--color-long)]"
                          : "bg-[var(--color-short-subtle)] text-[var(--color-short)]"
                      )}
                    >
                      {trade.side}
                    </span>
                  </td>
                  <td className="text-right tabular-nums text-white">${trade.size}</td>
                  <td className="text-right tabular-nums text-[var(--text-secondary)]">
                    ${trade.price}
                  </td>
                  <td className="text-right tabular-nums text-[var(--text-muted)]">
                    ${trade.fee}
                  </td>
                  <td className="text-right">
                    {trade.pnl !== undefined && (
                      <span
                        className={cn(
                          "tabular-nums font-medium",
                          trade.pnl >= 0
                            ? "text-[var(--color-long)]"
                            : "text-[var(--color-short)]"
                        )}
                      >
                        {trade.pnl >= 0 ? "+" : ""}${trade.pnl.toFixed(2)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TabsContent>
    </Tabs>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="h-full flex items-center justify-center py-12">
      <span className="text-[var(--text-sm)] text-[var(--text-muted)]">{message}</span>
    </div>
  );
}
