"use client";

import { useState } from "react";
import { useAllMarkets } from "@/hooks/useMarketData";
import { formatPrice } from "@/lib/format";
import { AVAILABLE_TERMINAL_MARKETS, useTerminal } from "./TerminalContext";

type SidebarTab = "markets" | "watchlist" | "scanner";

const WATCH_TOKENS = [
  { sym: "XAU", pair: "XAU/USD", price: "2,892.40", chg: "+0.45%", up: true,  color: "#d4a017" },
  { sym: "SPX", pair: "SPX/USD", price: "5,234.18", chg: "-0.12%", up: false, color: "#6366f1" },
  { sym: "BTC", pair: "BTC/USD", price: "97,432.5", chg: "+2.34%", up: true,  color: "#f7931a" },
  { sym: "ETH", pair: "ETH/USD", price: "3,421.05", chg: "+1.82%", up: true,  color: "#627eea" },
  { sym: "SOL", pair: "SOL/USD", price: "187.34",   chg: "+3.21%", up: true,  color: "#9945ff" },
  { sym: "ARB", pair: "ARB/USD", price: "1.24",     chg: "-1.05%", up: false, color: "#12aaff" },
];

const TAB_ICONS: Array<{ key: SidebarTab; label: string; icon: React.ReactNode }> = [
  {
    key: "markets",
    label: "Markets",
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="2" y="4" width="12" height="1.5" rx="0.5" fill="currentColor"/><rect x="2" y="7.25" width="9" height="1.5" rx="0.5" fill="currentColor" opacity="0.7"/><rect x="2" y="10.5" width="6" height="1.5" rx="0.5" fill="currentColor" opacity="0.4"/></svg>,
  },
  {
    key: "watchlist",
    label: "Watchlist",
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 2L9.5 5.5H13.5L10.5 7.5L11.5 11L8 9L4.5 11L5.5 7.5L2.5 5.5H6.5L8 2Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/></svg>,
  },
  {
    key: "scanner",
    label: "Scanner",
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.2"/><path d="M10.5 10.5L13.5 13.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M5 7H9M7 5V9" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg>,
  },
];

export function LeftSidebar() {
  const { sidebarOpen, setSidebarOpen, market, setMarket } = useTerminal();
  const [activeTab, setActiveTab] = useState<SidebarTab>("markets");
  const [starred, setStarred] = useState<Set<string>>(new Set(["XAU", "SPX"]));
  const { markets } = useAllMarkets();

  const handleTabClick = (tab: SidebarTab) => {
    if (!sidebarOpen) {
      setSidebarOpen(true);
      setActiveTab(tab);
    } else if (activeTab === tab) {
      setSidebarOpen(false);
    } else {
      setActiveTab(tab);
    }
  };

  return (
    <div style={{
      width: sidebarOpen ? "var(--w-sidebar-open)" : "var(--w-sidebar-closed)",
      flexShrink: 0,
      borderRight: "1px solid var(--b1)",
      display: "flex",
      background: "var(--surface)",
      overflow: "hidden",
      transition: "width 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
    }}>
      {/* ── Icon strip (always 40px) ── */}
      <div style={{
        width: 40, flexShrink: 0,
        display: "flex", flexDirection: "column", alignItems: "center",
        paddingTop: 6, gap: 2,
        borderRight: sidebarOpen ? "1px solid var(--b1)" : "none",
      }}>
        {TAB_ICONS.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-label={t.label}
            aria-pressed={sidebarOpen && activeTab === t.key}
            onClick={() => handleTabClick(t.key)}
            style={{
              width: 28, height: 28, borderRadius: 6,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: sidebarOpen && activeTab === t.key ? "var(--gold)" : "var(--t3)",
              background: sidebarOpen && activeTab === t.key ? "var(--gold-dim)" : "transparent",
              transition: "color 0.1s, background-color 0.1s",
            }}
          >
            {t.icon}
          </button>
        ))}

        {/* Collapse toggle at bottom */}
        <button
          type="button"
          aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{
            marginTop: "auto", marginBottom: 8,
            width: 28, height: 28, borderRadius: 6,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--t3)", transition: "color 0.1s",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"
            style={{ transform: sidebarOpen ? "rotate(0deg)" : "rotate(180deg)", transition: "transform 0.2s" }}>
            <path d="M8 2L4 6L8 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* ── Panel content (200px) ── */}
      {sidebarOpen && (
        <div style={{
          flex: 1, minWidth: 0, display: "flex", flexDirection: "column",
          opacity: sidebarOpen ? 1 : 0,
          transition: "opacity 0.15s",
          overflow: "hidden",
        }}>
          {/* Panel header */}
          <div style={{
            height: 36, display: "flex", alignItems: "center", padding: "0 10px",
            borderBottom: "1px solid var(--b1)", flexShrink: 0,
          }}>
            <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--t2)", textTransform: "capitalize" }}>
              {activeTab}
            </span>
          </div>

          {/* ── Markets tab ── */}
          {activeTab === "markets" && (
            <div style={{ flex: 1, overflowY: "auto" }}>
              {AVAILABLE_TERMINAL_MARKETS.map((m) => {
                const liveInfo = markets.find((mi) => mi.id === m.id);
                const priceStr = liveInfo && liveInfo.markPrice > 0n ? formatPrice(liveInfo.markPrice) : "—";
                const isActive = market.id === m.id;
                const change = m.id === AVAILABLE_TERMINAL_MARKETS[0].id ? { str: "+0.45%", up: true } : { str: "-0.12%", up: false };

                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMarket(m)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 8,
                      padding: "7px 10px",
                      background: isActive ? "var(--raised)" : "transparent",
                      borderLeft: isActive ? `2px solid ${m.color}` : "2px solid transparent",
                      transition: "background-color 0.1s, border-color 0.1s",
                      textAlign: "left",
                    }}
                  >
                    <span style={{
                      width: 20, height: 20, borderRadius: "50%", background: m.color,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 7, fontWeight: 800, color: "#fff", flexShrink: 0,
                    }} aria-hidden="true">{m.symbol[0]}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "var(--text-xs)", fontWeight: "var(--fw-medium)" as unknown as number, color: isActive ? "var(--t1)" : "var(--t2)" }}>{m.pair}</div>
                      <div style={{ fontSize: "var(--text-2xs)", color: change.up ? "var(--long)" : "var(--short)" }}>{change.str}</div>
                    </div>
                    <span className="tabular" style={{ fontSize: "var(--text-xs)", color: "var(--t2)", flexShrink: 0 }}>${priceStr}</span>
                  </button>
                );
              })}
              <div style={{ height: 1, background: "var(--b1)", margin: "4px 0" }} />
              <div style={{ padding: "6px 10px" }}>
                <span style={{ fontSize: "var(--text-2xs)", color: "var(--t4)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  More markets coming soon
                </span>
              </div>
            </div>
          )}

          {/* ── Watchlist tab ── */}
          {activeTab === "watchlist" && (
            <div style={{ flex: 1, overflowY: "auto" }}>
              {WATCH_TOKENS.map((t) => {
                const isStarred = starred.has(t.sym);
                return (
                  <div key={t.sym} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "7px 10px",
                    borderBottom: "1px solid var(--b1)",
                  }}>
                    <button
                      type="button"
                      aria-label={isStarred ? `Remove ${t.sym} from watchlist` : `Add ${t.sym} to watchlist`}
                      onClick={() => setStarred(prev => {
                        const next = new Set(prev);
                        isStarred ? next.delete(t.sym) : next.add(t.sym);
                        return next;
                      })}
                      style={{ color: isStarred ? "var(--gold)" : "var(--t4)", fontSize: "var(--text-sm)", flexShrink: 0, transition: "color 0.1s" }}
                    >
                      {isStarred ? "★" : "☆"}
                    </button>
                    <span style={{
                      width: 18, height: 18, borderRadius: "50%", background: t.color,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 7, fontWeight: 800, color: "#fff", flexShrink: 0,
                    }} aria-hidden="true">{t.sym[0]}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "var(--text-xs)", fontWeight: 500, color: "var(--t2)" }}>{t.sym}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="tabular" style={{ fontSize: "var(--text-xs)", color: "var(--t1)" }}>${t.price}</div>
                      <div style={{ fontSize: "var(--text-2xs)", color: t.up ? "var(--long)" : "var(--short)" }}>{t.chg}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Scanner tab ── */}
          {activeTab === "scanner" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: 16 }}>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true" style={{ opacity: 0.15 }}>
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
                <path d="M19 19L25 25" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--t3)", textAlign: "center" }}>
                Scanner coming soon
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
