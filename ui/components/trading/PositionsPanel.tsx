"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { cn } from "@/lib/cn";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty,
  Button,
  Badge,
  SkeletonTableRow,
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
      <div className="h-full flex items-center justify-center bg-[var(--bg-surface)]/60 backdrop-blur-sm">
        <div className="text-center space-y-2">
          <p className="text-[var(--text-muted)] text-[var(--text-sm)]">
            Connect wallet to view positions
          </p>
          <p className="text-[var(--text-2xs)] text-[var(--text-disabled)]">
            Your positions and orders will appear here
          </p>
        </div>
      </div>
    );
  }

  return (
    <Tabs defaultValue="positions" className="h-full flex flex-col bg-[var(--bg-surface)]/60 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-[var(--border-subtle)]">
        <TabsList>
          <TabsTrigger value="positions">
            Positions ({positions.length})
          </TabsTrigger>
          <TabsTrigger value="orders">
            Orders ({orders.length})
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="positions" className="flex-1 overflow-auto mt-0 pt-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Market</TableHead>
              <TableHead>Side</TableHead>
              <TableHead align="right">Size</TableHead>
              <TableHead align="right">Entry</TableHead>
              <TableHead align="right">Mark</TableHead>
              <TableHead align="right">PnL</TableHead>
              <TableHead align="right">Liq. Price</TableHead>
              <TableHead align="right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <>
                <SkeletonTableRow cols={8} />
                <SkeletonTableRow cols={8} />
              </>
            ) : positions.length === 0 ? (
              <TableEmpty message="No open positions" colSpan={8} />
            ) : (
              positions.map((position) => (
                <TableRow key={position.id}>
                  <TableCell className="font-medium">
                    {position.market}
                  </TableCell>
                  <TableCell>
                    <Badge variant={position.side}>
                      {position.side.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell align="right" mono>
                    ${position.size}
                  </TableCell>
                  <TableCell align="right" mono>
                    ${position.entryPrice}
                  </TableCell>
                  <TableCell align="right" mono>
                    ${position.markPrice}
                  </TableCell>
                  <TableCell align="right">
                    <div className="flex flex-col items-end">
                      <span
                        className={cn(
                          "tabular-nums font-medium",
                          position.pnl >= 0
                            ? "text-[var(--color-long)]"
                            : "text-[var(--color-short)]"
                        )}
                      >
                        {position.pnl >= 0 ? "+" : ""}
                        ${position.pnl.toFixed(2)}
                      </span>
                      <span
                        className={cn(
                          "text-[var(--text-xs)] tabular-nums",
                          position.pnlPercent >= 0
                            ? "text-[var(--color-long)]"
                            : "text-[var(--color-short)]"
                        )}
                      >
                        {position.pnlPercent >= 0 ? "+" : ""}
                        {position.pnlPercent.toFixed(2)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell align="right" mono>
                    <span className="text-[var(--color-warning)]">
                      ${position.liquidationPrice}
                    </span>
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={closingId === position.id}
                      onClick={() => handleClose(position.id)}
                    >
                      Close
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TabsContent>

      <TabsContent value="orders" className="flex-1 overflow-auto mt-0 pt-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Market</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Side</TableHead>
              <TableHead align="right">Size</TableHead>
              <TableHead align="right">Price</TableHead>
              <TableHead align="right">Filled</TableHead>
              <TableHead>Status</TableHead>
              <TableHead align="right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableEmpty message="No open orders" colSpan={8} />
            ) : (
              orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.market}</TableCell>
                  <TableCell className="uppercase text-[var(--text-xs)]">
                    {order.type}
                  </TableCell>
                  <TableCell>
                    <Badge variant={order.side}>
                      {order.side.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell align="right" mono>
                    ${order.size}
                  </TableCell>
                  <TableCell align="right" mono>
                    ${order.price}
                  </TableCell>
                  <TableCell align="right" mono>
                    {order.filled}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        order.status === "open"
                          ? "default"
                          : order.status === "partial"
                          ? "warning"
                          : "default"
                      }
                    >
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onCancelOrder?.(order.id)}
                    >
                      Cancel
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TabsContent>

      <TabsContent value="history" className="flex-1 overflow-auto mt-0 pt-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Market</TableHead>
              <TableHead>Side</TableHead>
              <TableHead align="right">Size</TableHead>
              <TableHead align="right">Price</TableHead>
              <TableHead align="right">Fee</TableHead>
              <TableHead align="right">PnL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trades.length === 0 ? (
              <TableEmpty message="No trade history" colSpan={7} />
            ) : (
              trades.map((trade) => (
                <TableRow key={trade.id}>
                  <TableCell className="text-[var(--text-muted)]">
                    {trade.timestamp}
                  </TableCell>
                  <TableCell className="font-medium">{trade.market}</TableCell>
                  <TableCell>
                    <Badge variant={trade.side}>
                      {trade.side.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell align="right" mono>
                    ${trade.size}
                  </TableCell>
                  <TableCell align="right" mono>
                    ${trade.price}
                  </TableCell>
                  <TableCell align="right" mono className="text-[var(--text-muted)]">
                    ${trade.fee}
                  </TableCell>
                  <TableCell align="right">
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
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TabsContent>
    </Tabs>
  );
}
