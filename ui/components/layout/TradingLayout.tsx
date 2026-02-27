"use client";

import { type ReactNode } from "react";
import { Header } from "./Header";
import { cn } from "@/lib/cn";

interface TradingLayoutProps {
  leftPanel: ReactNode;
  centerTop: ReactNode;
  centerBottom: ReactNode;
  rightPanel: ReactNode;
}

export function TradingLayout({
  leftPanel,
  centerTop,
  centerBottom,
  rightPanel,
}: TradingLayoutProps) {
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header />

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Market Selector */}
        <aside
          className={cn(
            "hidden lg:flex flex-col",
            "w-64 flex-shrink-0",
            "border-r border-[var(--border-subtle)]",
            "bg-[var(--bg-surface)]"
          )}
        >
          {leftPanel}
        </aside>

        {/* Center - Chart & Positions */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Chart Area */}
          <div className="flex-1 min-h-0">{centerTop}</div>

          {/* Bottom Panel - Positions/Orders */}
          <div
            className={cn(
              "h-64 flex-shrink-0",
              "border-t border-[var(--border-subtle)]",
              "bg-[var(--bg-surface)]",
              "overflow-hidden"
            )}
          >
            {centerBottom}
          </div>
        </main>

        {/* Right Panel - Trade Form */}
        <aside
          className={cn(
            "hidden md:flex flex-col",
            "w-80 flex-shrink-0",
            "border-l border-[var(--border-subtle)]",
            "bg-[var(--bg-surface)]"
          )}
        >
          {rightPanel}
        </aside>
      </div>
    </div>
  );
}

// Mobile layout for smaller screens
interface MobileLayoutProps {
  children: ReactNode;
  activeTab: "chart" | "trade" | "positions";
  onTabChange: (tab: "chart" | "trade" | "positions") => void;
}

export function MobileLayout({
  children,
  activeTab,
  onTabChange,
}: MobileLayoutProps) {
  return (
    <div className="h-screen flex flex-col md:hidden">
      <Header />

      <main className="flex-1 overflow-auto">{children}</main>

      {/* Bottom Navigation */}
      <nav
        className={cn(
          "h-14 flex-shrink-0",
          "flex items-center justify-around",
          "border-t border-[var(--border-subtle)]",
          "bg-[var(--bg-surface)]"
        )}
      >
        <NavButton
          active={activeTab === "chart"}
          onClick={() => onTabChange("chart")}
          icon={
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
              />
            </svg>
          }
          label="Chart"
        />
        <NavButton
          active={activeTab === "trade"}
          onClick={() => onTabChange("trade")}
          icon={
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
          label="Trade"
        />
        <NavButton
          active={activeTab === "positions"}
          onClick={() => onTabChange("positions")}
          icon={
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          }
          label="Positions"
        />
      </nav>
    </div>
  );
}

interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}

function NavButton({ active, onClick, icon, label }: NavButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 px-4 py-2",
        "transition-colors duration-[var(--transition-fast)]",
        active
          ? "text-[var(--accent-primary)]"
          : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
      )}
    >
      {icon}
      <span className="text-[var(--text-xs)] font-medium">{label}</span>
    </button>
  );
}
