import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSSE } from '../../src/hooks/useSSE.js';

class MockEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;

  readyState = MockEventSource.CONNECTING;
  onopen: (() => void) | null = null;
  onerror: ((e: any) => void) | null = null;
  listeners: Record<string, ((e: any) => void)[]> = {};
  closed = false;

  constructor(public url: string, public options?: any) {
    setTimeout(() => {
      this.readyState = MockEventSource.OPEN;
      this.onopen?.();
    }, 0);
  }

  addEventListener(type: string, callback: (e: any) => void) {
    this.listeners[type] = this.listeners[type] || [];
    this.listeners[type].push(callback);
  }

  close() {
    this.closed = true;
    this.readyState = MockEventSource.CLOSED;
  }

  emit(type: string, data: any) {
    (this.listeners[type] || []).forEach((cb) => cb({ data }));
  }

  /** Simulates a transport failure. Pass `closed` to emulate a terminal error. */
  fail(closed = false) {
    if (closed) this.readyState = MockEventSource.CLOSED;
    this.onerror?.(new Event('error'));
  }
}

/** Installs the mock and returns a getter for the most recently constructed instance. */
function installMock() {
  const instances: MockEventSource[] = [];
  const ctor = vi.fn().mockImplementation((url: string, opts: any) => {
    const es = new MockEventSource(url, opts);
    instances.push(es);
    return es;
  });
  // The hook reads EventSource.CLOSED off the constructor itself.
  (ctor as any).CLOSED = MockEventSource.CLOSED;
  (ctor as any).OPEN = MockEventSource.OPEN;
  vi.stubGlobal('EventSource', ctor);
  return {
    ctor,
    instances,
    last: () => instances[instances.length - 1],
  };
}

describe('useSSE', () => {
  beforeEach(() => {
    installMock();
  });

  it('connects and reports an open status', async () => {
    const mock = installMock();
    const { result } = renderHook(() => useSSE<string>('http://localhost:1234'));

    await waitFor(() => expect(result.current.connectionStatus).toBe('open'));
    expect(mock.instances).toHaveLength(1);
    expect(mock.last().url).toBe('http://localhost:1234');
    expect(result.current.error).toBeNull();
  });

  it('receives and parses JSON message data', async () => {
    const mock = installMock();
    const { result } = renderHook(() => useSSE<{ n: number }>('http://localhost:1234'));

    await waitFor(() => expect(result.current.connectionStatus).toBe('open'));
    act(() => mock.last().emit('message', JSON.stringify({ n: 7 })));

    expect(result.current.data).toEqual({ n: 7 });
  });

  it('falls back to the raw payload when the frame is not JSON', async () => {
    const mock = installMock();
    const onMessage = vi.fn();
    const { result } = renderHook(() =>
      useSSE<string>('http://localhost:1234', { onMessage }),
    );

    await waitFor(() => expect(result.current.connectionStatus).toBe('open'));
    act(() => mock.last().emit('message', 'not-json{'));

    expect(result.current.data).toBe('not-json{');
    expect(onMessage).toHaveBeenCalledWith('not-json{');
  });

  it('subscribes to a custom event name instead of "message"', async () => {
    const mock = installMock();
    const { result } = renderHook(() =>
      useSSE<string>('http://localhost:1234', { eventName: 'tick' }),
    );

    await waitFor(() => expect(result.current.connectionStatus).toBe('open'));

    // The default channel must be ignored when a custom eventName is supplied.
    act(() => mock.last().emit('message', JSON.stringify('ignored')));
    expect(result.current.data).toBeNull();

    act(() => mock.last().emit('tick', JSON.stringify('tocked')));
    expect(result.current.data).toBe('tocked');
  });

  it('surfaces transport errors through state and the onError callback', async () => {
    const mock = installMock();
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useSSE<string>('http://localhost:1234', { onError }),
    );

    await waitFor(() => expect(result.current.connectionStatus).toBe('open'));
    act(() => mock.last().fail(false));

    expect(result.current.error).toBeInstanceOf(Event);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('enters "reconnecting" after a terminal error by default', async () => {
    const mock = installMock();
    const { result } = renderHook(() => useSSE<string>('http://localhost:1234'));

    await waitFor(() => expect(result.current.connectionStatus).toBe('open'));
    act(() => mock.last().fail(true));

    await waitFor(() => expect(result.current.connectionStatus).toBe('reconnecting'));
  });

  it('stays closed after a terminal error when reconnect is disabled', async () => {
    const mock = installMock();
    const { result } = renderHook(() =>
      useSSE<string>('http://localhost:1234', { reconnect: false }),
    );

    await waitFor(() => expect(result.current.connectionStatus).toBe('open'));
    act(() => mock.last().fail(true));

    await waitFor(() => expect(result.current.connectionStatus).toBe('closed'));
    expect(result.current.connectionStatus).not.toBe('reconnecting');
  });

  it('does not connect if url is null', () => {
    const mock = installMock();
    const { result } = renderHook(() => useSSE(null));

    expect(result.current.connectionStatus).toBe('closed');
    expect(mock.instances).toHaveLength(0);
  });

  it('closes the stream when the url becomes null', async () => {
    const mock = installMock();
    const { result, rerender } = renderHook(
      ({ url }: { url: string | null }) => useSSE<string>(url),
      { initialProps: { url: 'http://localhost:1234' as string | null } },
    );

    await waitFor(() => expect(result.current.connectionStatus).toBe('open'));
    const es = mock.last();

    rerender({ url: null });

    await waitFor(() => expect(result.current.connectionStatus).toBe('closed'));
    expect(es.closed).toBe(true);
  });

  it('closes the stream on unmount so the connection is not leaked', async () => {
    const mock = installMock();
    const { result, unmount } = renderHook(() => useSSE<string>('http://localhost:1234'));

    await waitFor(() => expect(result.current.connectionStatus).toBe('open'));
    const es = mock.last();

    unmount();
    expect(es.closed).toBe(true);
  });

  it('forwards withCredentials to the EventSource constructor', async () => {
    const mock = installMock();
    renderHook(() => useSSE<string>('http://localhost:1234', { withCredentials: true }));

    await waitFor(() => expect(mock.instances).toHaveLength(1));
    expect(mock.ctor).toHaveBeenCalledWith(
      'http://localhost:1234',
      expect.objectContaining({ withCredentials: true }),
    );
  });
});
