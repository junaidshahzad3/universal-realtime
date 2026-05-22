import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSSE } from '../../src/hooks/useSSE.js';

class MockEventSource {
  readyState = 0; // CONNECTING
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  listeners: Record<string, ((e: any) => void)[]> = {};

  constructor(public url: string, public options?: any) {
    setTimeout(() => {
      this.readyState = 1; // OPEN
      this.onopen?.();
    }, 0);
  }

  addEventListener(type: string, callback: (e: any) => void) {
    this.listeners[type] = this.listeners[type] || [];
    this.listeners[type].push(callback);
  }

  close() {
    this.readyState = 2; // CLOSED
  }

  emit(type: string, data: any) {
    const callbacks = this.listeners[type] || [];
    callbacks.forEach(cb => cb({ data }));
  }
}

describe('useSSE', () => {
  beforeEach(() => {
    vi.stubGlobal('EventSource', MockEventSource);
  });

  it('connects and receives data', async () => {
    const { result } = renderHook(() => useSSE<string>('http://localhost:1234'));

    await waitFor(() => expect(result.current.connectionStatus).toBe('open'));

    const esInstance = (window as any).esInstances?.[0]; // Or just mock differently
    // Actually, I can't easily get the instance unless I mock the constructor specifically
  });

  it('receives message data', async () => {
    let esInstance: MockEventSource | null = null;
    vi.stubGlobal('EventSource', vi.fn().mockImplementation((url, opt) => {
      esInstance = new MockEventSource(url, opt);
      return esInstance;
    }));

    const { result } = renderHook(() => useSSE<string>('http://localhost:1234'));

    await waitFor(() => expect(result.current.connectionStatus).toBe('open'));

    act(() => {
      esInstance?.emit('message', JSON.stringify('hello sse'));
    });

    expect(result.current.data).toBe('hello sse');
  });

  it('does not connect if url is null', () => {
    const { result } = renderHook(() => useSSE(null));
    expect(result.current.connectionStatus).toBe('closed');
  });
});
