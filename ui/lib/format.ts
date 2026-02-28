/**
 * Auroc Protocol — Number formatting utilities
 * Prices: 8 decimal precision (e.g., 289240000000 → $2,892.40)
 * USDC amounts: 6 decimal precision
 */

/** Format a bigint price (8 decimals) as "$X,XXX.XX" */
export function formatPrice(raw: bigint, decimals = 8): string {
  if (!raw) return "—";
  const scale = BigInt(10 ** decimals);
  const whole = raw / scale;
  const frac  = raw % scale;
  // Take 2 decimal digits
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, 2);
  return `${Number(whole).toLocaleString("en-US")}.${fracStr}`;
}

/** Format a bigint USDC amount (6 decimals) as "$X,XXX.XX" */
export function formatUsdc(raw: bigint): string {
  return formatPrice(raw, 6);
}

/** Format signed PnL bigint (6 decimals) as "+$X.XX" or "-$X.XX" */
export function formatPnl(raw: bigint): { str: string; isPositive: boolean } {
  const isPositive = raw >= 0n;
  const abs = raw < 0n ? -raw : raw;
  const str = `${isPositive ? "+" : "-"}$${formatPrice(abs, 6)}`;
  return { str, isPositive };
}

/** Short-form millions/billions display */
export function formatCompact(raw: bigint, decimals = 6): string {
  const n = Number(raw) / 10 ** decimals;
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)         return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

/** Format leverage as integer multiplier */
export function formatLeverage(size: bigint, margin: bigint): string {
  if (!margin || margin === 0n) return "—";
  const abs = size < 0n ? -size : size;
  const lev = Number(abs) / Number(margin);
  return `${lev.toFixed(1)}×`;
}

/** Format address as "0x1234…abcd" */
export function formatAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** Funding rate: basis points (1e6 scale) → "0.0125%" */
export function formatFundingRate(raw: bigint): string {
  const n = Number(raw) / 1e6;
  const sign = n >= 0 ? "+" : "";
  return `${sign}${(n * 100).toFixed(4)}%`;
}

/** Confidence score (1e18) → "98.5%" */
export function formatConfidence(raw: bigint): string {
  const n = Number(raw) / 1e18;
  return `${(n * 100).toFixed(1)}%`;
}
