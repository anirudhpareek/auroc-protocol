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
    label: "Portfolio",
    href: "/portfolio",
    svg: <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><rect x="1" y="5" width="2.5" height="6" rx="0.5" fill="currentColor" opacity="0.5"/><rect x="4.75" y="2.5" width="2.5" height="8.5" rx="0.5" fill="currentColor" opacity="0.75"/><rect x="8.5" y="0.5" width="2.5" height="10.5" rx="0.5" fill="currentColor"/></svg>,
  },
  {
    label: "Swap",
    href: "/swap",
    svg: <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2 4.5H10M8 2L10 4.5L8 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 7.5H2M4 5L2 7.5L4 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
];

export function StatusBar() {
  const pathname = usePathname();
  return (
    <div
      className="flex items-center shrink-0"
      style={{
        height: 28,
        background: "var(--surface)",
        borderTop: "1px solid var(--b1)",
        padding: "0 8px",
        fontSize: "var(--text-xs)",
        zIndex: 50,
      }}
    >
      {/* Left nav */}
      <div className="flex items-center flex-1">
        {LEFT_NAV.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="flex items-center gap-[5px] h-7 no-underline transition-colors"
            style={{
              padding: "0 10px",
              color: pathname === item.href ? "var(--t1)" : "var(--t3)",
              fontSize: "var(--text-xs)",
              fontWeight: 500,
              borderRight: "1px solid var(--b1)",
            }}
          >
            {item.svg}
            <span>{item.label}</span>
          </Link>
        ))}
      </div>

      {/* Right */}
      <div className="flex items-center ml-auto">
        {[
          { label: "Docs", href: "#" },
          { label: "Support", href: "#" },
        ].map((item) => (
          <a
            key={item.label}
            href={item.href}
            className="flex items-center h-7 no-underline transition-colors"
            style={{
              padding: "0 10px",
              color: "var(--t3)",
              fontSize: "var(--text-xs)",
              borderLeft: "1px solid var(--b1)",
            }}
          >
            {item.label}
          </a>
        ))}
        <div
          className="flex items-center gap-[5px] h-7"
          style={{ padding: "0 10px", borderLeft: "1px solid var(--b1)" }}
        >
          <div
            className="animate-live w-1.5 h-1.5 rounded-full"
            aria-hidden="true"
            style={{ background: "var(--long)" }}
          />
          <span style={{ color: "var(--t2)", fontSize: "var(--text-xs)" }}>Connected</span>
        </div>
      </div>
    </div>
  );
}
