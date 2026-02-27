import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuctionFiller, Auction } from '../src/services/AuctionFiller.js';

describe('AuctionFiller', () => {
  const mockPublicClient = {
    readContract: vi.fn(),
    waitForTransactionReceipt: vi.fn(),
    estimateGas: vi.fn(),
    estimateFeesPerGas: vi.fn(),
  } as any;

  const mockWalletClient = {
    writeContract: vi.fn(),
    account: { address: '0x1234567890123456789012345678901234567890' },
  } as any;

  const accountAddress = '0x1234567890123456789012345678901234567890' as `0x${string}`;

  const liquidationEngineAddress = '0xabcdef1234567890abcdef1234567890abcdef12' as `0x${string}`;

  let filler: AuctionFiller;

  const mockAuction: Auction = {
    auctionId: '0x1111111111111111111111111111111111111111111111111111111111111111' as `0x${string}`,
    positionId: '0x2222222222222222222222222222222222222222222222222222222222222222' as `0x${string}`,
    trader: '0x3333333333333333333333333333333333333333' as `0x${string}`,
    marketId: '0x4444444444444444444444444444444444444444444444444444444444444444' as `0x${string}`,
    originalSize: 1000000000000000000n, // 1 WAD
    remainingSize: 1000000000000000000n,
    startPrice: 2000000000000000000000n, // $2000
    endPrice: 1800000000000000000000n,   // $1800
    startTime: BigInt(Math.floor(Date.now() / 1000)),
    duration: 600n, // 10 minutes
    isActive: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    filler = new AuctionFiller(
      mockPublicClient,
      mockWalletClient,
      accountAddress,
      liquidationEngineAddress,
      1 // minProfitUsd
    );
  });

  describe('fillAuction', () => {
    it('should fill profitable auction', async () => {
      // Mock profitability check
      mockPublicClient.readContract.mockResolvedValueOnce([
        5000000000000000000n, // $5 profit
        1900000000000000000000n, // fill price
      ]);

      // Mock gas estimation
      mockPublicClient.estimateGas.mockResolvedValue(200000n);
      mockPublicClient.estimateFeesPerGas.mockResolvedValue({
        maxFeePerGas: 100000000n, // 0.1 gwei
        maxPriorityFeePerGas: 10000000n,
      });

      // Mock transaction
      const txHash = '0xabc123' as `0x${string}`;
      mockWalletClient.writeContract.mockResolvedValue(txHash);
      mockPublicClient.waitForTransactionReceipt.mockResolvedValue({
        status: 'success',
        blockNumber: 12345n,
        gasUsed: 150000n,
      });

      const result = await filler.fillAuction(mockAuction);

      expect(result.success).toBe(true);
      expect(result.txHash).toBe(txHash);
      expect(mockWalletClient.writeContract).toHaveBeenCalledOnce();
    });

    it('should skip unprofitable auction', async () => {
      // Mock low profitability
      mockPublicClient.readContract.mockResolvedValueOnce([
        100000000000000000n, // $0.1 profit
        1900000000000000000000n,
      ]);

      const result = await filler.fillAuction(mockAuction);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not profitable');
      expect(mockWalletClient.writeContract).not.toHaveBeenCalled();
    });

    it('should handle transaction failure', async () => {
      // Mock profitability check
      mockPublicClient.readContract.mockResolvedValueOnce([
        5000000000000000000n,
        1900000000000000000000n,
      ]);

      // Mock gas estimation
      mockPublicClient.estimateGas.mockResolvedValue(200000n);
      mockPublicClient.estimateFeesPerGas.mockResolvedValue({
        maxFeePerGas: 100000000n,
        maxPriorityFeePerGas: 10000000n,
      });

      // Mock failed transaction
      mockWalletClient.writeContract.mockRejectedValue(new Error('Transaction failed'));

      const result = await filler.fillAuction(mockAuction);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Transaction failed');
    });
  });

  describe('getActiveAuctions', () => {
    it('should return active auctions', async () => {
      mockPublicClient.readContract
        .mockResolvedValueOnce([mockAuction.auctionId]) // getAllActiveAuctions
        .mockResolvedValueOnce(mockAuction); // getAuction

      const auctions = await filler.getActiveAuctions();

      expect(auctions).toHaveLength(1);
      expect(auctions[0].auctionId).toBe(mockAuction.auctionId);
    });

    it('should filter inactive auctions', async () => {
      const inactiveAuction = { ...mockAuction, isActive: false };

      mockPublicClient.readContract
        .mockResolvedValueOnce([mockAuction.auctionId])
        .mockResolvedValueOnce(inactiveAuction);

      const auctions = await filler.getActiveAuctions();

      expect(auctions).toHaveLength(0);
    });

    it('should handle errors gracefully', async () => {
      mockPublicClient.readContract.mockRejectedValue(new Error('RPC error'));

      const auctions = await filler.getActiveAuctions();

      expect(auctions).toHaveLength(0);
    });
  });
});
