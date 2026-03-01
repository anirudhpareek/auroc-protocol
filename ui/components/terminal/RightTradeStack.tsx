"use client";

import { InstrumentCard } from "./InstrumentCard";
import { TradeTicket } from "./TradeTicket";

export function RightTradeStack() {
  return (
    <div style={{
      width: 296, flexShrink: 0,
      borderLeft: "1px solid var(--b1)",
      display: "flex", flexDirection: "column",
      height: "100%",
      background: "var(--panel)",
    }}>
      <InstrumentCard />
      <div style={{ height: 1, background: "var(--b1)", flexShrink: 0 }} />
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        <TradeTicket />
      </div>
    </div>
  );
}
