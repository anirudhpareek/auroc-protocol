"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";

const NAV = [
  { label: "Trade",     href: "/" },
  { label: "Portfolio", href: "/portfolio" },
  { label: "Perps",     href: "/" },
  { label: "Swap",      href: "/swap" },
  { label: "Vault",     href: "/vault" },
];

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

const S: Record<string, React.CSSProperties> = {
  header: { background: "var(--surface)", borderBottom: "1px solid var(--b1)" },
  topbar: { height: 44, display: "flex", alignItems: "center", padding: "0 16px", gap: 8 },
  logo:   { display: "flex", alignItems: "center", gap: 8, marginRight: 8, textDecoration: "none" },
  logoBox:{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#f4c53d,#e0a020)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 10px rgba(244,197,61,0.25)", flexShrink: 0 },
  logoTxt:{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.03em", color: "var(--t1)" },
  nav:    { display: "flex", alignItems: "center", gap: 2 },
  badge:  { display: "flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 20, background: "var(--gold-bg)", border: "1px solid rgba(244,197,61,0.20)", flexShrink: 0 },
  badgeTxt:{ fontSize: 11, fontWeight: 700, color: "var(--gold)", letterSpacing: "0.06em" },
  spacer: { flex: 1 },
  search: { display: "flex", alignItems: "center", gap: 8, padding: "0 10px", borderRadius: 8, background: "var(--raised)", border: "1px solid var(--b1)", height: 30, width: 180, cursor: "text" },
  menuBtn:{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 8, background: "var(--raised)", border: "1px solid var(--b1)", cursor: "pointer" },
  iconBtn:{ width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--t2)", transition: "background 0.1s" },

  strip:  { height: 32, display: "flex", alignItems: "center", borderTop: "1px solid var(--b1)", background: "var(--bg)" },
  watchLabel: { display: "flex", alignItems: "center", gap: 6, padding: "0 12px", height: "100%", borderRight: "1px solid var(--b1)", flexShrink: 0, minWidth: 96 },
};

function NavLink({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link href={href} style={{
      padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, textDecoration: "none",
      background: active ? "rgba(255,255,255,0.10)" : "transparent",
      color: active ? "var(--t1)" : "var(--t2)",
      transition: "all 0.1s",
    }}>
      {label}
    </Link>
  );
}

export function Header() {
  const pathname = usePathname();
  const isPerps = pathname === "/";

  return (
    <header style={S.header}>
      {/* ── Top bar ── */}
      <div style={S.topbar}>
        <Link href="/" style={S.logo}>
          <div style={S.logoBox}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L12 6H9L7 12L5 6H2L7 1Z" fill="#0c0c0e"/>
              <path d="M7 1L12 6H2L7 1Z" fill="rgba(255,255,255,0.22)"/>
            </svg>
          </div>
          <span style={S.logoTxt}>AUROC</span>
        </Link>

        <nav style={S.nav}>
          <NavLink label="Trade"     href="/"          active={pathname === "/" && false} />
          <NavLink label="Portfolio" href="/portfolio" active={pathname === "/portfolio"} />
          <NavLink label="Perps"     href="/"          active={pathname === "/"} />
          <NavLink label="Swap"      href="/swap"      active={pathname === "/swap"} />
          <NavLink label="Vault"     href="/vault"     active={pathname === "/vault"} />
        </nav>

        {/* ARENA-style badge */}
        <div style={S.badge}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M5 0.5L6.5 3.5H9.5L7 5.5L8 9L5 7.2L2 9L3 5.5L0.5 3.5H3.5L5 0.5Z" fill="var(--gold)"/>
          </svg>
          <span style={S.badgeTxt}>VAULTS</span>
        </div>

        <div style={S.spacer} />

        {/* Search */}
        <div style={S.search}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="5" cy="5" r="4" stroke="var(--t3)" strokeWidth="1.3"/>
            <path d="M8.5 8.5L10.5 10.5" stroke="var(--t3)" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <span style={{ fontSize: 12, color: "var(--t3)", flex: 1 }}>Search markets...</span>
          <span style={{ fontSize: 10, color: "var(--t4)", background: "var(--hover)", padding: "1px 4px", borderRadius: 4 }}>/</span>
        </div>

        {/* Menu count */}
        <div style={S.menuBtn}>
          <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
            <rect width="12" height="1.5" rx="0.75" fill="var(--t2)"/>
            <rect y="3.75" width="12" height="1.5" rx="0.75" fill="var(--t2)"/>
            <rect y="7.5"  width="12" height="1.5" rx="0.75" fill="var(--t2)"/>
          </svg>
          <span style={{ fontSize: 12, color: "var(--t2)", fontWeight: 500 }}>0</span>
        </div>

        {/* Bell */}
        <div style={S.iconBtn}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1C4.79 1 3 2.79 3 5V8.5L1.5 10H12.5L11 8.5V5C11 2.79 9.21 1 7 1Z" stroke="var(--t2)" strokeWidth="1.2" strokeLinejoin="round"/>
            <path d="M5.5 10.5C5.5 11.33 6.17 12 7 12S8.5 11.33 8.5 10.5" stroke="var(--t2)" strokeWidth="1.2"/>
          </svg>
        </div>

        {/* Wallet */}
        <ConnectButton.Custom>
          {({ account, openConnectModal, openAccountModal, mounted }) => {
            if (!mounted) return <div style={{ width: 110, height: 28 }} />;
            if (!account) return (
              <button onClick={openConnectModal} style={{
                padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: "rgba(255,255,255,0.08)", color: "var(--t1)",
                border: "1px solid var(--b2)", cursor: "pointer",
              }}>
                Connect
              </button>
            );
            return (
              <button onClick={openAccountModal} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "4px 10px", borderRadius: 8, background: "var(--raised)",
                border: "1px solid var(--b2)", cursor: "pointer",
              }}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", background: "linear-gradient(135deg,var(--gold),var(--long))" }} />
                <span style={{ fontSize: 12, color: "var(--t1)", fontFamily: "monospace" }}>{account.displayName}</span>
              </button>
            );
          }}
        </ConnectButton.Custom>
      </div>

      {/* ── Watchlist / Perps strip ── */}
      {isPerps ? (
        <div style={{ ...S.strip, padding: "0 16px", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: "var(--t3)" }}>No tokens in your perpetuals watchlist</span>
          <div style={{ display: "flex", gap: 10 }}>
            <span style={{ fontSize: 11, color: "var(--t3)" }}>$</span>
            <span style={{ fontSize: 11, color: "var(--t3)" }}>%</span>
          </div>
        </div>
      ) : (
        <div style={{ ...S.strip, position: "relative", overflow: "hidden" }}>
          <div style={S.watchLabel}>
            <span style={{ fontSize: 11, color: "var(--t2)", fontWeight: 500 }}>Watchlist</span>
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <path d="M1 3L4 6L7 3" stroke="var(--t3)" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </div>
          <div style={{ position: "absolute", left: 96, top: 0, bottom: 0, width: 20, background: "linear-gradient(to right, var(--bg), transparent)", zIndex: 1, pointerEvents: "none" }} />
          <div style={{ position: "absolute", right: 40, top: 0, bottom: 0, width: 20, background: "linear-gradient(to left, var(--bg), transparent)", zIndex: 1, pointerEvents: "none" }} />
          <div className="animate-ticker" style={{ display: "flex", alignItems: "center", width: "max-content" }}>
            {[...WATCH_TOKENS, ...WATCH_TOKENS].map((t, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 16px", cursor: "pointer", flexShrink: 0 }}>
                <div style={{ width: 16, height: 16, borderRadius: "50%", background: t.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 800, color: "#fff", flexShrink: 0 }}>{t.sym[0]}</div>
                <span style={{ fontSize: 11, color: "var(--t2)", fontWeight: 500 }}>{t.sym}</span>
                <span className="tabular" style={{ fontSize: 11, color: "var(--t1)" }}>${t.price}</span>
                <span style={{ fontSize: 10, color: t.up ? "var(--long)" : "var(--short)" }}>{t.chg}</span>
              </div>
            ))}
          </div>
          <div style={{ position: "absolute", right: 0, display: "flex", alignItems: "center", gap: 6, padding: "0 8px", height: "100%", background: "var(--bg)", borderLeft: "1px solid var(--b1)", zIndex: 2 }}>
            <span style={{ fontSize: 12, color: "var(--t3)", cursor: "pointer" }}>★</span>
            <div style={{ width: 1, height: 10, background: "var(--b1)" }} />
            <div className="animate-live" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--long)" }} />
          </div>
        </div>
      )}
    </header>
  );
}
