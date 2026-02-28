"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { cn } from "@/lib/cn";

const navItems = [
  { label: "Perps", href: "/", active: true },
  { label: "Portfolio", href: "/portfolio" },
  { label: "Vault", href: "/vault" },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="h-14 border-b border-[var(--border-subtle)] bg-[var(--bg-void)] sticky top-0 z-[var(--z-sticky)]">
      <div className="h-full px-4 flex items-center justify-between">
        {/* Left: Logo & Nav */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-primary)] flex items-center justify-center">
              <span className="text-black font-bold text-lg">A</span>
            </div>
            <span className="font-semibold text-[var(--text-lg)] text-white tracking-tight hidden sm:block">
              Auroc
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-4 py-2 rounded-lg",
                    "text-[var(--text-sm)] font-medium",
                    "transition-all duration-[var(--transition-fast)]",
                    isActive
                      ? "text-[var(--accent-primary)] bg-[var(--accent-primary-subtle)]"
                      : "text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)]"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: Network & Wallet */}
        <div className="flex items-center gap-3">
          {/* Network Badge */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-default)]">
            <div className="live-dot" />
            <span className="text-[var(--text-xs)] text-[var(--text-secondary)] font-medium">
              Arbitrum Sepolia
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
                            "h-9 px-5",
                            "text-[var(--text-sm)] font-semibold",
                            "bg-[var(--accent-primary)] text-black",
                            "rounded-lg",
                            "transition-all duration-[var(--transition-fast)]",
                            "hover:brightness-110",
                            "active:scale-[0.98]"
                          )}
                        >
                          Connect Wallet
                        </button>
                      );
                    }

                    if (chain.unsupported) {
                      return (
                        <button
                          onClick={openChainModal}
                          className={cn(
                            "h-9 px-5",
                            "text-[var(--text-sm)] font-semibold text-white",
                            "bg-[var(--color-short)]",
                            "rounded-lg"
                          )}
                        >
                          Wrong Network
                        </button>
                      );
                    }

                    return (
                      <div className="flex items-center gap-2">
                        {/* Balance */}
                        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-default)]">
                          <span className="text-[var(--text-sm)] text-[var(--text-muted)]">Balance</span>
                          <span className="text-[var(--text-sm)] text-white font-medium tabular-nums">
                            $0.00
                          </span>
                        </div>

                        {/* Account */}
                        <button
                          onClick={openAccountModal}
                          className={cn(
                            "h-9 px-4",
                            "flex items-center gap-2",
                            "bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)]",
                            "border border-[var(--border-default)]",
                            "rounded-lg",
                            "transition-colors duration-[var(--transition-fast)]"
                          )}
                        >
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[var(--accent-primary)] to-[var(--color-long)]" />
                          <span className="text-[var(--text-sm)] font-medium text-white tabular-nums">
                            {account.displayName}
                          </span>
                        </button>
                      </div>
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
