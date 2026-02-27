import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia } from 'viem/chains';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { sleep } from './utils/retry.js';
import {
  AuctionFiller,
  EventListener,
  Auction,
  LiquidationStartedEvent,
} from './services/index.js';

// ============================================
// STATE
// ============================================

let isShuttingDown = false;
let eventListener: EventListener | null = null;
let auctionFiller: AuctionFiller | null = null;

// ============================================
// CLIENTS
// ============================================

const publicClient = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(config.rpcUrl),
});

// ============================================
// KEEPER LOGIC
// ============================================

async function processAuctions(): Promise<void> {
  if (!auctionFiller) return;

  const auctions = await auctionFiller.getActiveAuctions();

  if (auctions.length === 0) {
    logger.debug('No active auctions');
    return;
  }

  logger.info(`Found ${auctions.length} active auctions`);

  // Process each auction
  const results = await Promise.allSettled(
    auctions.map((auction) => processAuction(auction))
  );

  // Log results
  const successful = results.filter((r) => r.status === 'fulfilled' && r.value).length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  if (successful > 0 || failed > 0) {
    logger.info('Auction processing complete', { successful, failed, total: auctions.length });
  }
}

async function processAuction(auction: Auction): Promise<boolean> {
  if (!auctionFiller) return false;

  const result = await auctionFiller.fillAuction(auction);

  if (result.success) {
    logger.info('Successfully filled auction', {
      auctionId: auction.auctionId,
      txHash: result.txHash,
      netProfitUsd: result.profitability?.netProfitUsd,
    });
    return true;
  }

  return false;
}

async function handleNewLiquidation(event: LiquidationStartedEvent): Promise<void> {
  logger.info('New liquidation detected, processing immediately', {
    auctionId: event.auctionId,
    positionId: event.positionId,
  });

  // Slight delay to allow state to propagate
  await sleep(100);

  // Process this specific auction
  await processAuctions();
}

// ============================================
// MAIN LOOP
// ============================================

async function startKeeper(): Promise<void> {
  logger.info('Starting RWA Perp Keeper...');
  logger.info('Configuration:', {
    rpcUrl: config.rpcUrl.replace(/\/[^\/]+$/, '/***'), // Mask API key
    chainId: config.chainId,
    minProfitUsd: config.keeper.minProfitUsd,
    pollIntervalMs: config.keeper.pollIntervalMs,
  });

  // Validate config
  if (!config.contracts.liquidationEngine) {
    logger.error('LiquidationEngine address not configured');
    process.exit(1);
  }

  // Setup wallet if private key is provided
  if (config.privateKey) {
    const account = privateKeyToAccount(config.privateKey as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: arbitrumSepolia,
      transport: http(config.rpcUrl),
    });

    logger.info('Wallet configured', { address: account.address });

    // Initialize auction filler
    auctionFiller = new AuctionFiller(
      publicClient,
      walletClient,
      account.address,
      config.contracts.liquidationEngine as `0x${string}`,
      config.keeper.minProfitUsd
    );
  } else {
    logger.warn('No private key configured, running in read-only mode');
  }

  // Initialize event listener
  eventListener = new EventListener(
    publicClient,
    config.contracts.liquidationEngine as `0x${string}`
  );

  // Register event handler
  eventListener.onLiquidationStarted(handleNewLiquidation);

  // Start event listener
  eventListener.start();

  // Polling loop
  while (!isShuttingDown) {
    try {
      await processAuctions();
    } catch (error) {
      logger.error('Error in main loop', { error });
    }

    await sleep(config.keeper.pollIntervalMs);
  }
}

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

function setupGracefulShutdown(): void {
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    isShuttingDown = true;

    // Stop event listener
    if (eventListener) {
      eventListener.stop();
    }

    // Give some time for pending operations
    await sleep(1000);

    logger.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// ============================================
// ENTRYPOINT
// ============================================

setupGracefulShutdown();

startKeeper().catch((error) => {
  logger.error('Fatal error', { error });
  process.exit(1);
});
