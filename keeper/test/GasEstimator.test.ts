import { describe, it, expect, vi } from 'vitest';
import { GasEstimator } from '../src/services/GasEstimator.js';
import { parseGwei } from 'viem';

describe('GasEstimator', () => {
  const mockClient = {
    estimateGas: vi.fn(),
    estimateFeesPerGas: vi.fn(),
    getGasPrice: vi.fn(),
  } as any;

  describe('estimateGas', () => {
    it('should return gas estimate with cost calculation', async () => {
      mockClient.estimateGas.mockResolvedValue(100000n);
      mockClient.estimateFeesPerGas.mockResolvedValue({
        maxFeePerGas: parseGwei('0.1'),
        maxPriorityFeePerGas: parseGwei('0.01'),
      });

      const estimator = new GasEstimator(mockClient, 3000);

      const estimate = await estimator.estimateGas(
        '0x1234567890123456789012345678901234567890',
        '0xabcd'
      );

      expect(estimate.gasLimit).toBe(100000n);
      expect(estimate.maxFeePerGas).toBe(parseGwei('0.1'));
      expect(estimate.estimatedCostWei).toBe(100000n * parseGwei('0.1'));
      expect(estimate.estimatedCostUsd).toBeGreaterThan(0);
    });
  });

  describe('isProfitableAfterGas', () => {
    it('should return true when profit exceeds gas + minimum', () => {
      const estimator = new GasEstimator(mockClient, 3000);

      const result = estimator.isProfitableAfterGas(10, 2, 5);

      expect(result).toBe(true);
    });

    it('should return false when profit is below gas + minimum', () => {
      const estimator = new GasEstimator(mockClient, 3000);

      const result = estimator.isProfitableAfterGas(5, 2, 5);

      expect(result).toBe(false);
    });

    it('should return true when exactly at minimum', () => {
      const estimator = new GasEstimator(mockClient, 3000);

      const result = estimator.isProfitableAfterGas(7, 2, 5);

      expect(result).toBe(true);
    });
  });
});
