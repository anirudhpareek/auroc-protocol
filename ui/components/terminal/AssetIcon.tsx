"use client";

import { TokenIcon } from "@web3icons/react/dynamic";

// Symbols that have icons in @web3icons/react
const CRYPTO_SYMBOLS = new Set([
  "BTC", "ETH", "SOL", "ARB", "USDC", "LINK", "OP", "AVAX", "BNB",
  "UNI", "AAVE", "GMX", "PENDLE", "WIF", "BONK", "JUP",
]);

interface AssetIconProps {
  symbol: string;
  color: string;
  size?: number;
}

export function AssetIcon({ symbol, color, size = 20 }: AssetIconProps) {
  if (CRYPTO_SYMBOLS.has(symbol)) {
    return (
      <div style={{ width: size, height: size, flexShrink: 0, borderRadius: "50%", overflow: "hidden" }}>
        <TokenIcon symbol={symbol} size={size} variant="branded" />
      </div>
    );
  }

  // Fallback for XAU, SPX, WTI, EUR, etc.
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: color,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: Math.max(7, size * 0.38), fontWeight: 800, color: "#fff", flexShrink: 0,
    }} aria-hidden="true">
      {symbol[0]}
    </div>
  );
}
