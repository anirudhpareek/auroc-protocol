import { createPublicClient, createWalletClient, http, parseAbiItem } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia } from 'viem/chains';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { LiquidationEngineAbi, PerpEngineAbi } from './abi/index.js';

// ============================================
// TYPES
// ============================================

interface Auction {
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

// ============================================
// CLIENTS
// ============================================

const publicClient = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(config.rpcUrl),
});

let walletClient: ReturnType<typeof createWalletClient> | null = null;
let account: ReturnType<typeof privateKeyToAccount> | null = null;

if (config.privateKey) {
  account = privateKeyToAccount(config.privateKey as `0x${string}`);
  walletClient = createWalletClient({
    account,
    chain: arbitrumSepolia,
    transport: http(config.rpcUrl),
  });
}

// ============================================
// KEEPER LOGIC
// ============================================

async function getActiveAuctions(): Promise<Auction[]> {
  if (!config.contracts.liquidationEngine) {
    logger.warn('LiquidationEngine address not configured');
    return [];
  }

  try {
    const auctionIds = await publicClient.readContract({
      address: config.contracts.liquidationEngine as `0x${string}`,
      abi: LiquidationEngineAbi,
      functionName: 'getAllActiveAuctions',
    }) as `0x${string}`[];

    const auctions: Auction[] = [];

    for (const auctionId of auctionIds) {
      const auction = await publicClient.readContract({
        address: config.contracts.liquidationEngine as `0x${string}`,
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

async function calculateProfit(auctionId: `0x${string}`, fillSize: bigint): Promise<{ profit: bigint; fillPrice: bigint }> {
  if (!config.contracts.liquidationEngine) {
    return { profit: 0n, fillPrice: 0n };
  }

  try {
    const result = await publicClient.readContract({
      address: config.contracts.liquidationEngine as `0x${string}`,
      abi: LiquidationEngineAbi,
      functionName: 'calculateKeeperProfit',
      args: [auctionId, fillSize],
    }) as [bigint, bigint];

    return { profit: result[0], fillPrice: result[1] };
  } catch (error) {
    logger.error('Failed to calculate profit', { error, auctionId });
    return { profit: 0n, fillPrice: 0n };
  }
}

async function fillAuction(auctionId: `0x${string}`, fillSize: bigint): Promise<boolean> {
  if (!walletClient || !account || !config.contracts.liquidationEngine) {
    logger.error('Wallet not configured');
    return false;
  }

  try {
    const hash = await walletClient.writeContract({
      address: config.contracts.liquidationEngine as `0x${string}`,
      abi: LiquidationEngineAbi,
      functionName: 'fillAuction',
      args: [auctionId, fillSize],
    });

    logger.info('Auction fill submitted', { hash, auctionId });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === 'success') {
      logger.info('Auction fill confirmed', { hash, auctionId });
      return true;
    } else {
      logger.error('Auction fill failed', { hash, auctionId });
      return false;
    }
  } catch (error) {
    logger.error('Failed to fill auction', { error, auctionId });
    return false;
  }
}

async function processAuctions(): Promise<void> {
  const auctions = await getActiveAuctions();

  if (auctions.length === 0) {
    logger.debug('No active auctions');
    return;
  }

  logger.info(`Found ${auctions.length} active auctions`);

  for (const auction of auctions) {
    const fillSize = auction.remainingSize;
    const { profit, fillPrice } = await calculateProfit(auction.auctionId, fillSize);

    // Convert profit to USD (assuming 18 decimals)
    const profitUsd = Number(profit) / 1e18;

    logger.info('Evaluating auction', {
      auctionId: auction.auctionId,
      fillSize: fillSize.toString(),
      fillPrice: fillPrice.toString(),
      profitUsd,
    });

    if (profitUsd >= config.keeper.minProfitUsd) {
      logger.info('Profitable auction found, filling...', {
        auctionId: auction.auctionId,
        profitUsd,
      });

      const success = await fillAuction(auction.auctionId, fillSize);

      if (success) {
        logger.info('Successfully filled auction', { auctionId: auction.auctionId });
      }
    } else {
      logger.debug('Auction not profitable enough', {
        auctionId: auction.auctionId,
        profitUsd,
        minProfit: config.keeper.minProfitUsd,
      });
    }
  }
}

// ============================================
// EVENT LISTENERS
// ============================================

async function watchLiquidationEvents(): Promise<void> {
  if (!config.contracts.liquidationEngine) {
    logger.warn('LiquidationEngine address not configured, skipping event watching');
    return;
  }

  logger.info('Starting event watcher...');

  publicClient.watchContractEvent({
    address: config.contracts.liquidationEngine as `0x${string}`,
    abi: LiquidationEngineAbi,
    eventName: 'LiquidationStarted',
    onLogs: (logs) => {
      for (const log of logs) {
        logger.info('New liquidation started', {
          auctionId: (log as any).args?.auctionId,
          positionId: (log as any).args?.positionId,
        });

        // Immediately process this auction
        processAuctions().catch((error) => {
          logger.error('Failed to process auction', { error });
        });
      }
    },
    onError: (error) => {
      logger.error('Event watcher error', { error });
    },
  });
}

// ============================================
// MAIN LOOP
// ============================================

async function main(): Promise<void> {
  logger.info('Starting RWA Perp Keeper...');
  logger.info('Config:', {
    rpcUrl: config.rpcUrl,
    chainId: config.chainId,
    minProfitUsd: config.keeper.minProfitUsd,
    pollIntervalMs: config.keeper.pollIntervalMs,
  });

  if (!config.privateKey) {
    logger.warn('No private key configured, running in read-only mode');
  }

  // Start event watcher
  watchLiquidationEvents();

  // Polling loop
  while (true) {
    try {
      await processAuctions();
    } catch (error) {
      logger.error('Error in main loop', { error });
    }

    await new Promise((resolve) => setTimeout(resolve, config.keeper.pollIntervalMs));
  }
}

// Run
main().catch((error) => {
  logger.error('Fatal error', { error });
  process.exit(1);
});
