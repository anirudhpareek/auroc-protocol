import { PublicClient, formatGwei, parseGwei } from 'viem';
import { logger } from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';

export interface GasEstimate {
  gasLimit: bigint;
  gasPrice: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  estimatedCostWei: bigint;
  estimatedCostUsd: number;
}

export class GasEstimator {
  private readonly client: PublicClient;
  private readonly ethPriceUsd: number;

  constructor(client: PublicClient, ethPriceUsd: number = 3000) {
    this.client = client;
    this.ethPriceUsd = ethPriceUsd;
  }

  async estimateGas(
    to: `0x${string}`,
    data: `0x${string}`,
    from?: `0x${string}`
  ): Promise<GasEstimate> {
    return withRetry(
      async () => {
        // Get gas limit estimate
        const gasLimit = await this.client.estimateGas({
          to,
          data,
          account: from,
        });

        // Get current gas prices
        const feeData = await this.client.estimateFeesPerGas();

        const maxFeePerGas = feeData.maxFeePerGas ?? parseGwei('0.1');
        const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? parseGwei('0.01');

        // Calculate estimated cost
        const estimatedCostWei = gasLimit * maxFeePerGas;
        const estimatedCostEth = Number(estimatedCostWei) / 1e18;
        const estimatedCostUsd = estimatedCostEth * this.ethPriceUsd;

        return {
          gasLimit,
          gasPrice: maxFeePerGas,
          maxFeePerGas,
          maxPriorityFeePerGas,
          estimatedCostWei,
          estimatedCostUsd,
        };
      },
      { maxRetries: 2 },
      'gas estimation'
    );
  }

  async getCurrentGasPrice(): Promise<{ gwei: string; wei: bigint }> {
    const gasPrice = await this.client.getGasPrice();
    return {
      gwei: formatGwei(gasPrice),
      wei: gasPrice,
    };
  }

  isProfitableAfterGas(profitUsd: number, gasCostUsd: number, minProfitUsd: number): boolean {
    const netProfit = profitUsd - gasCostUsd;
    const profitable = netProfit >= minProfitUsd;

    logger.debug('Profitability check', {
      profitUsd,
      gasCostUsd,
      netProfit,
      minProfitUsd,
      profitable,
    });

    return profitable;
  }
}
