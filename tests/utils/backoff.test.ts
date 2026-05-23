import { describe, it, expect } from 'vitest';
import { getDelay } from '../../src/utils/backoff.js';

describe('getDelay', () => {
  it('calculates exponential delay', () => {
    expect(getDelay(0, 1000, 30000)).toBe(1000);
    expect(getDelay(1, 1000, 30000)).toBe(2000);
    expect(getDelay(2, 1000, 30000)).toBe(4000);
    expect(getDelay(3, 1000, 30000)).toBe(8000);
  });

  it('caps delay at max value', () => {
    expect(getDelay(10, 1000, 30000)).toBe(30000);
  });

  it('applies ±25% randomized jitter when enabled', () => {
    const baseDelay = 4000; // attempt 2 with base 1000
    const delayWithJitter = getDelay(2, 1000, 30000, true);
    
    // It should be within [3000, 5000] range (baseDelay * 0.75 and baseDelay * 1.25)
    expect(delayWithJitter).toBeGreaterThanOrEqual(3000);
    expect(delayWithJitter).toBeLessThanOrEqual(5000);
  });
});
