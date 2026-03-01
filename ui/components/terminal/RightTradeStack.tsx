"use client";

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
      <TradeTicket />
    </div>
  );
}
