"use client";

import { TradingLayout } from "@/components/layout";
import { ChartPanel, OrderPanel, PositionsPanel } from "@/components/trading";

export default function TradePage() {
  return (
    <TradingLayout
      chart={<ChartPanel />}
      orderPanel={<OrderPanel />}
      positions={<PositionsPanel />}
    />
  );
}
