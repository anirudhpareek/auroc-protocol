"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LEFT_NAV = [
  { icon: "📈", label: "Positions", href: "/" },
  { icon: "🔔", label: "Alerts",    href: "/" },
  { icon: "◈",  label: "Portfolio", href: "/portfolio" },
  { icon: "↕",  label: "Swap",      href: "/swap" },
  { icon: "⬡",  label: "Explorer",  href: "/" },
  { icon: "📊", label: "PnL",       href: "/" },
];

export function StatusBar() {
  const pathname = usePathname();
  return (
    <div style={{
      height: 32, background: "var(--surface)", borderTop: "1px solid var(--b1)",
      display: "flex", alignItems: "center", padding: "0 8px", gap: 0, flexShrink: 0,
      fontSize: 11, zIndex: 50,
    }}>
      {/* Left nav items */}
      <div style={{ display: "flex", alignItems: "center", flex: 1 }}>
        {LEFT_NAV.map((item) => (
          <Link key={item.label} href={item.href} style={{
            display: "flex", alignItems: "center", gap: 5, padding: "0 10px", height: 32,
            color: pathname === item.href ? "var(--t1)" : "var(--t2)",
            textDecoration: "none", fontSize: 11, fontWeight: 500,
            borderRight: "1px solid var(--b1)", transition: "color 0.1s",
          }}>
            <span style={{ fontSize: 11 }}>{item.icon}</span>
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
          <span style={{ color: "var(--t3)" }}>≡</span>
          <span className="tabular" style={{ color: "var(--t2)" }}>$0.00</span>
        </div>
      </div>

      {/* Right */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginLeft: "auto" }}>
        {[
          { label: "Docs",     href: "#" },
          { label: "Support",  href: "#" },
        ].map((item) => (
          <a key={item.label} href={item.href} style={{
            display: "flex", alignItems: "center", padding: "0 10px", height: 32,
            color: "var(--t3)", textDecoration: "none", fontSize: 11,
            borderLeft: "1px solid var(--b1)", transition: "color 0.1s",
          }}>
            {item.label}
          </a>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "0 10px", height: 32, borderLeft: "1px solid var(--b1)" }}>
          <div className="animate-live" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--long)" }} />
          <span style={{ color: "var(--t2)", fontSize: 11 }}>Connected</span>
        </div>
        <button style={{ display: "flex", alignItems: "center", padding: "0 10px", height: 32, borderLeft: "1px solid var(--b1)", color: "var(--t3)" }}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M4 6.5H9M6.5 4V9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
