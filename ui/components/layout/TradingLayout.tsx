"use client";

import { type ReactNode } from "react";
import { Header } from "./Header";

interface TradingLayoutProps {
  chart: ReactNode;
  orderPanel: ReactNode;
  positions: ReactNode;
}

export function TradingLayout({ chart, orderPanel, positions }: TradingLayoutProps) {
  return (
    <div className="h-screen flex flex-col bg-[var(--black)]">
      <Header />

      <div className="flex-1 flex overflow-hidden">
        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chart */}
          <div className="flex-1 min-h-0">
            {chart}
          </div>

          {/* Positions */}
          <div className="h-[240px] border-t border-[var(--gray-900)]">
            {positions}
          </div>
        </div>

        {/* Order Panel */}
        <div className="w-[320px] border-l border-[var(--gray-900)] overflow-y-auto hidden md:block">
          {orderPanel}
        </div>
      </div>
    </div>
  );
}
