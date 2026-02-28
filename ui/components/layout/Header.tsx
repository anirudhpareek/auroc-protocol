"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { cn } from "@/lib/cn";

const navItems = [
  { label: "Perps", href: "/" },
  { label: "Portfolio", href: "/portfolio" },
  { label: "Vault", href: "/vault" },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="h-14 bg-[var(--black)] border-b border-[var(--gray-900)] flex items-center justify-between px-4">
      {/* Left */}
      <div className="flex items-center gap-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--yellow)] flex items-center justify-center">
            <span className="text-black font-bold text-lg">A</span>
          </div>
          <span className="font-semibold text-lg text-white hidden sm:block">
            Auroc
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                pathname === item.href
                  ? "bg-[var(--gray-900)] text-white"
                  : "text-[var(--gray-500)] hover:text-white"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--gray-900)]">
          <div className="w-2 h-2 rounded-full bg-[var(--green)] animate-pulse" />
          <span className="text-xs text-[var(--gray-400)]">Testnet</span>
        </div>

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
                  style: { opacity: 0, pointerEvents: "none" },
                })}
              >
                {!connected ? (
                  <button
                    onClick={openConnectModal}
                    className="h-9 px-4 bg-[var(--yellow)] text-black text-sm font-semibold rounded-lg hover:brightness-110 transition-all"
                  >
                    Connect
                  </button>
                ) : chain.unsupported ? (
                  <button
                    onClick={openChainModal}
                    className="h-9 px-4 bg-[var(--red)] text-white text-sm font-semibold rounded-lg"
                  >
                    Wrong Network
                  </button>
                ) : (
                  <button
                    onClick={openAccountModal}
                    className="h-9 px-3 flex items-center gap-2 bg-[var(--gray-900)] rounded-lg hover:bg-[var(--gray-800)] transition-colors"
                  >
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[var(--yellow)] to-[var(--green)]" />
                    <span className="text-sm text-white tabular">
                      {account.displayName}
                    </span>
                  </button>
                )}
              </div>
            );
          }}
        </ConnectButton.Custom>
      </div>
    </header>
  );
}
