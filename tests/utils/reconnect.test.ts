import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReconnectManager } from '../../src/utils/reconnect.js';

describe('ReconnectManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('schedules reconnection attempts', () => {
    const onReconnect = vi.fn();
    const onFailed = vi.fn();
    const manager = new ReconnectManager({
      maxAttempts: 3,
      baseInterval: 1000,
      maxInterval: 5000,
      onReconnect,
      onFailed,
    });

    manager.start();
    
    // First attempt after 1000ms
    vi.advanceTimersByTime(1001);
    expect(onReconnect).toHaveBeenCalledWith(0);
    expect(manager.currentAttempt).toBe(1);

    // Second attempt after 2000ms
    vi.advanceTimersByTime(2001);
    expect(onReconnect).toHaveBeenCalledWith(1);
    expect(manager.currentAttempt).toBe(2);

    // Third attempt after 4000ms
    vi.advanceTimersByTime(4001);
    expect(onReconnect).toHaveBeenCalledWith(2);
    expect(manager.currentAttempt).toBe(3);

    // Should fail after 3 attempts
    vi.runAllTimers();
    expect(onFailed).toHaveBeenCalled();
  });

  it('stops reconnection on stop()', () => {
    const onReconnect = vi.fn();
    const manager = new ReconnectManager({
      maxAttempts: 3,
      baseInterval: 1000,
      maxInterval: 5000,
      onReconnect,
      onFailed: vi.fn(),
    });

    manager.start();
    vi.advanceTimersByTime(500);
    manager.stop();
    vi.advanceTimersByTime(1000);
    expect(onReconnect).not.toHaveBeenCalled();
    expect(manager.currentAttempt).toBe(0);
  });

  it('supports randomized jitter option', () => {
    const onReconnect = vi.fn();
    const manager = new ReconnectManager({
      maxAttempts: 1,
      baseInterval: 2000,
      maxInterval: 5000,
      jitter: true,
      onReconnect,
      onFailed: vi.fn(),
    });

    manager.start();
    
    // With jitter = true and base 2000, actual delay will be in [1500, 2500]ms range.
    // At 1499ms, it should not have triggered.
    vi.advanceTimersByTime(1499);
    expect(onReconnect).not.toHaveBeenCalled();

    // At 2501ms, it must have triggered.
    vi.advanceTimersByTime(1002);
    expect(onReconnect).toHaveBeenCalled();
  });
});
