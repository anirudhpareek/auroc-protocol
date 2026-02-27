"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { cn } from "@/lib/cn";

const navItems = [
  { label: "Trade", href: "/" },
  { label: "Portfolio", href: "/portfolio" },
  { label: "Vault", href: "/vault" },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="h-14 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/80 backdrop-blur-xl sticky top-0 z-[var(--z-sticky)]">
      <div className="h-full px-4 flex items-center justify-between">
        {/* Logo & Nav */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-3 group">
            {/* Logo Mark */}
            <div className="relative">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[var(--accent-primary)] to-[var(--color-long)] flex items-center justify-center transform group-hover:scale-105 transition-transform">
                <span className="text-[var(--bg-void)] font-bold text-lg tracking-tight">A</span>
              </div>
              {/* Glow effect */}
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-[var(--accent-primary)] to-[var(--color-long)] opacity-0 group-hover:opacity-40 blur-lg transition-opacity" />
            </div>
            {/* Logo Text */}
            <div className="flex flex-col">
              <span className="font-semibold text-[var(--text-primary)] tracking-tight leading-none">
                Auroc
              </span>
              <span className="text-[var(--text-2xs)] text-[var(--accent-primary)] uppercase tracking-widest">
                Protocol
              </span>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative px-4 py-2 rounded-lg",
                    "text-[var(--text-sm)] font-medium",
                    "transition-all duration-200",
                    isActive
                      ? "text-[var(--text-primary)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  )}
                >
                  {item.label}
                  {/* Active indicator */}
                  {isActive && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[var(--accent-primary)] rounded-full" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-3">
          {/* Live Indicator */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
            <span className="live-indicator text-[var(--text-xs)] text-[var(--text-muted)]">
              Live
            </span>
          </div>

          {/* Network Badge */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-warning-subtle)] border border-[var(--color-warning-glow)]">
            <div className="w-2 h-2 rounded-full bg-[var(--color-warning)] animate-pulse-glow" />
            <span className="text-[var(--text-xs)] text-[var(--color-warning)] font-medium">
              Testnet
            </span>
          </div>

          {/* Wallet Connect */}
          <ConnectButton.Custom>
            {({
              account,
              chain,
              openAccountModal,
              openChainModal,
              openConnectModal,
              mounted,
            }) => {
              const ready = mounted;
              const connected = ready && account && chain;

              return (
                <div
                  {...(!ready && {
                    "aria-hidden": true,
                    style: {
                      opacity: 0,
                      pointerEvents: "none",
                      userSelect: "none",
                    },
                  })}
                >
                  {(() => {
                    if (!connected) {
                      return (
                        <button
                          onClick={openConnectModal}
                          className={cn(
                            "h-10 px-5",
                            "text-[var(--text-sm)] font-semibold",
                            "bg-[var(--accent-primary)] text-[var(--bg-void)]",
                            "rounded-lg",
                            "transition-all duration-200",
                            "hover:shadow-[var(--glow-accent)]",
                            "active:scale-95"
                          )}
                        >
                          Connect
                        </button>
                      );
                    }

                    if (chain.unsupported) {
                      return (
                        <button
                          onClick={openChainModal}
                          className={cn(
                            "h-10 px-5",
                            "text-[var(--text-sm)] font-semibold text-white",
                            "bg-[var(--color-short)]",
                            "rounded-lg",
                            "hover:shadow-[var(--glow-short)]"
                          )}
                        >
                          Wrong Network
                        </button>
                      );
                    }

                    return (
                      <button
                        onClick={openAccountModal}
                        className={cn(
                          "h-10 px-4",
                          "flex items-center gap-3",
                          "bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)]",
                          "border border-[var(--border-default)] hover:border-[var(--accent-primary)]",
                          "rounded-lg",
                          "transition-all duration-200",
                          "group"
                        )}
                      >
                        {/* Avatar placeholder */}
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[var(--accent-primary)] to-[var(--color-long)]" />
                        <div className="flex flex-col items-start">
                          <span className="text-[var(--text-sm)] font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors">
                            {account.displayName}
                          </span>
                          {account.displayBalance && (
                            <span className="text-[var(--text-2xs)] text-[var(--text-muted)] tabular-nums">
                              {account.displayBalance}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })()}
                </div>
              );
            }}
          </ConnectButton.Custom>
        </div>
      </div>
    </header>
  );
}
