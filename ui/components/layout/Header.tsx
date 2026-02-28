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
    <header className="h-12 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] sticky top-0 z-[var(--z-sticky)]">
      <div className="h-full px-4 flex items-center justify-between">
        {/* Logo & Nav */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-[var(--accent-primary)] flex items-center justify-center">
              <span className="text-[var(--bg-void)] font-bold text-sm tracking-tight">A</span>
            </div>
            <span className="font-semibold text-[var(--text-sm)] text-[var(--text-primary)] tracking-tight">
              Auroc
            </span>
          </Link>

          <nav className="hidden md:flex items-center">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-3 py-1.5 rounded-[var(--radius-sm)]",
                    "text-[var(--text-sm)] font-medium",
                    "transition-colors duration-[var(--transition-fast)]",
                    isActive
                      ? "text-[var(--text-primary)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-2">
          {/* Network Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-[var(--radius-sm)] bg-[var(--color-warning-subtle)] border border-[var(--color-warning-glow)]">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-warning)] animate-pulse-dot" />
            <span className="text-[var(--text-2xs)] text-[var(--color-warning)] font-medium">
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
                            "h-8 px-4",
                            "text-[var(--text-xs)] font-semibold",
                            "bg-[var(--accent-primary)] text-[var(--bg-void)]",
                            "rounded-[var(--radius-md)]",
                            "transition-all duration-[var(--transition-fast)]",
                            "hover:brightness-110",
                            "active:scale-[0.98]"
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
                            "h-8 px-4",
                            "text-[var(--text-xs)] font-semibold text-white",
                            "bg-[var(--color-short)]",
                            "rounded-[var(--radius-md)]"
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
                          "h-8 px-3",
                          "flex items-center gap-2",
                          "bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)]",
                          "border border-[var(--border-default)]",
                          "rounded-[var(--radius-md)]",
                          "transition-colors duration-[var(--transition-fast)]"
                        )}
                      >
                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[var(--accent-primary)] to-[var(--color-long)]" />
                        <span className="text-[var(--text-xs)] font-medium text-[var(--text-primary)] tabular-nums">
                          {account.displayName}
                        </span>
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
