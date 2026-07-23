import { logger } from './logger.js';

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  jitter?: boolean;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
  contextName = 'Operation'
): Promise<T> {
  const maxRetries = options.maxRetries ?? 4;
  const initialDelayMs = options.initialDelayMs ?? 1000;
  const maxDelayMs = options.maxDelayMs ?? 16000;
  const backoffFactor = options.backoffFactor ?? 2;
  const jitter = options.jitter ?? true;

  let attempt = 0;
  while (true) {
    attempt++;
    try {
      return await fn();
    } catch (error: any) {
      if (attempt > maxRetries) {
        logger.error(`${contextName} failed after ${maxRetries} retries: ${error.message || error}`);
        throw error;
      }

      let delay = initialDelayMs * Math.pow(backoffFactor, attempt - 1);
      if (jitter) {
        // Add ±20% jitter
        const jitterFactor = 0.8 + Math.random() * 0.4;
        delay = Math.round(delay * jitterFactor);
      }
      delay = Math.min(delay, maxDelayMs);

      // Check for Rate Limit header / status if available
      if (error?.status === 429 || error?.response?.status === 429) {
        const retryAfterHeader = error?.headers?.get?.('retry-after') || error?.response?.headers?.['retry-after'];
        if (retryAfterHeader) {
          const retryAfterSec = parseInt(retryAfterHeader, 10);
          if (!isNaN(retryAfterSec) && retryAfterSec > 0) {
            delay = retryAfterSec * 1000;
          }
        }
      }

      logger.warn(`${contextName} attempt ${attempt}/${maxRetries} failed (${error.message || error}). Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
