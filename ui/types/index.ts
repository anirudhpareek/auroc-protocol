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
