"use client";

import { useEffect, useRef } from "react";
import { Header } from "@/components/layout/Header";
import { StatusBar } from "@/components/layout/StatusBar";
import { TerminalProvider, useTerminal, type Density } from "./TerminalContext";
import { TopTickerStrip } from "./TopTickerStrip";
import { LeftSidebar } from "./LeftSidebar";
import { CenterStack } from "./CenterStack";
import { RightTradeStack } from "./RightTradeStack";
import { BottomDockTabs } from "./BottomDockTabs";

function TerminalKeyboardHandler() {
  const { searchRef, setSidebarOpen, setBottomTab } = useTerminal();
  const lastKeyRef = useRef<{ key: string; time: number } | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      // `/` → focus search
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }

      // `g` sequence
      const now = Date.now();
      if (e.key === "g") {
        lastKeyRef.current = { key: "g", time: now };
        return;
      }

      if (lastKeyRef.current?.key === "g" && now - lastKeyRef.current.time < 600) {
        if (e.key === "t") {
          setSidebarOpen(true);
          lastKeyRef.current = null;
          return;
        }
        if (e.key === "p") {
          setBottomTab("Positions");
          lastKeyRef.current = null;
          return;
        }
      }

      lastKeyRef.current = null;
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [searchRef, setSidebarOpen, setBottomTab]);

  return null;
}

function DensityToggle() {
  const { density, setDensity } = useTerminal();
  return (
    <div style={{
      display: "flex",
      borderRadius: "var(--radius-full)",
      border: "1px solid var(--b2)",
      overflow: "hidden",
      background: "var(--raised)",
    }}>
      {(["compact", "comfortable"] as Density[]).map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => setDensity(d)}
          style={{
            padding: "3px 10px",
            fontSize: "var(--text-2xs)", fontWeight: 500,
            background: density === d ? "var(--active)" : "transparent",
            color: density === d ? "var(--t1)" : "var(--t3)",
            transition: "var(--transition-fast)",
            textTransform: "capitalize",
          }}
        >
          {d}
        </button>
      ))}
    </div>
  );
}

function ResponsiveSidebarCollapse() {
  const { setSidebarOpen } = useTerminal();
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setSidebarOpen(!e.matches);
    handler(mq);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [setSidebarOpen]);
  return null;
}

function TerminalInner() {
  const { density, searchRef } = useTerminal();

  return (
    <>
      <TerminalKeyboardHandler />
      <ResponsiveSidebarCollapse />
      <div
        data-density={density}
        style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg)",
          overflow: "hidden",
        }}
      >
        <Header searchRef={searchRef} densityToggle={<DensityToggle />} />
        <TopTickerStrip />

        {/* Main body row */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
          <LeftSidebar />
          <CenterStack />
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
