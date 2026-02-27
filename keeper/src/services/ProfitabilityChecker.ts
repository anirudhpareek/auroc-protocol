import { PublicClient, encodeFunctionData } from 'viem';
import { GasEstimator, GasEstimate } from './GasEstimator.js';
import { LiquidationEngineAbi } from '../abi/index.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';

export interface ProfitabilityResult {
  isProfitable: boolean;
  grossProfitWad: bigint;
  grossProfitUsd: number;
  fillPrice: bigint;
  gasEstimate: GasEstimate | null;
  netProfitUsd: number;
}

export class ProfitabilityChecker {
  private readonly client: PublicClient;
  private readonly gasEstimator: GasEstimator;
  private readonly minProfitUsd: number;

  constructor(client: PublicClient, minProfitUsd: number = 1) {
    this.client = client;
    this.gasEstimator = new GasEstimator(client);
    this.minProfitUsd = minProfitUsd;
  }

  async checkAuctionProfitability(
    auctionId: `0x${string}`,
    fillSize: bigint,
    liquidationEngineAddress: `0x${string}`,
    keeperAddress?: `0x${string}`
  ): Promise<ProfitabilityResult> {
    try {
      // Get profit calculation from contract
      const result = await this.client.readContract({
        address: liquidationEngineAddress,
        abi: LiquidationEngineAbi,
        functionName: 'calculateKeeperProfit',
        args: [auctionId, fillSize],
      }) as [bigint, bigint];

      const grossProfitWad = result[0];
      const fillPrice = result[1];

      // Convert WAD to USD (assuming 18 decimals)
      const grossProfitUsd = Number(grossProfitWad) / 1e18;

      // Estimate gas if we have a keeper address
      let gasEstimate: GasEstimate | null = null;
      let netProfitUsd = grossProfitUsd;

      if (keeperAddress) {
        try {
          const calldata = encodeFunctionData({
            abi: LiquidationEngineAbi,
            functionName: 'fillAuction',
            args: [auctionId, fillSize],
          });

          gasEstimate = await this.gasEstimator.estimateGas(
            liquidationEngineAddress,
            calldata,
            keeperAddress
          );

          netProfitUsd = grossProfitUsd - gasEstimate.estimatedCostUsd;
        } catch (error) {
          logger.warn('Failed to estimate gas, using gross profit', { error });
        }
      }

      const isProfitable = netProfitUsd >= this.minProfitUsd;

      return {
        isProfitable,
        grossProfitWad,
        grossProfitUsd,
        fillPrice,
        gasEstimate,
        netProfitUsd,
      };
    } catch (error) {
      logger.error('Failed to check profitability', { error, auctionId });
      return {
        isProfitable: false,
        grossProfitWad: 0n,
        grossProfitUsd: 0,
        fillPrice: 0n,
        gasEstimate: null,
        netProfitUsd: 0,
      };
    }
  }

  async findOptimalFillSize(
    auctionId: `0x${string}`,
    maxSize: bigint,
    liquidationEngineAddress: `0x${string}`,
    keeperAddress?: `0x${string}`
  ): Promise<{ optimalSize: bigint; profitability: ProfitabilityResult }> {
    // For now, just try the full size
    // Could implement binary search for optimal chunk size
    const profitability = await this.checkAuctionProfitability(
      auctionId,
      maxSize,
      liquidationEngineAddress,
      keeperAddress
    );

    return {
      optimalSize: profitability.isProfitable ? maxSize : 0n,
      profitability,
    };
  }
}
