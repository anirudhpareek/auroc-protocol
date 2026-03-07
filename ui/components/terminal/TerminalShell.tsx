"use client";

import { useEffect, useRef } from "react";
import { Header } from "@/components/layout/Header";
import { StatusBar } from "@/components/layout/StatusBar";
import { TerminalProvider, useTerminal, type Density } from "./TerminalContext";
import { MarketTickerBar } from "./MarketTickerBar";
import { CenterStack } from "./CenterStack";
import { OrderBook } from "./OrderBook";
import { RightTradeStack } from "./RightTradeStack";
import { BottomDockTabs } from "./BottomDockTabs";

function TerminalKeyboardHandler() {
  const { searchRef, setBottomTab } = useTerminal();
  const lastKeyRef = useRef<{ key: string; time: number } | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }

      const now = Date.now();
      if (e.key === "g") {
        lastKeyRef.current = { key: "g", time: now };
        return;
      }

      if (lastKeyRef.current?.key === "g" && now - lastKeyRef.current.time < 600) {
        if (e.key === "p") {
          setBottomTab("Positions");
          lastKeyRef.current = null;
          return;
        }
        if (e.key === "o") {
          setBottomTab("Active Orders");
          lastKeyRef.current = null;
          return;
        }
      }

      lastKeyRef.current = null;
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [searchRef, setBottomTab]);

  return null;
}

function DensityToggle() {
  const { density, setDensity } = useTerminal();
  return (
    <div className="flex overflow-hidden" style={{ borderRadius: "var(--radius-full)", border: "1px solid var(--b2)", background: "var(--raised)" }}>
      {(["compact", "comfortable"] as Density[]).map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => setDensity(d)}
          className="capitalize transition-colors"
          style={{
            padding: "3px 10px",
            fontSize: "var(--text-2xs)",
            fontWeight: 500,
            background: density === d ? "var(--active)" : "transparent",
            color: density === d ? "var(--t1)" : "var(--t3)",
          }}
        >
          {d}
        </button>
      ))}
    </div>
  );
}

function TerminalInner() {
  const { density, searchRef } = useTerminal();

  return (
    <>
      <TerminalKeyboardHandler />
      <div
        data-density={density}
        className="h-screen flex flex-col overflow-hidden"
        style={{ background: "var(--bg)" }}
      >
        <Header searchRef={searchRef} densityToggle={<DensityToggle />} />
        <MarketTickerBar />

        {/* Main body — chart + orderbook + trade ticket */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          <CenterStack />
          <OrderBook />
          <RightTradeStack />
        </div>

        <BottomDockTabs />
        <StatusBar />
      </div>
    </>
  );
}

export function TerminalShell() {
  return (
    <TerminalProvider>
      <TerminalInner />
    </TerminalProvider>
  );
}
