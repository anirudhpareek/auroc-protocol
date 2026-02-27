import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry, sleep } from '../src/utils/retry.js';

describe('retry utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('sleep', () => {
    it('should resolve after specified time', async () => {
      const promise = sleep(1000);
      vi.advanceTimersByTime(1000);
      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await withRetry(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success');

      const promise = withRetry(fn, { maxRetries: 3, baseDelayMs: 100 });

      // Advance through retries
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(200);

      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw after max retries', async () => {
      // Use real timers for this test to avoid unhandled rejection
      vi.useRealTimers();

      const fn = vi.fn().mockRejectedValue(new Error('always fail'));

      await expect(
        withRetry(fn, { maxRetries: 2, baseDelayMs: 10 })
      ).rejects.toThrow('always fail');

      expect(fn).toHaveBeenCalledTimes(2);

      // Restore fake timers for other tests
      vi.useFakeTimers();
    });

    it('should use exponential backoff', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');

      const delaysSeen: number[] = [];
      const originalSetTimeout = globalThis.setTimeout;
      vi.spyOn(globalThis, 'setTimeout').mockImplementation((callback, ms) => {
        if (ms && ms > 0) delaysSeen.push(ms);
        return originalSetTimeout(callback, ms);
      });

      const promise = withRetry(fn, {
        maxRetries: 3,
        baseDelayMs: 100,
        backoffMultiplier: 2,
      });

      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(200);

      await promise;

      expect(delaysSeen).toContain(100);
      expect(delaysSeen).toContain(200);
    });
  });
});
