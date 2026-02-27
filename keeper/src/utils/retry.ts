import { logger } from './logger.js';

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const defaultOptions: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
  context?: string
): Promise<T> {
  const opts = { ...defaultOptions, ...options };
  let lastError: Error | undefined;
  let delay = opts.baseDelayMs;

  for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < opts.maxRetries) {
        logger.warn(`Attempt ${attempt}/${opts.maxRetries} failed${context ? ` (${context})` : ''}, retrying in ${delay}ms`, {
          error: lastError.message,
        });

        await sleep(delay);
        delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
      }
    }
  }

  logger.error(`All ${opts.maxRetries} attempts failed${context ? ` (${context})` : ''}`, {
    error: lastError?.message,
  });

  throw lastError;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
