import { Address } from 'viem';

// Contract addresses (update after deployment)
export const CONTRACTS = {
  perpEngine: process.env.NEXT_PUBLIC_PERP_ENGINE_ADDRESS as Address || '0x0',
  liquidationEngine: process.env.NEXT_PUBLIC_LIQUIDATION_ENGINE_ADDRESS as Address || '0x0',
  indexEngine: process.env.NEXT_PUBLIC_INDEX_ENGINE_ADDRESS as Address || '0x0',
  vault: process.env.NEXT_PUBLIC_VAULT_ADDRESS as Address || '0x0',
  usdc: process.env.NEXT_PUBLIC_USDC_ADDRESS as Address || '0x0',
} as const;

// Market IDs
export const MARKETS = {
  XAU_USD: '0x' + Buffer.from('XAU/USD').toString('hex').padEnd(64, '0') as `0x${string}`,
  SPX_USD: '0x' + Buffer.from('SPX/USD').toString('hex').padEnd(64, '0') as `0x${string}`,
} as const;

// ABIs
export const PerpEngineAbi = [
  {
    name: 'openPosition',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'marketId', type: 'bytes32' },
      { name: 'size', type: 'int256' },
      { name: 'margin', type: 'uint256' },
    ],
    outputs: [{ name: 'positionId', type: 'bytes32' }],
  },
  {
    name: 'closePosition',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'positionId', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'getPosition',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'positionId', type: 'bytes32' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'positionId', type: 'bytes32' },
          { name: 'trader', type: 'address' },
          { name: 'marketId', type: 'bytes32' },
          { name: 'size', type: 'int256' },
          { name: 'entryPrice', type: 'uint256' },
          { name: 'margin', type: 'uint256' },
          { name: 'fundingAccum', type: 'int256' },
          { name: 'openedAt', type: 'uint256' },
          { name: 'lastUpdated', type: 'uint256' },
        ],
      },
    ],
  },
  {
    name: 'getPositionEquity',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'positionId', type: 'bytes32' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'unrealizedPnL', type: 'int256' },
          { name: 'fundingPnL', type: 'int256' },
          { name: 'totalEquity', type: 'int256' },
          { name: 'maintenanceReq', type: 'uint256' },
          { name: 'isLiquidatable', type: 'bool' },
          { name: 'isInsolvent', type: 'bool' },
        ],
      },
    ],
  },
  {
    name: 'getTraderPositions',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'trader', type: 'address' }],
    outputs: [{ type: 'bytes32[]' }],
  },
] as const;

export const IndexEngineAbi = [
  {
    name: 'getIndexPrice',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'marketId', type: 'bytes32' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getMarkPrice',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'marketId', type: 'bytes32' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getRegime',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'marketId', type: 'bytes32' }],
    outputs: [{ type: 'uint8' }],
  },
  {
    name: 'getConfidence',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'marketId', type: 'bytes32' }],
    outputs: [{ type: 'uint256' }],
  },
] as const;

export const VaultAbi = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [{ name: 'shares', type: 'uint256' }],
  },
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'shares', type: 'uint256' }],
    outputs: [{ name: 'amount', type: 'uint256' }],
  },
  {
    name: 'getSharePrice',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getUtilization',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'totalAssets',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const;

export const ERC20Abi = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const;
