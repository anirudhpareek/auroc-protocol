import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';

dotenvConfig({ path: resolve(process.cwd(), '../.env') });

export const config = {
  // RPC
  rpcUrl: process.env.ARB_SEPOLIA_RPC || 'https://sepolia-rollup.arbitrum.io/rpc',
  chainId: 421614,

  // Keeper wallet
  privateKey: process.env.KEEPER_PRIVATE_KEY || '',

  // Contract addresses (filled after deployment)
  contracts: {
    perpEngine: process.env.PERP_ENGINE_ADDRESS || '',
    liquidationEngine: process.env.LIQUIDATION_ENGINE_ADDRESS || '',
    indexEngine: process.env.INDEX_ENGINE_ADDRESS || '',
    vault: process.env.VAULT_ADDRESS || '',
  },

  // Keeper settings
  keeper: {
    minProfitUsd: parseFloat(process.env.KEEPER_MIN_PROFIT_USD || '1'),
    gasPriceGwei: parseFloat(process.env.KEEPER_GAS_PRICE_GWEI || '0.1'),
    pollIntervalMs: 5000,
    maxRetries: 3,
    retryDelayMs: 1000,
  },

  // Market IDs
  markets: {
    XAU_USD: '0x' + Buffer.from('XAU/USD').toString('hex').padEnd(64, '0'),
    SPX_USD: '0x' + Buffer.from('SPX/USD').toString('hex').padEnd(64, '0'),
  },
} as const;

export type Config = typeof config;
