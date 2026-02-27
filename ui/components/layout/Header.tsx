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
    <header className="h-14 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
      <div className="h-full px-4 flex items-center justify-between">
        {/* Logo & Nav */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent-primary)] to-[var(--color-long)] flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <span className="font-semibold text-[var(--text-primary)]">
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
                    "px-3 py-1.5 rounded-[var(--radius-md)]",
                    "text-[var(--text-sm)] font-medium",
                    "transition-colors duration-[var(--transition-fast)]",
                    isActive
                      ? "text-[var(--text-primary)] bg-[var(--bg-hover)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* Network indicator */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-md)] bg-[var(--bg-elevated)]">
            <div className="w-2 h-2 rounded-full bg-[var(--color-warning)]" />
            <span className="text-[var(--text-xs)] text-[var(--text-muted)]">
              Arbitrum Sepolia
            </span>
          </div>

          {/* Wallet */}
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
                            "h-9 px-4",
                            "text-[var(--text-sm)] font-medium text-white",
                            "bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)]",
                            "rounded-[var(--radius-md)]",
                            "transition-colors duration-[var(--transition-fast)]"
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
                            "h-9 px-4",
                            "text-[var(--text-sm)] font-medium text-white",
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
                          "h-9 px-4",
                          "flex items-center gap-2",
                          "text-[var(--text-sm)] font-medium",
                          "bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)]",
                          "border border-[var(--border-default)]",
                          "rounded-[var(--radius-md)]",
                          "transition-colors duration-[var(--transition-fast)]"
                        )}
                      >
                        <span className="text-[var(--text-primary)]">
                          {account.displayName}
                        </span>
                        {account.displayBalance && (
                          <span className="text-[var(--text-muted)]">
                            {account.displayBalance}
                          </span>
                        )}
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
