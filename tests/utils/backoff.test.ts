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
});
