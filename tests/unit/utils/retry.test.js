import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { retry } from '../../../src/utils/retry.js';

describe('retry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('successful operations', () => {
    it('should return result on first success', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      
      const result = await retry(fn, { retries: 3, minDelay: 10 });
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should use default options when none provided', async () => {
      const fn = jest.fn().mockResolvedValue('ok');
      
      const result = await retry(fn);
      
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should return complex objects', async () => {
      const expected = { data: [1, 2, 3], meta: { page: 1 } };
      const fn = jest.fn().mockResolvedValue(expected);
      
      const result = await retry(fn, { retries: 1, minDelay: 10 });
      
      expect(result).toEqual(expected);
    });

    it('should handle null return value', async () => {
      const fn = jest.fn().mockResolvedValue(null);
      
      const result = await retry(fn, { retries: 1, minDelay: 10 });
      
      expect(result).toBeNull();
    });
  });

  describe('retry behavior', () => {
    it('should retry on failure and succeed on 2nd attempt', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockResolvedValue('success');
      
      const result = await retry(fn, { retries: 3, minDelay: 10, maxDelay: 20 });
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry on failure and succeed on 3rd attempt', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success');
      
      const result = await retry(fn, { retries: 3, minDelay: 10, maxDelay: 20 });
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw after all retries exhausted', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('always fails'));
      
      await expect(retry(fn, { retries: 2, minDelay: 10, maxDelay: 20 }))
        .rejects.toThrow('always fails');
      
      expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });

    it('should preserve error message from last failure', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('first error'))
        .mockRejectedValueOnce(new Error('second error'))
        .mockRejectedValueOnce(new Error('final error'));
      
      await expect(retry(fn, { retries: 2, minDelay: 10, maxDelay: 20 }))
        .rejects.toThrow('final error');
    });

    it('should work with zero retries (single attempt)', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('fail'));
      
      await expect(retry(fn, { retries: 0, minDelay: 10 }))
        .rejects.toThrow('fail');
      
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('shouldRetry callback', () => {
    it('should not retry if shouldRetry returns false', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('not retryable'));
      const shouldRetry = jest.fn().mockReturnValue(false);
      
      await expect(retry(fn, { retries: 3, shouldRetry, minDelay: 10 }))
        .rejects.toThrow('not retryable');
      
      expect(fn).toHaveBeenCalledTimes(1);
      expect(shouldRetry).toHaveBeenCalledTimes(1);
    });

    it('should pass error to shouldRetry callback', async () => {
      const testError = new Error('test error');
      const fn = jest.fn().mockRejectedValue(testError);
      const shouldRetry = jest.fn().mockReturnValue(false);
      
      await expect(retry(fn, { retries: 3, shouldRetry, minDelay: 10 }))
        .rejects.toThrow();
      
      expect(shouldRetry).toHaveBeenCalledWith(testError);
    });

    it('should retry only for specific errors', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockRejectedValueOnce(new Error('FATAL: not retryable'));
      
      const shouldRetry = (err) => !err.message.includes('FATAL');
      
      await expect(retry(fn, { retries: 5, shouldRetry, minDelay: 10 }))
        .rejects.toThrow('FATAL: not retryable');
      
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry network errors but not validation errors', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce({ code: 'ECONNREFUSED' })
        .mockResolvedValue('success');
      
      const shouldRetry = (err) => err.code === 'ECONNREFUSED';
      
      const result = await retry(fn, { retries: 3, shouldRetry, minDelay: 10 });
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('delay behavior', () => {
    it('should wait between retries', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');
      
      const startTime = Date.now();
      await retry(fn, { retries: 1, minDelay: 50, maxDelay: 100 });
      const elapsed = Date.now() - startTime;
      
      // Should have waited at least minDelay
      expect(elapsed).toBeGreaterThanOrEqual(40); // Allow some timing variance
    });
  });

  describe('edge cases', () => {
    it('should handle async function that returns immediately', async () => {
      const fn = async () => 'immediate';
      
      const result = await retry(fn, { retries: 1, minDelay: 10 });
      
      expect(result).toBe('immediate');
    });

    it('should handle sync function wrapped as async', async () => {
      const fn = jest.fn(() => Promise.resolve('sync-result'));
      
      const result = await retry(fn, { retries: 1, minDelay: 10 });
      
      expect(result).toBe('sync-result');
    });

    it('should handle function that throws Error subclass', async () => {
      class CustomError extends Error {
        constructor(message) {
          super(message);
          this.name = 'CustomError';
        }
      }
      
      const fn = jest.fn().mockRejectedValue(new CustomError('custom'));
      
      await expect(retry(fn, { retries: 0, minDelay: 10 }))
        .rejects.toThrow('custom');
    });
  });
});
