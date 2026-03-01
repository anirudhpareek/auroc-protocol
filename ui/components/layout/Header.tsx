"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import type { RefObject, ReactNode } from "react";

const WATCH_TOKENS = [
  { sym: "XAU", pair: "XAU/USD", price: "2,892.40", chg: "+0.45%", up: true,  color: "#d4a017" },
  { sym: "SPX", pair: "SPX/USD", price: "5,234.18", chg: "-0.12%", up: false, color: "#22c55e" },
  { sym: "BTC", pair: "BTC/USD", price: "97,432.5", chg: "+2.34%", up: true,  color: "#f7931a" },
  { sym: "ETH", pair: "ETH/USD", price: "3,421.05", chg: "+1.82%", up: true,  color: "#627eea" },
  { sym: "SOL", pair: "SOL/USD", price: "187.34",   chg: "+3.21%", up: true,  color: "#9945ff" },
  { sym: "ARB", pair: "ARB/USD", price: "1.24",     chg: "-1.05%", up: false, color: "#12aaff" },
  { sym: "WTI", pair: "WTI/USD", price: "72.48",    chg: "-0.63%", up: false, color: "#8b6914" },
  { sym: "GLD", pair: "GLD/USD", price: "2,891.80", chg: "+0.41%", up: true,  color: "#ffd700" },
];

function NavLink({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link href={href} style={{
      position: "relative",
      padding: "4px 13px",
      borderRadius: 6,
      fontSize: "var(--text-base)",
      fontWeight: active ? "var(--fw-semibold)" as unknown as number : "var(--fw-regular)" as unknown as number,
      textDecoration: "none",
      color: active ? "var(--t1)" : "var(--t2)",
      transition: "color 0.15s, background-color 0.15s",
      background: active ? "var(--hover)" : "transparent",
      letterSpacing: active ? "-0.01em" : "0",
    }}>
      {label}
      {active && (
        <span style={{
          position: "absolute",
          bottom: -1,
          left: "50%",
          transform: "translateX(-50%)",
          width: 16,
          height: 2,
          borderRadius: 1,
          background: "var(--gold)",
          boxShadow: "0 0 6px var(--gold-glow)",
        }} />
      )}
    </Link>
  );
}

interface HeaderProps {
  searchRef?: RefObject<HTMLInputElement | null>;
  densityToggle?: ReactNode;
}

export function Header({ searchRef, densityToggle }: HeaderProps = {}) {
  const pathname = usePathname();
  const isPerps = pathname === "/";

  return (
    <header style={{
      background: "var(--surface)",
      borderBottom: "1px solid var(--b1)",
      /* Subtle gold accent on very top edge */
      boxShadow: "inset 0 1px 0 rgba(245,200,66,0.12)",
    }}>
      {/* ── Top bar ── */}
      <div style={{ height: 46, display: "flex", alignItems: "center", padding: "0 16px", gap: 10 }}>

        {/* Logo */}
        <Link href="/" aria-label="Auroc Protocol — home" style={{ display: "flex", alignItems: "center", gap: 9, marginRight: 6, textDecoration: "none", flexShrink: 0 }}>
          <div aria-hidden="true" style={{
            width: 30, height: 30, borderRadius: 9,
            background: "linear-gradient(145deg, #f5c842 0%, #e09a10 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 12px rgba(245,200,66,0.35), 0 2px 4px rgba(0,0,0,0.4)",
            flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 1L12 6H9L7 12L5 6H2L7 1Z" fill="#1a1000"/>
              <path d="M7 1L12 6H2L7 1Z" fill="rgba(255,255,255,0.3)"/>
            </svg>
          </div>
          <span style={{ fontWeight: "var(--fw-bold)" as unknown as number, fontSize: "var(--text-lg)", letterSpacing: "-0.04em", color: "var(--t1)" }}>
            AUROC
          </span>
        </Link>

        {/* Nav */}
        <nav style={{ display: "flex", alignItems: "center", gap: 1 }} aria-label="Main navigation">
          <NavLink label="Trade"     href="/"          active={pathname === "/" && false} />
          <NavLink label="Portfolio" href="/portfolio" active={pathname === "/portfolio"} />
          <NavLink label="Perps"     href="/"          active={pathname === "/"} />
          <NavLink label="Swap"      href="/swap"      active={pathname === "/swap"} />
          <NavLink label="Vault"     href="/vault"     active={pathname === "/vault"} />
        </nav>

        {/* Vaults badge */}
        <div aria-hidden="true" style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "3px 9px", borderRadius: 20,
          background: "var(--gold-bg)",
          border: "1px solid rgba(245,200,66,0.22)",
          flexShrink: 0,
        }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path d="M5 0.5L6.5 3.5H9.5L7 5.5L8 9L5 7.2L2 9L3 5.5L0.5 3.5H3.5L5 0.5Z" fill="var(--gold)"/>
          </svg>
          <span style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--fw-bold)" as unknown as number, color: "var(--gold)", letterSpacing: "0.07em" }}>VAULTS</span>
        </div>

        <div style={{ flex: 1 }} />

        {/* Search */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "0 11px", borderRadius: 8,
          background: "var(--raised)", border: "1px solid var(--b2)",
          height: 32, width: 190,
          color: "var(--t3)",
          transition: "border-color 0.15s, background-color 0.15s",
        }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
            <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M8.5 8.5L10.5 10.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <input
            ref={searchRef}
            type="search"
            placeholder="Search markets…"
            aria-label="Search markets"
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              fontSize: "var(--text-sm)", color: "var(--t2)",
            }}
          />
          <span style={{
            fontSize: "var(--text-2xs)", color: "var(--t4)",
            background: "var(--active)", padding: "1px 5px", borderRadius: 4,
            border: "1px solid var(--b1)", flexShrink: 0,
          }}>/</span>
        </div>

        {/* Density toggle (injected by TerminalShell) */}
        {densityToggle}

        {/* Menu */}
        <button aria-label="Open menu" style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "5px 11px", borderRadius: 8,
          background: "var(--raised)", border: "1px solid var(--b2)",
        }}>
          <svg width="13" height="10" viewBox="0 0 13 10" fill="none" aria-hidden="true">
            <rect width="13" height="1.5" rx="0.75" fill="var(--t2)"/>
            <rect y="4.25" width="13" height="1.5" rx="0.75" fill="var(--t2)"/>
            <rect y="8.5"  width="13" height="1.5" rx="0.75" fill="var(--t2)"/>
          </svg>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--t2)", fontWeight: "var(--fw-medium)" as unknown as number }}>0</span>
        </button>

        {/* Bell */}
        <button aria-label="Notifications" style={{
          width: 32, height: 32, borderRadius: 8,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--t2)", border: "1px solid transparent",
          transition: "background-color 0.15s, border-color 0.15s",
        }}>
          <svg width="15" height="15" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M7 1C4.79 1 3 2.79 3 5V8.5L1.5 10H12.5L11 8.5V5C11 2.79 9.21 1 7 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
            <path d="M5.5 10.5C5.5 11.33 6.17 12 7 12S8.5 11.33 8.5 10.5" stroke="currentColor" strokeWidth="1.2"/>
          </svg>
        </button>

        {/* Wallet */}
        <ConnectButton.Custom>
          {({ account, openConnectModal, openAccountModal, mounted }) => {
            if (!mounted) return <div aria-hidden="true" style={{ width: 110, height: 32 }} />;
            if (!account) return (
              <button onClick={openConnectModal} style={{
                padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: "rgba(245,200,66,0.10)",
                color: "var(--gold)",
                border: "1px solid rgba(245,200,66,0.25)",
                letterSpacing: "-0.01em",
                transition: "background-color 0.15s, border-color 0.15s",
              }}>
                Connect
              </button>
            );
            return (
              <button onClick={openAccountModal} style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "5px 11px", borderRadius: 8,
                background: "var(--raised)", border: "1px solid var(--b2)",
                transition: "background-color 0.15s, border-color 0.15s",
              }}>
                <div aria-hidden="true" style={{
                  width: 16, height: 16, borderRadius: "50%",
                  background: "linear-gradient(135deg, var(--gold), var(--long))",
                  flexShrink: 0, boxShadow: "0 0 6px rgba(245,200,66,0.3)",
                }} />
                <span style={{ fontSize: "var(--text-sm)", color: "var(--t1)", fontFamily: "var(--mono)", letterSpacing: "-0.02em" }}>
                  {account.displayName}
                </span>
              </button>
            );
          }}
        </ConnectButton.Custom>
      </div>

      {/* ── Watchlist / Perps strip ── */}
      {isPerps ? (
        <div style={{
          height: 30, display: "flex", alignItems: "center",
          borderTop: "1px solid var(--b1)", background: "var(--bg)",
          padding: "0 16px", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--t3)" }}>No tokens in your perpetuals watchlist</span>
          <div style={{ display: "flex", gap: 10 }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--t3)" }}>$</span>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--t3)" }}>%</span>
          </div>
        </div>
      ) : (
        <div style={{
          height: 30, display: "flex", alignItems: "center",
          borderTop: "1px solid var(--b1)", background: "var(--bg)",
          position: "relative", overflow: "hidden",
        }}>
          {/* Watchlist label */}
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "0 12px", height: "100%",
            borderRight: "1px solid var(--b1)", flexShrink: 0, minWidth: 96,
          }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--t2)", fontWeight: "var(--fw-medium)" as unknown as number }}>Watchlist</span>
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
              <path d="M1 3L4 6L7 3" stroke="var(--t3)" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </div>

          {/* Fade edges */}
          <div aria-hidden="true" style={{ position: "absolute", left: 96, top: 0, bottom: 0, width: 24, background: "linear-gradient(to right, var(--bg), transparent)", zIndex: 1, pointerEvents: "none" }} />
          <div aria-hidden="true" style={{ position: "absolute", right: 44, top: 0, bottom: 0, width: 24, background: "linear-gradient(to left, var(--bg), transparent)", zIndex: 1, pointerEvents: "none" }} />

          {/* Ticker */}
          <div className="animate-ticker" aria-hidden="true" style={{ display: "flex", alignItems: "center", width: "max-content" }}>
            {[...WATCH_TOKENS, ...WATCH_TOKENS].map((t, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, padding: "0 18px", flexShrink: 0 }}>
                <div style={{
                  width: 16, height: 16, borderRadius: "50%", background: t.color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 7, fontWeight: 800, color: "#fff", flexShrink: 0,
                }}>{t.sym[0]}</div>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--t2)", fontWeight: "var(--fw-medium)" as unknown as number }}>{t.sym}</span>
                <span className="tabular" style={{ fontSize: "var(--text-xs)", color: "var(--t1)" }}>${t.price}</span>
                <span style={{ fontSize: "var(--text-2xs)", color: t.up ? "var(--long)" : "var(--short)" }}>{t.chg}</span>
              </div>
            ))}
          </div>

          {/* Right controls */}
          <div style={{
            position: "absolute", right: 0,
            display: "flex", alignItems: "center", gap: 7,
            padding: "0 10px", height: "100%",
            background: "var(--bg)", borderLeft: "1px solid var(--b1)", zIndex: 2,
          }}>
            <button aria-label="Manage watchlist" style={{ fontSize: 13, color: "var(--t3)", padding: 2, lineHeight: 1 }}>★</button>
            <div aria-hidden="true" style={{ width: 1, height: 10, background: "var(--b1)" }} />
            <div className="animate-live" aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--long)" }} />
          </div>
        </div>
      )}
    </header>
  );
}
