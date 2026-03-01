"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LEFT_NAV = [
  {
    label: "Positions",
    href: "/",
    svg: <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><rect x="1" y="3" width="10" height="1.5" rx="0.5" fill="currentColor"/><rect x="1" y="6" width="7" height="1.5" rx="0.5" fill="currentColor"/><rect x="1" y="9" width="4" height="1.5" rx="0.5" fill="currentColor"/></svg>,
  },
  {
    label: "Alerts",
    href: "/",
    svg: <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M6 1C4.34 1 3 2.34 3 4V7L1.5 8.5H10.5L9 7V4C9 2.34 7.66 1 6 1Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/><path d="M4.5 8.5C4.5 9.33 5.17 10 6 10S7.5 9.33 7.5 8.5" stroke="currentColor" strokeWidth="1.1"/></svg>,
  },
  {
    label: "Portfolio",
    href: "/portfolio",
    svg: <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><rect x="1" y="5" width="2.5" height="6" rx="0.5" fill="currentColor" opacity="0.5"/><rect x="4.75" y="2.5" width="2.5" height="8.5" rx="0.5" fill="currentColor" opacity="0.75"/><rect x="8.5" y="0.5" width="2.5" height="10.5" rx="0.5" fill="currentColor"/></svg>,
  },
  {
    label: "Swap",
    href: "/swap",
    svg: <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2 4.5H10M8 2L10 4.5L8 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 7.5H2M4 5L2 7.5L4 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    label: "Explorer",
    href: "/",
    svg: <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.1"/><path d="M6 1C6 1 8.5 4 8.5 6S6 11 6 11M6 1C6 1 3.5 4 3.5 6S6 11 6 11M1 6H11" stroke="currentColor" strokeWidth="1.1"/></svg>,
  },
  {
    label: "PnL",
    href: "/",
    svg: <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M1 8L4 5L6.5 7L11 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
];

export function StatusBar() {
  const pathname = usePathname();
  return (
    <div style={{
      height: 28, background: "var(--surface)", borderTop: "1px solid var(--b1)",
      display: "flex", alignItems: "center", padding: "0 8px", gap: 0, flexShrink: 0,
      fontSize: "var(--text-xs)", zIndex: 50,
      boxShadow: "inset 0 -1px 0 rgba(245,200,66,0.06)",
    }}>
      {/* Left nav items */}
      <div style={{ display: "flex", alignItems: "center", flex: 1 }}>
        {LEFT_NAV.map((item) => (
          <Link key={item.label} href={item.href} style={{
            display: "flex", alignItems: "center", gap: 5, padding: "0 10px", height: 28,
            color: pathname === item.href ? "var(--t1)" : "var(--t2)",
            textDecoration: "none", fontSize: "var(--text-xs)", fontWeight: 500,
            borderRight: "1px solid var(--b1)", transition: "color 0.1s",
          }}>
            {item.svg}
            <span className="hidden sm:block">{item.label}</span>
          </Link>
        ))}
      </div>

      {/* Center: portfolio stats */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 16px" }}>
        <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444" }} />
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b" }} />
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--long)" }} />
        </div>
        <span style={{ color: "var(--t1)", fontWeight: 500 }} className="tabular">$0.00</span>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--blue)" }} />
          <span className="tabular" style={{ color: "var(--t2)" }}>$0.00</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <rect x="1" y="2" width="8" height="1.2" rx="0.5" fill="currentColor" opacity="0.4"/>
            <rect x="1" y="4.4" width="8" height="1.2" rx="0.5" fill="currentColor" opacity="0.7"/>
            <rect x="1" y="6.8" width="8" height="1.2" rx="0.5" fill="currentColor"/>
          </svg>
          <span className="tabular" style={{ color: "var(--t2)" }}>$0.00</span>
        </div>
      </div>

      {/* Right */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginLeft: "auto" }}>
        {[
          { label: "Docs",    href: "#" },
          { label: "Support", href: "#" },
        ].map((item) => (
          <a key={item.label} href={item.href} style={{
            display: "flex", alignItems: "center", padding: "0 10px", height: 28,
            color: "var(--t3)", textDecoration: "none", fontSize: "var(--text-xs)",
            borderLeft: "1px solid var(--b1)", transition: "color 0.1s",
          }}>
            {item.label}
          </a>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "0 10px", height: 28, borderLeft: "1px solid var(--b1)" }}>
          <div className="animate-live" aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--long)" }} />
          <span style={{ color: "var(--t2)", fontSize: "var(--text-xs)" }}>Connected</span>
        </div>
        <button type="button" aria-label="Add widget" style={{ display: "flex", alignItems: "center", padding: "0 10px", height: 28, borderLeft: "1px solid var(--b1)", color: "var(--t3)", transition: "color 0.1s" }}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
            <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M4 6.5H9M6.5 4V9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
