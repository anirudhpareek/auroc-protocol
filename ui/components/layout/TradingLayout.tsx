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
    <div className="h-screen flex flex-col" style={{ background: "var(--bg-base)" }}>
      <Header />

      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* ── Main content: chart + positions ── */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Chart — takes all remaining vertical space */}
          <div className="flex-1 min-h-0">
            {chart}
          </div>

          {/* Positions bottom strip */}
          <div
            className="h-[220px] flex-shrink-0"
            style={{ borderTop: "1px solid var(--border-default)" }}
          >
            {positions}
          </div>
        </div>

        {/* ── Order Panel — right sidebar ── */}
        <div
          className="w-[300px] flex-shrink-0 overflow-y-auto hidden md:flex flex-col"
          style={{ borderLeft: "1px solid var(--border-default)", background: "var(--bg-surface)" }}
        >
          {orderPanel}
        </div>
      </div>
    </div>
  );
}
