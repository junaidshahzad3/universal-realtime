import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useConnectionStatus } from '../../src/hooks/useConnectionStatus.js';

describe('useConnectionStatus', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { onLine: true });
  });

  it('initializes with online status', () => {
    const { result } = renderHook(() => useConnectionStatus());
    expect(result.current.status).toBe('online');
    expect(result.current.isOnline).toBe(true);
  });

  it('initializes as offline when the browser reports no connection', () => {
    vi.stubGlobal('navigator', { onLine: false });

    const { result } = renderHook(() => useConnectionStatus());
    expect(result.current.status).toBe('offline');
    expect(result.current.isOffline).toBe(true);
    expect(result.current.isOnline).toBe(false);
  });

  it('updates status when online/offline events fire', () => {
    const { result } = renderHook(() => useConnectionStatus());

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current.status).toBe('offline');
    expect(result.current.isOffline).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current.status).toBe('online');
    expect(result.current.isOnline).toBe(true);
  });

  it('exposes a "since" timestamp that advances on each transition', async () => {
    const { result } = renderHook(() => useConnectionStatus());

    const initial = result.current.since;
    expect(initial).toBeInstanceOf(Date);

    // Ensure the clock advances so the two timestamps are distinguishable.
    await new Promise((r) => setTimeout(r, 5));
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    const afterOffline = result.current.since!;
    expect(afterOffline.getTime()).toBeGreaterThanOrEqual(initial!.getTime());

    await new Promise((r) => setTimeout(r, 5));
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(result.current.since!.getTime()).toBeGreaterThanOrEqual(afterOffline.getTime());
  });

  it('isOnline and isOffline stay mutually exclusive', () => {
    const { result } = renderHook(() => useConnectionStatus());
    expect(result.current.isOnline).not.toBe(result.current.isOffline);

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current.isOnline).not.toBe(result.current.isOffline);
  });

  it('removes its window listeners on unmount', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useConnectionStatus());

    unmount();

    const removed = remove.mock.calls.map((c) => c[0]);
    expect(removed).toContain('online');
    expect(removed).toContain('offline');
    remove.mockRestore();
  });

  it('stops reacting to events after unmount', () => {
    const { result, unmount } = renderHook(() => useConnectionStatus());
    expect(result.current.status).toBe('online');

    unmount();

    // Dispatching after teardown must not throw or update detached state.
    expect(() => {
      window.dispatchEvent(new Event('offline'));
    }).not.toThrow();
  });
});
