"use client";

import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { MARKETS } from "@/lib/contracts";

export interface TerminalMarket {
  id: `0x${string}`;
  symbol: string;
  pair: string;
  color: string;
}

export type Density = "compact" | "comfortable";

export const AVAILABLE_TERMINAL_MARKETS: TerminalMarket[] = [
  { id: MARKETS.XAU_USD, symbol: "XAU", pair: "XAU/USD", color: "#d4a017" },
  { id: MARKETS.SPX_USD, symbol: "SPX", pair: "SPX/USD", color: "#6366f1" },
];

interface TerminalContextValue {
  market: TerminalMarket;
  setMarket: (m: TerminalMarket) => void;
  density: Density;
  setDensity: (d: Density) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  bottomTab: string;
  setBottomTab: (t: string) => void;
  activeDrawTool: string;
  setActiveDrawTool: (t: string) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
}

const TerminalContext = createContext<TerminalContextValue | null>(null);

export function TerminalProvider({ children }: { children: ReactNode }) {
  const [market, setMarket] = useState<TerminalMarket>(AVAILABLE_TERMINAL_MARKETS[0]);
  const [density, setDensity] = useState<Density>("compact");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [bottomTab, setBottomTab] = useState("Positions");
  const [activeDrawTool, setActiveDrawTool] = useState("cursor");
  const searchRef = useRef<HTMLInputElement | null>(null);

  return (
    <TerminalContext.Provider value={{
      market, setMarket,
      density, setDensity,
      sidebarOpen, setSidebarOpen,
      bottomTab, setBottomTab,
      activeDrawTool, setActiveDrawTool,
      searchRef,
    }}>
      {children}
    </TerminalContext.Provider>
  );
}

export function useTerminal(): TerminalContextValue {
  const ctx = useContext(TerminalContext);
  if (!ctx) throw new Error("useTerminal must be used within TerminalProvider");
  return ctx;
}
