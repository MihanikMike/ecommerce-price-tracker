import { describe, it, expect } from '@jest/globals';
import { delay } from '../../../src/utils/delay.js';

describe('delay', () => {
  it('should delay for specified milliseconds', async () => {
    const start = Date.now();
    await delay(100);
    const elapsed = Date.now() - start;
    
    // Allow some tolerance (90-150ms)
    expect(elapsed).toBeGreaterThanOrEqual(90);
    expect(elapsed).toBeLessThan(150);
  });

  it('should resolve without value', async () => {
    const result = await delay(10);
    expect(result).toBeUndefined();
  });

  it('should handle zero delay', async () => {
    const start = Date.now();
    await delay(0);
    const elapsed = Date.now() - start;
    
    expect(elapsed).toBeLessThan(50);
  });
});
