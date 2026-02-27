'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';

export function Header() {
  return (
    <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold text-white">
              RWA Perp DEX
            </h1>
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
              Arbitrum Sepolia
            </span>
          </div>

          <nav className="flex items-center space-x-6">
            <a href="#markets" className="text-gray-300 hover:text-white transition">
              Markets
            </a>
            <a href="#positions" className="text-gray-300 hover:text-white transition">
              Positions
            </a>
            <a href="#vault" className="text-gray-300 hover:text-white transition">
              Vault
            </a>
            <ConnectButton />
          </nav>
        </div>
      </div>
    </header>
  );
}
