"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { cn } from "@/lib/cn";

const navItems = [
  { label: "Trade",     href: "/" },
  { label: "Portfolio", href: "/portfolio" },
  { label: "Vault",     href: "/vault" },
];

/* Scrolling market ticker data */
const tickerItems = [
  { symbol: "BTC/USD",  price: "97,432.50", change: "+2.34%", up: true  },
  { symbol: "XAU/USD",  price: "2,892.40",  change: "+0.45%", up: true  },
  { symbol: "SPX/USD",  price: "5,234.18",  change: "-0.12%", up: false },
  { symbol: "ETH/USD",  price: "3,421.05",  change: "+1.82%", up: true  },
  { symbol: "SOL/USD",  price: "187.34",    change: "+3.21%", up: true  },
  { symbol: "WTI/USD",  price: "72.48",     change: "-0.63%", up: false },
];

function TickerItem({ item }: { item: (typeof tickerItems)[0] }) {
  return (
    <div className="flex items-center gap-1.5 px-5 whitespace-nowrap">
      <span className="text-[var(--text-secondary)] text-xs">{item.symbol}</span>
      <span className="text-xs tabular text-[var(--text-primary)]">{item.price}</span>
      <span
        className={cn(
          "text-xs tabular font-medium",
          item.up ? "text-[var(--long)]" : "text-[var(--short)]"
        )}
      >
        {item.change}
      </span>
      {/* dot separator */}
      <span className="text-[var(--text-muted)] text-xs ml-3">·</span>
    </div>
  );
}

export function Header() {
  const pathname = usePathname();

  return (
    <header className="flex flex-col" style={{ borderBottom: "1px solid var(--border-default)" }}>
      {/* ── Top Bar ── */}
      <div
        className="h-11 flex items-center justify-between px-4"
        style={{ background: "var(--bg-surface)" }}
      >
        {/* Left: Logo + Nav */}
        <div className="flex items-center gap-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center relative"
              style={{
                background: "linear-gradient(135deg, var(--accent) 0%, #fbbf24 100%)",
                boxShadow: "0 0 12px var(--accent-glow)",
              }}
            >
              {/* Diamond / protocol mark */}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M7 1L12 5.5L7 13L2 5.5L7 1Z"
                  fill="rgba(0,0,0,0.85)"
                  stroke="rgba(0,0,0,0.3)"
                  strokeWidth="0.5"
                />
                <path d="M7 1L12 5.5H2L7 1Z" fill="rgba(255,255,255,0.25)" />
              </svg>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-semibold text-sm text-[var(--text-primary)] tracking-tight">
                AUROC
              </span>
              <span
                className="text-[10px] font-medium px-1 py-px rounded"
                style={{
                  background: "var(--accent-dim)",
                  color: "var(--accent)",
                  letterSpacing: "0.05em",
                }}
              >
                PERPS
              </span>
            </div>
          </Link>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-0.5">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150",
                    isActive
                      ? "text-[var(--text-primary)] bg-[var(--bg-overlay)]"
                      : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
                  )}
                  style={
                    isActive
                      ? { boxShadow: "inset 0 1px 0 var(--border-subtle)" }
                      : {}
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: Status + Wallet */}
        <div className="flex items-center gap-2.5">
          {/* Gas price */}
          <div
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 9V2.5L4 1M4 1H8L8 6M4 1V4.5H8M8 6H6.5M8 6V9" stroke="var(--text-tertiary)" strokeWidth="1" strokeLinecap="round"/>
            </svg>
            <span className="text-[10px] text-[var(--text-tertiary)] tabular">0.001</span>
            <span className="text-[10px] text-[var(--text-muted)]">Gwei</span>
          </div>

          {/* Network badge */}
          <div
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-live flex-shrink-0"
              style={{ background: "var(--long)" }}
            />
            <span className="text-[10px] font-medium" style={{ color: "var(--text-secondary)" }}>
              Arb Sepolia
            </span>
          </div>

          {/* Wallet */}
          <ConnectButton.Custom>
            {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
              const ready = mounted;
              const connected = ready && account && chain;

              return (
                <div
                  {...(!ready && {
                    "aria-hidden": true,
                    style: { opacity: 0, pointerEvents: "none" },
                  })}
                >
                  {!connected ? (
                    <button
                      onClick={openConnectModal}
                      className="h-7 px-3.5 text-xs font-semibold rounded-md transition-all duration-150 active:scale-95"
                      style={{
                        background: "linear-gradient(135deg, var(--accent) 0%, #fbbf24 100%)",
                        color: "#000",
                        boxShadow: "0 0 12px var(--accent-glow)",
                      }}
                    >
                      Connect Wallet
                    </button>
                  ) : chain.unsupported ? (
                    <button
                      onClick={openChainModal}
                      className="h-7 px-3.5 text-xs font-semibold rounded-md transition-all"
                      style={{ background: "var(--short-mid)", color: "var(--short)", border: "1px solid var(--short-mid)" }}
                    >
                      Wrong Network
                    </button>
                  ) : (
                    <button
                      onClick={openAccountModal}
                      className="h-7 px-2.5 flex items-center gap-1.5 rounded-md transition-all duration-150 hover:brightness-110"
                      style={{
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border-strong)",
                      }}
                    >
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{
                          background: "linear-gradient(135deg, var(--accent), var(--long))",
                          boxShadow: "0 0 6px var(--accent-glow)",
                        }}
                      />
                      <span className="text-xs text-[var(--text-primary)] tabular">
                        {account.displayName}
                      </span>
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="ml-0.5">
                        <path d="M1 3L4 6L7 3" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </button>
                  )}
                </div>
              );
            }}
          </ConnectButton.Custom>
        </div>
      </div>

      {/* ── Market Ticker Strip ── */}
      <div
        className="h-7 flex items-center overflow-hidden relative"
        style={{
          background: "var(--bg-base)",
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        {/* Left fade */}
        <div
          className="absolute left-0 top-0 bottom-0 w-8 z-10 pointer-events-none"
          style={{ background: "linear-gradient(to right, var(--bg-base), transparent)" }}
        />
        {/* Right fade */}
        <div
          className="absolute right-0 top-0 bottom-0 w-8 z-10 pointer-events-none"
          style={{ background: "linear-gradient(to left, var(--bg-base), transparent)" }}
        />

        {/* Scrolling items — duplicated for seamless loop */}
        <div className="flex animate-ticker" style={{ width: "max-content" }}>
          {[...tickerItems, ...tickerItems].map((item, i) => (
            <TickerItem key={i} item={item} />
          ))}
        </div>
      </div>
    </header>
  );
}
