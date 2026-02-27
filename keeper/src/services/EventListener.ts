import { PublicClient, Log, parseAbiItem } from 'viem';
import { LiquidationEngineAbi } from '../abi/index.js';
import { logger } from '../utils/logger.js';

export interface LiquidationStartedEvent {
  auctionId: `0x${string}`;
  positionId: `0x${string}`;
  trader: `0x${string}`;
  size: bigint;
  startPrice: bigint;
  endPrice: bigint;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
}

export interface AuctionFilledEvent {
  auctionId: `0x${string}`;
  filler: `0x${string}`;
  fillSize: bigint;
  fillPrice: bigint;
  profit: bigint;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
}

export type EventHandler<T> = (event: T) => void | Promise<void>;

export class EventListener {
  private readonly client: PublicClient;
  private readonly liquidationEngineAddress: `0x${string}`;
  private unwatch: (() => void) | null = null;

  private liquidationStartedHandlers: EventHandler<LiquidationStartedEvent>[] = [];
  private auctionFilledHandlers: EventHandler<AuctionFilledEvent>[] = [];

  constructor(client: PublicClient, liquidationEngineAddress: `0x${string}`) {
    this.client = client;
    this.liquidationEngineAddress = liquidationEngineAddress;
  }

  onLiquidationStarted(handler: EventHandler<LiquidationStartedEvent>): void {
    this.liquidationStartedHandlers.push(handler);
  }

  onAuctionFilled(handler: EventHandler<AuctionFilledEvent>): void {
    this.auctionFilledHandlers.push(handler);
  }

  start(): void {
    logger.info('Starting event listener', {
      address: this.liquidationEngineAddress,
    });

    // Watch for LiquidationStarted events
    this.unwatch = this.client.watchContractEvent({
      address: this.liquidationEngineAddress,
      abi: LiquidationEngineAbi,
      eventName: 'LiquidationStarted',
      onLogs: async (logs) => {
        for (const log of logs) {
          try {
            const event = this.parseLiquidationStartedLog(log);
            if (event) {
              logger.info('LiquidationStarted event received', {
                auctionId: event.auctionId,
                positionId: event.positionId,
                trader: event.trader,
              });

              for (const handler of this.liquidationStartedHandlers) {
                await handler(event);
              }
            }
          } catch (error) {
            logger.error('Error processing LiquidationStarted event', { error, log });
          }
        }
      },
      onError: (error) => {
        logger.error('Event watcher error', { error });
        // Attempt to restart watcher
        this.restart();
      },
    });
  }

  private restart(): void {
    logger.info('Restarting event listener...');
    this.stop();
    setTimeout(() => this.start(), 5000);
  }

  stop(): void {
    if (this.unwatch) {
      this.unwatch();
      this.unwatch = null;
      logger.info('Event listener stopped');
    }
  }

  private parseLiquidationStartedLog(log: Log): LiquidationStartedEvent | null {
    try {
      const args = (log as any).args;
      if (!args) return null;

      return {
        auctionId: args.auctionId,
        positionId: args.positionId,
        trader: args.trader,
        size: args.size,
        startPrice: args.startPrice,
        endPrice: args.endPrice,
        blockNumber: log.blockNumber ?? 0n,
        transactionHash: log.transactionHash ?? '0x',
      };
    } catch {
      return null;
    }
  }

  async getHistoricalLiquidations(
    fromBlock: bigint,
    toBlock?: bigint
  ): Promise<LiquidationStartedEvent[]> {
    try {
      const logs = await this.client.getContractEvents({
        address: this.liquidationEngineAddress,
        abi: LiquidationEngineAbi,
        eventName: 'LiquidationStarted',
        fromBlock,
        toBlock: toBlock ?? 'latest',
      });

      return logs
        .map((log) => this.parseLiquidationStartedLog(log as any))
        .filter((event): event is LiquidationStartedEvent => event !== null);
    } catch (error) {
      logger.error('Failed to get historical liquidations', { error });
      return [];
    }
  }
}
