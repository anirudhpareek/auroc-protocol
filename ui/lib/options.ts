/**
 * Auroc Options — client-side utilities
 * - Greeks computation (Black-Scholes approximation)
 * - Formatting helpers
 * - ABI-level leg encoding/decoding
 */

import { OptionLeg, OptionType, OptionSide, Greeks } from '@/types';

// ─── Constants ───────────────────────────────────────────────────────────────

const WAD = BigInt('1000000000000000000'); // 1e18
const SQRT_T = 286478897565412000n;        // sqrt(30/365) in WAD
const INV_SQRT_2PI = 398942280401433000n;  // 1/sqrt(2π) in WAD

// ─── Math helpers (bigint) ───────────────────────────────────────────────────

function mulWad(a: bigint, b: bigint): bigint {
  return (a * b + WAD / 2n) / WAD;
}

/** Standard normal CDF approximation N(x) via Hart's rational approximation */
function normCDF(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const t = 1 / (1 + 0.33267 * Math.abs(x));
  const poly = t * (0.4361836 + t * (-0.1201676 + t * 0.9372980));
  const phi = Math.exp(-(x * x) / 2) / Math.sqrt(2 * Math.PI);
  return 0.5 + sign * (0.5 - phi * poly);
}

/** ln(x) for positive bigint in WAD; returns bigint WAD result */
function lnWad(x: bigint): bigint {
  // Use JS float then convert back
  const xFloat = Number(x) / 1e18;
  if (xFloat <= 0) return 0n;
  return BigInt(Math.round(Math.log(xFloat) * 1e18));
}

function sqrtWad(x: bigint): bigint {
  // sqrt(x_wad) = sqrt(x_real) in WAD
  const xFloat = Number(x) / 1e18;
  if (xFloat <= 0) return 0n;
  return BigInt(Math.round(Math.sqrt(xFloat) * 1e18));
}

// ─── Premium & Greeks computation ───────────────────────────────────────────

export interface PremiumInputs {
  spot: bigint;    // WAD
  strike: bigint;  // WAD
  iv: bigint;      // WAD annualized (e.g. 0.20e18 = 20%)
  isCall: boolean;
  /** Time horizon in years (default: 30/365 ≈ 0.0822) */
  timeHorizon?: number;
}

export function computeGreeks(params: PremiumInputs): Greeks {
  const { spot, strike, iv, isCall, timeHorizon = 30 / 365 } = params;

  const S = Number(spot)   / 1e18;
  const K = Number(strike) / 1e18;
  const σ = Number(iv)     / 1e18;
  const T = timeHorizon;

  if (S <= 0 || K <= 0 || σ <= 0 || T <= 0) {
    return { delta: 0n, gamma: 0n, theta: 0n, vega: 0n, iv, premium: 0n };
  }

  const sqrtT = Math.sqrt(T);
  const sigSqrtT = σ * sqrtT;

  const d1 = (Math.log(S / K) + 0.5 * σ * σ * T) / sigSqrtT;
  const d2 = d1 - sigSqrtT;

  const Nd1 = normCDF(d1);
  const Nd2 = normCDF(d2);
  const phi_d1 = Math.exp(-(d1 * d1) / 2) / Math.sqrt(2 * Math.PI);

  // Option premium (as fraction of spot)
  let premiumFloat: number;
  if (isCall) {
    premiumFloat = S * Nd1 - K * Nd2;
  } else {
    premiumFloat = K * (1 - Nd2) - S * (1 - Nd1);
  }
  premiumFloat = Math.max(0, premiumFloat);

  // Greeks
  const deltaFloat = isCall ? Nd1 : Nd1 - 1;
  const gammaFloat = phi_d1 / (S * sigSqrtT);
  const thetaFloat = -(S * phi_d1 * σ) / (2 * sqrtT) / 365; // per day
  const vegaFloat  = S * sqrtT * phi_d1;

  const toWad = (n: number): bigint => BigInt(Math.round(n * 1e18));

  return {
    delta:   toWad(deltaFloat),
    gamma:   toWad(gammaFloat),
    theta:   toWad(thetaFloat),
    vega:    toWad(vegaFloat),
    iv,
    premium: toWad(premiumFloat / S), // as % of spot (WAD)
  };
}

// ─── Formatting ──────────────────────────────────────────────────────────────

export function formatGreek(value: bigint, label: string): string {
  const n = Number(value) / 1e18;
  const sign = n >= 0 ? '' : '';
  return `${label} ${n >= 0 ? '' : ''}${n.toFixed(4)}`;
}

export function formatIV(iv: bigint): string {
  const pct = Number(iv) / 1e16; // 1e18 → 100%
  return `${pct.toFixed(1)}%`;
}

export function formatPremiumPct(premium: bigint): string {
  const pct = Number(premium) / 1e16;
  return `${pct.toFixed(3)}%`;
}

export function formatStrike(strike: bigint): string {
  const n = Number(strike) / 1e18;
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatNotional(notional: bigint, spot: bigint): string {
  // notional in WAD (units), spot in WAD → USD value
  const usd = (Number(notional) * Number(spot)) / 1e36;
  return usd.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

// ─── Leg encoding (Panoptic-inspired tokenId packing) ───────────────────────
//
// Each leg occupies 64 bits in a packed uint256 tokenId:
//   bits [0..47]  — strike price (scaled: strike_wad >> 64, 48-bit precision)
//   bit  [48]     — optionType (0 = CALL, 1 = PUT)
//   bit  [49]     — side (0 = LONG, 1 = SHORT)
//   bits [50..63] — reserved

export function encodeOptionTokenId(legs: OptionLeg[]): bigint {
  if (legs.length === 0 || legs.length > 4) throw new Error('Invalid leg count');
  let tokenId = 0n;
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    const strikeScaled = leg.strike >> 64n; // top 48 bits of WAD strike
    const typeFlag     = BigInt(leg.optionType); // 0 or 1
    const sideFlag     = BigInt(leg.side);        // 0 or 1
    const legBits = (strikeScaled & 0xFFFFFFFFFFFFn) |
                    (typeFlag << 48n) |
                    (sideFlag << 49n);
    tokenId |= legBits << BigInt(i * 64);
  }
  return tokenId;
}

export function decodeOptionTokenId(tokenId: bigint, legCount: number): OptionLeg[] {
  const legs: OptionLeg[] = [];
  const MASK_48 = (1n << 48n) - 1n;
  for (let i = 0; i < legCount; i++) {
    const bits        = (tokenId >> BigInt(i * 64)) & ((1n << 64n) - 1n);
    const strikeScaled = bits & MASK_48;
    const typeFlag    = (bits >> 48n) & 1n;
    const sideFlag    = (bits >> 49n) & 1n;
    legs.push({
      marketId:   '0x' as `0x${string}`, // Not encoded in tokenId (too large)
      strike:     strikeScaled << 64n,
      optionType: Number(typeFlag) as OptionType,
      side:       Number(sideFlag) as OptionSide,
      notional:   WAD, // Default — not encoded in tokenId
    });
  }
  return legs;
}

// ─── Preset strategies ───────────────────────────────────────────────────────

export function makeStraddle(marketId: `0x${string}`, strike: bigint, notional: bigint): OptionLeg[] {
  return [
    { marketId, strike, optionType: OptionType.CALL, side: OptionSide.LONG, notional },
    { marketId, strike, optionType: OptionType.PUT,  side: OptionSide.LONG, notional },
  ];
}

export function makeStrangle(
  marketId: `0x${string}`,
  callStrike: bigint,
  putStrike: bigint,
  notional: bigint
): OptionLeg[] {
  return [
    { marketId, strike: callStrike, optionType: OptionType.CALL, side: OptionSide.LONG, notional },
    { marketId, strike: putStrike,  optionType: OptionType.PUT,  side: OptionSide.LONG, notional },
  ];
}

export function makeBullCallSpread(
  marketId: `0x${string}`,
  lowerStrike: bigint,
  upperStrike: bigint,
  notional: bigint
): OptionLeg[] {
  return [
    { marketId, strike: lowerStrike, optionType: OptionType.CALL, side: OptionSide.LONG,  notional },
    { marketId, strike: upperStrike, optionType: OptionType.CALL, side: OptionSide.SHORT, notional },
  ];
}

export function makeBearPutSpread(
  marketId: `0x${string}`,
  upperStrike: bigint,
  lowerStrike: bigint,
  notional: bigint
): OptionLeg[] {
  return [
    { marketId, strike: upperStrike, optionType: OptionType.PUT, side: OptionSide.LONG,  notional },
    { marketId, strike: lowerStrike, optionType: OptionType.PUT, side: OptionSide.SHORT, notional },
  ];
}
