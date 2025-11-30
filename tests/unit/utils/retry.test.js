import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { retry } from '../../../src/utils/retry.js';

describe('retry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return result on first success', async () => {
    const fn = jest.fn().mockResolvedValue('success');
    
    const result = await retry(fn, { retries: 3, minDelay: 10 });
    
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and succeed', async () => {
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

  it('should not retry if shouldRetry returns false', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('not retryable'));
    const shouldRetry = jest.fn().mockReturnValue(false);
    
    await expect(retry(fn, { retries: 3, shouldRetry, minDelay: 10 }))
      .rejects.toThrow('not retryable');
    
    expect(fn).toHaveBeenCalledTimes(1);
    expect(shouldRetry).toHaveBeenCalledTimes(1);
  });

  it('should use default options', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    
    const result = await retry(fn);
    
    expect(result).toBe('ok');
  });
});
