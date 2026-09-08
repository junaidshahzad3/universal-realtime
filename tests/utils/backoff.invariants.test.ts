import { describe, it, expect } from 'vitest';
import { getDelay } from '../../src/utils/backoff.js';
import { ReconnectManager } from '../../src/utils/reconnect.js';

const BASE = 1000;
const MAX = 30000;

describe('getDelay invariants', () => {
  it('never exceeds max, even with jitter applied', () => {
    // Regression: jitter was applied after the cap and returned unclamped, so
    // ~50% of draws landed above max (observed up to 37,499ms against 30,000).
    for (let attempt = 0; attempt <= 12; attempt++) {
      for (let i = 0; i < 500; i++) {
        expect(getDelay(attempt, BASE, MAX, true)).toBeLessThanOrEqual(MAX);
      }
    }
  });

  it('never returns a negative or zero delay for a positive base', () => {
    for (let attempt = 0; attempt <= 12; attempt++) {
      expect(getDelay(attempt, BASE, MAX, true)).toBeGreaterThan(0);
    }
  });

  it('doubles on each attempt until it reaches the ceiling', () => {
    expect(getDelay(0, BASE, MAX)).toBe(1000);
    expect(getDelay(1, BASE, MAX)).toBe(2000);
    expect(getDelay(2, BASE, MAX)).toBe(4000);
    expect(getDelay(3, BASE, MAX)).toBe(8000);
    expect(getDelay(4, BASE, MAX)).toBe(16000);
    // 32000 would exceed the cap
    expect(getDelay(5, BASE, MAX)).toBe(MAX);
    expect(getDelay(50, BASE, MAX)).toBe(MAX);
  });

  it('is deterministic when jitter is off', () => {
    const runs = new Set(Array.from({ length: 20 }, () => getDelay(3, BASE, MAX, false)));
    expect(runs.size).toBe(1);
  });

  it('actually varies when jitter is on', () => {
    const runs = new Set(Array.from({ length: 60 }, () => getDelay(3, BASE, MAX, true)));
    expect(runs.size).toBeGreaterThan(1);
  });

  it('keeps jittered delays within ±25% of the undithered value', () => {
    const plain = getDelay(3, BASE, MAX, false);
    for (let i = 0; i < 400; i++) {
      const d = getDelay(3, BASE, MAX, true);
      expect(d).toBeGreaterThanOrEqual(Math.floor(plain * 0.75));
      expect(d).toBeLessThanOrEqual(Math.ceil(plain * 1.25));
    }
  });

  it('still staggers once the ceiling is reached', () => {
    // Clamping must not collapse every client onto the exact same delay.
    const runs = new Set(Array.from({ length: 200 }, () => getDelay(20, BASE, MAX, true)));
    expect(runs.size).toBeGreaterThan(1);
  });
});

describe('ReconnectManager', () => {
  it('fires onFailed once maxAttempts is exhausted', async () => {
    let reconnects = 0;
    let failed = 0;
    const m = new ReconnectManager({
      maxAttempts: 3,
      baseInterval: 5,
      maxInterval: 20,
      jitter: false,
      onReconnect: () => reconnects++,
      onFailed: () => failed++,
    });

    m.start();
    await new Promise((r) => setTimeout(r, 300));

    expect(reconnects).toBe(3);
    expect(failed).toBe(1);
  });

  it('stops scheduling and resets the counter on stop()', async () => {
    let reconnects = 0;
    const m = new ReconnectManager({
      maxAttempts: 10,
      baseInterval: 10,
      maxInterval: 40,
      jitter: false,
      onReconnect: () => reconnects++,
      onFailed: () => {},
    });

    m.start();
    await new Promise((r) => setTimeout(r, 45));
    m.stop();
    const atStop = reconnects;

    await new Promise((r) => setTimeout(r, 120));
    expect(reconnects).toBe(atStop);
    expect(m.currentAttempt).toBe(0);
  });

  it('ignores a second start() while already running', async () => {
    let reconnects = 0;
    const m = new ReconnectManager({
      maxAttempts: 2,
      baseInterval: 10,
      maxInterval: 20,
      jitter: false,
      onReconnect: () => reconnects++,
      onFailed: () => {},
    });

    m.start();
    m.start(); // must not double-schedule
    m.start();
    await new Promise((r) => setTimeout(r, 200));

    expect(reconnects).toBe(2);
    m.stop();
  });

  it('can be restarted after stopping', async () => {
    let reconnects = 0;
    const m = new ReconnectManager({
      maxAttempts: 2,
      baseInterval: 5,
      maxInterval: 10,
      jitter: false,
      onReconnect: () => reconnects++,
      onFailed: () => {},
    });

    m.start();
    await new Promise((r) => setTimeout(r, 60));
    m.stop();
    reconnects = 0;

    m.start();
    await new Promise((r) => setTimeout(r, 80));
    expect(reconnects).toBeGreaterThan(0);
    m.stop();
  });
});
