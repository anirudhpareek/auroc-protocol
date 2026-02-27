import { PublicClient, WalletClient, Chain, Transport, Account } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { LiquidationEngineAbi } from '../abi/index.js';
import { ProfitabilityChecker, ProfitabilityResult } from './ProfitabilityChecker.js';
import { logger } from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';

export interface FillResult {
  success: boolean;
  txHash?: `0x${string}`;
  error?: string;
  profitability?: ProfitabilityResult;
}

export interface Auction {
  auctionId: `0x${string}`;
  positionId: `0x${string}`;
  trader: `0x${string}`;
  marketId: `0x${string}`;
  originalSize: bigint;
  remainingSize: bigint;
  startPrice: bigint;
  endPrice: bigint;
  startTime: bigint;
  duration: bigint;
  isActive: boolean;
}

export class AuctionFiller {
  private readonly publicClient: PublicClient;
  private readonly walletClient: WalletClient<Transport, Chain, Account>;
  private readonly accountAddress: `0x${string}`;
  private readonly liquidationEngineAddress: `0x${string}`;
  private readonly profitabilityChecker: ProfitabilityChecker;
  private readonly minProfitUsd: number;

  // Track pending fills to avoid double-filling
  private pendingFills: Set<string> = new Set();

  constructor(
    publicClient: PublicClient,
    walletClient: WalletClient<Transport, Chain, Account>,
    accountAddress: `0x${string}`,
    liquidationEngineAddress: `0x${string}`,
    minProfitUsd: number = 1
  ) {
    this.publicClient = publicClient;
    this.walletClient = walletClient;
    this.accountAddress = accountAddress;
    this.liquidationEngineAddress = liquidationEngineAddress;
    this.profitabilityChecker = new ProfitabilityChecker(publicClient, minProfitUsd);
    this.minProfitUsd = minProfitUsd;
  }

  async fillAuction(auction: Auction): Promise<FillResult> {
    const auctionIdStr = auction.auctionId;

    // Skip if already pending
    if (this.pendingFills.has(auctionIdStr)) {
      logger.debug('Auction fill already pending', { auctionId: auctionIdStr });
      return { success: false, error: 'Fill already pending' };
    }

    try {
      this.pendingFills.add(auctionIdStr);

      // Check profitability
      const profitability = await this.profitabilityChecker.checkAuctionProfitability(
        auction.auctionId,
        auction.remainingSize,
        this.liquidationEngineAddress,
        this.accountAddress
      );

      if (!profitability.isProfitable) {
        logger.debug('Auction not profitable', {
          auctionId: auctionIdStr,
          netProfitUsd: profitability.netProfitUsd,
          minProfitUsd: this.minProfitUsd,
        });
        return {
          success: false,
          error: 'Not profitable',
          profitability,
        };
      }

      logger.info('Attempting to fill profitable auction', {
        auctionId: auctionIdStr,
        fillSize: auction.remainingSize.toString(),
        netProfitUsd: profitability.netProfitUsd,
      });

      // Execute fill with retry
      const txHash = await withRetry(
        async () => {
          return await this.walletClient.writeContract({
            address: this.liquidationEngineAddress,
            abi: LiquidationEngineAbi,
            functionName: 'fillAuction',
            args: [auction.auctionId, auction.remainingSize],
            chain: arbitrumSepolia,
          });
        },
        { maxRetries: 2, baseDelayMs: 500 },
        'auction fill transaction'
      );

      logger.info('Auction fill transaction submitted', { txHash, auctionId: auctionIdStr });

      // Wait for confirmation
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: 60_000,
      });

      if (receipt.status === 'success') {
        logger.info('Auction fill confirmed', {
          txHash,
          auctionId: auctionIdStr,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
        });

        return {
          success: true,
          txHash,
          profitability,
        };
      } else {
        logger.error('Auction fill transaction failed', { txHash, auctionId: auctionIdStr });
        return {
          success: false,
          txHash,
          error: 'Transaction reverted',
          profitability,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to fill auction', { error: errorMessage, auctionId: auctionIdStr });
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      this.pendingFills.delete(auctionIdStr);
    }
  }

  async getActiveAuctions(): Promise<Auction[]> {
    try {
      const auctionIds = await this.publicClient.readContract({
        address: this.liquidationEngineAddress,
        abi: LiquidationEngineAbi,
        functionName: 'getAllActiveAuctions',
      }) as `0x${string}`[];

      const auctions: Auction[] = [];

      for (const auctionId of auctionIds) {
        const auction = await this.publicClient.readContract({
          address: this.liquidationEngineAddress,
          abi: LiquidationEngineAbi,
          functionName: 'getAuction',
          args: [auctionId],
        }) as Auction;

        if (auction.isActive) {
          auctions.push(auction);
        }
      }

      return auctions;
    } catch (error) {
      logger.error('Failed to get active auctions', { error });
      return [];
    }
  }
}
