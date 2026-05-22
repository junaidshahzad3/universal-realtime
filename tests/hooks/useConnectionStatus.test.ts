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
});
