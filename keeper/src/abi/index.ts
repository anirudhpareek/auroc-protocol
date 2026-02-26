export const LiquidationEngineAbi = [
  {
    name: 'getAllActiveAuctions',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bytes32[]' }],
  },
  {
    name: 'getAuction',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'auctionId', type: 'bytes32' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'auctionId', type: 'bytes32' },
          { name: 'positionId', type: 'bytes32' },
          { name: 'trader', type: 'address' },
          { name: 'marketId', type: 'bytes32' },
          { name: 'originalSize', type: 'int256' },
          { name: 'remainingSize', type: 'int256' },
          { name: 'startPrice', type: 'uint256' },
          { name: 'endPrice', type: 'uint256' },
          { name: 'startTime', type: 'uint256' },
          { name: 'duration', type: 'uint256' },
          { name: 'isActive', type: 'bool' },
        ],
      },
    ],
  },
  {
    name: 'calculateKeeperProfit',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'auctionId', type: 'bytes32' },
      { name: 'fillSize', type: 'int256' },
    ],
    outputs: [
      { name: 'profit', type: 'uint256' },
      { name: 'fillPrice', type: 'uint256' },
    ],
  },
  {
    name: 'fillAuction',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'auctionId', type: 'bytes32' },
      { name: 'fillSize', type: 'int256' },
    ],
    outputs: [],
  },
  {
    name: 'LiquidationStarted',
    type: 'event',
    inputs: [
      { name: 'auctionId', type: 'bytes32', indexed: true },
      { name: 'positionId', type: 'bytes32', indexed: true },
      { name: 'trader', type: 'address', indexed: true },
      { name: 'size', type: 'int256', indexed: false },
      { name: 'startPrice', type: 'uint256', indexed: false },
      { name: 'endPrice', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'AuctionFilled',
    type: 'event',
    inputs: [
      { name: 'auctionId', type: 'bytes32', indexed: true },
      { name: 'filler', type: 'address', indexed: true },
      { name: 'fillSize', type: 'int256', indexed: false },
      { name: 'fillPrice', type: 'uint256', indexed: false },
      { name: 'profit', type: 'uint256', indexed: false },
    ],
  },
] as const;

export const PerpEngineAbi = [
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
    name: 'getTotalAssets',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const;
