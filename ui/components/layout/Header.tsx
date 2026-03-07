"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import type { RefObject, ReactNode } from "react";
import { Search, Bell } from "lucide-react";

/* ─── Watchlist data ─── */
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

/* ─── Nav link with active gold underline dot ─── */
function NavLink({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={[
        "relative px-3 py-1 rounded-md text-[length:var(--text-base)] no-underline",
        "transition-colors duration-150",
        active
          ? "font-semibold tracking-tight"
          : "font-normal tracking-normal",
      ].join(" ")}
      style={{
        color: active ? "var(--t1)" : "var(--t2)",
        backgroundColor: active ? "var(--hover)" : "transparent",
      }}
    >
      {label}
      {active && (
        <span
          className="absolute -bottom-px left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-sm"
          style={{
            background: "var(--gold)",
            boxShadow: "0 0 6px var(--gold-glow)",
          }}
        />
      )}
    </Link>
  );
}

/* ─── Props ─── */
interface HeaderProps {
  searchRef?: RefObject<HTMLInputElement | null>;
  densityToggle?: ReactNode;
}

/* ─── Header ─── */
export function Header({ searchRef, densityToggle }: HeaderProps) {
  const pathname = usePathname();
  const isTrade = pathname === "/";

  return (
    <header
      className="border-b"
      style={{
        background: "var(--surface)",
        borderColor: "var(--b1)",
        boxShadow: "inset 0 1px 0 rgba(245,200,66,0.12)",
      }}
    >
      {/* ── Top bar ── */}
      <div className="flex items-center h-[46px] px-4 gap-2.5">

        {/* Logo */}
        <Link
          href="/"
          aria-label="Auroc Protocol - home"
          className="flex items-center gap-2 mr-1.5 no-underline shrink-0"
        >
          <div
            aria-hidden="true"
            className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center shrink-0"
            style={{
              background: "linear-gradient(145deg, #f5c842 0%, #e09a10 100%)",
              boxShadow: "0 0 12px rgba(245,200,66,0.35), 0 2px 4px rgba(0,0,0,0.4)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 1L12 6H9L7 12L5 6H2L7 1Z" fill="#1a1000" />
              <path d="M7 1L12 6H2L7 1Z" fill="rgba(255,255,255,0.3)" />
            </svg>
          </div>
          <span
            className="font-bold text-[length:var(--text-lg)] tracking-tighter"
            style={{ color: "var(--t1)" }}
          >
            AUROC
          </span>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-px" aria-label="Main navigation">
          <NavLink label="Trade"     href="/"          active={pathname === "/"} />
          <NavLink label="Portfolio" href="/portfolio" active={pathname === "/portfolio"} />
          <NavLink label="Swap"      href="/swap"      active={pathname === "/swap"} />
          <NavLink label="Vault"     href="/vault"     active={pathname === "/vault"} />
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Search */}
        <div
          className="flex items-center gap-2 px-3 rounded-lg h-8 w-[190px] transition-colors duration-150"
          style={{
            background: "var(--raised)",
            border: "1px solid var(--b2)",
            color: "var(--t3)",
          }}
        >
          <Search size={12} aria-hidden="true" className="shrink-0" />
          <input
            ref={searchRef}
            type="search"
            placeholder="Search markets..."
            aria-label="Search markets"
            className="flex-1 bg-transparent border-none outline-none text-[length:var(--text-sm)]"
            style={{ color: "var(--t2)" }}
          />
          <kbd
            className="shrink-0 text-[length:var(--text-2xs)] px-1.5 py-px rounded"
            style={{
              color: "var(--t4)",
              background: "var(--active)",
              border: "1px solid var(--b1)",
            }}
          >
            /
          </kbd>
        </div>

        {/* Density toggle slot */}
        {densityToggle}

        {/* Notifications */}
        <button
          aria-label="Notifications"
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-150
                     hover:bg-[var(--hover)] focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] focus-visible:outline-offset-2"
          style={{ color: "var(--t2)" }}
        >
          <Bell size={14} aria-hidden="true" />
        </button>

        {/* Wallet connect */}
        <ConnectButton.Custom>
          {({ account, openConnectModal, openAccountModal, mounted }) => {
            if (!mounted) {
              return <div aria-hidden="true" className="w-[110px] h-8" />;
            }

            if (!account) {
              return (
                <button
                  onClick={openConnectModal}
                  className="px-3.5 py-1.5 rounded-lg text-[13px] font-semibold tracking-tight
                             transition-colors duration-150
                             hover:border-[rgba(245,200,66,0.40)]
                             focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] focus-visible:outline-offset-2"
                  style={{
                    background: "rgba(245,200,66,0.10)",
                    color: "var(--gold)",
                    border: "1px solid rgba(245,200,66,0.25)",
                  }}
                >
                  Connect
                </button>
              );
            }

            return (
              <button
                onClick={openAccountModal}
                className="flex items-center gap-[7px] px-3 py-[5px] rounded-lg transition-colors duration-150
                           hover:bg-[var(--hover)]
                           focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] focus-visible:outline-offset-2"
                style={{
                  background: "var(--raised)",
                  border: "1px solid var(--b2)",
                }}
              >
                <div
                  aria-hidden="true"
                  className="w-4 h-4 rounded-full shrink-0"
                  style={{
                    background: "linear-gradient(135deg, var(--gold), var(--long))",
                    boxShadow: "0 0 6px rgba(245,200,66,0.3)",
                  }}
                />
                <span
                  className="text-[length:var(--text-sm)] tracking-tight"
                  style={{
                    color: "var(--t1)",
                    fontFamily: "var(--mono)",
                  }}
                >
                  {account.displayName}
                </span>
              </button>
            );
          }}
        </ConnectButton.Custom>
      </div>

      {/* ── Watchlist ticker strip (non-Trade pages only) ── */}
      {!isTrade && (
        <div
          className="flex items-center h-[30px] relative overflow-hidden border-t"
          style={{
            background: "var(--bg)",
            borderColor: "var(--b1)",
          }}
        >
          {/* Watchlist label */}
          <div
            className="flex items-center gap-1.5 px-3 h-full shrink-0 min-w-[96px] border-r"
            style={{ borderColor: "var(--b1)" }}
          >
            <span
              className="text-[length:var(--text-xs)] font-medium"
              style={{ color: "var(--t2)" }}
            >
              Watchlist
            </span>
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
              <path d="M1 3L4 6L7 3" stroke="var(--t3)" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </div>

          {/* Left fade */}
          <div
            aria-hidden="true"
            className="absolute left-[96px] top-0 bottom-0 w-6 z-[1] pointer-events-none"
            style={{ background: "linear-gradient(to right, var(--bg), transparent)" }}
          />
          {/* Right fade */}
          <div
            aria-hidden="true"
            className="absolute right-11 top-0 bottom-0 w-6 z-[1] pointer-events-none"
            style={{ background: "linear-gradient(to left, var(--bg), transparent)" }}
          />

          {/* Scrolling ticker */}
          <div
            className="animate-ticker flex items-center w-max"
            aria-hidden="true"
          >
            {[...WATCH_TOKENS, ...WATCH_TOKENS].map((t, i) => (
              <div key={i} className="flex items-center gap-[7px] px-[18px] shrink-0">
                <div
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-extrabold text-white shrink-0"
                  style={{ background: t.color }}
                >
                  {t.sym[0]}
                </div>
                <span
                  className="text-[length:var(--text-xs)] font-medium"
                  style={{ color: "var(--t2)" }}
                >
                  {t.sym}
                </span>
                <span
                  className="tabular text-[length:var(--text-xs)]"
                  style={{ color: "var(--t1)" }}
                >
                  ${t.price}
                </span>
                <span
                  className="text-[length:var(--text-2xs)]"
                  style={{ color: t.up ? "var(--long)" : "var(--short)" }}
                >
                  {t.chg}
                </span>
              </div>
            ))}
          </div>

          {/* Right controls */}
          <div
            className="absolute right-0 flex items-center gap-[7px] px-2.5 h-full z-[2] border-l"
            style={{
              background: "var(--bg)",
              borderColor: "var(--b1)",
            }}
          >
            <button
              aria-label="Manage watchlist"
              className="text-[13px] p-0.5 leading-none transition-colors duration-150
                         hover:text-[var(--gold)]
                         focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] focus-visible:outline-offset-2"
              style={{ color: "var(--t3)" }}
            >
              &#9733;
            </button>
            <div
              aria-hidden="true"
              className="w-px h-2.5"
              style={{ background: "var(--b1)" }}
            />
            <div
              className="animate-live w-1.5 h-1.5 rounded-full"
              aria-hidden="true"
              style={{ background: "var(--long)" }}
            />
          </div>
        </div>
      )}
    </header>
  );
}
