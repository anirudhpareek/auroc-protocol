export interface Position {
  positionId: `0x${string}`;
  trader: `0x${string}`;
  marketId: `0x${string}`;
  size: bigint;
  entryPrice: bigint;
  margin: bigint;
  fundingAccum: bigint;
  openedAt: bigint;
  lastUpdated: bigint;
}

export interface PositionEquity {
  unrealizedPnL: bigint;
  fundingPnL: bigint;
  totalEquity: bigint;
  maintenanceReq: bigint;
  isLiquidatable: boolean;
  isInsolvent: boolean;
}

export enum Regime {
  OPEN = 0,
  OFF_HOURS = 1,
  TRANSITION = 2,
  STRESS = 3,
}

export const RegimeLabels: Record<Regime, string> = {
  [Regime.OPEN]: 'Open',
  [Regime.OFF_HOURS]: 'Off-Hours',
  [Regime.TRANSITION]: 'Transition',
  [Regime.STRESS]: 'Stress',
};

export const RegimeColors: Record<Regime, string> = {
  [Regime.OPEN]: 'bg-green-500',
  [Regime.OFF_HOURS]: 'bg-yellow-500',
  [Regime.TRANSITION]: 'bg-orange-500',
  [Regime.STRESS]: 'bg-red-500',
};

export interface MarketInfo {
  id: `0x${string}`;
  symbol: string;
  name: string;
  indexPrice: bigint;
  markPrice: bigint;
  regime: Regime;
  confidence: bigint;
}

// ─── Options types ────────────────────────────────────────────────────────────

export enum OptionType { CALL = 0, PUT = 1 }
export enum OptionSide { LONG = 0, SHORT = 1 }

export interface OptionLeg {
  marketId: `0x${string}`;
  strike: bigint;
  optionType: OptionType;
  side: OptionSide;
  notional: bigint;
}

export interface OptionPosition {
  positionId: `0x${string}`;
  owner: `0x${string}`;
  legCount: bigint;
  legs: OptionLeg[];
  collateralLocked: bigint;
  premiumPaid: bigint;
  openedAt: bigint;
  regimeAtOpen: number;
}

export interface Greeks {
  delta: bigint;
  gamma: bigint;
  theta: bigint;
  vega: bigint;
  iv: bigint;
  premium: bigint;
}

export interface CollateralRequirement {
  buyerPremium: bigint;
  sellerCollateral: bigint;
  total: bigint;
}

export type Instrument = 'perp' | 'options';
