import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Server, WebSocket as MockWebSocket } from 'mock-socket';
import { useWebSocket } from '../../src/hooks/useWebSocket.js';

describe('useWebSocket', () => {
  beforeEach(() => {
    vi.stubGlobal('WebSocket', MockWebSocket);
  });

  it('connects and receives messages', async () => {
    const url = 'ws://localhost:5001';
    const mockServer = new Server(url);
    
    const { result } = renderHook(() => useWebSocket<string>(url));

    await waitFor(() => expect(result.current.connectionStatus).toBe('open'));

    act(() => {
      mockServer.emit('message', JSON.stringify('hello world'));
    });

    expect(result.current.lastMessage).toBe('hello world');
    mockServer.stop();
  });

  it('sends messages', async () => {
    const url = 'ws://localhost:5002';
    const mockServer = new Server(url);

    let receivedMessage: string | null = null;
    mockServer.on('connection', (socket) => {
      socket.on('message', (data) => {
        receivedMessage = data as string;
      });
    });

    const { result } = renderHook(() => useWebSocket<string>(url));

    await waitFor(() => expect(result.current.connectionStatus).toBe('open'));

    act(() => {
      result.current.sendMessage('test message');
    });

    await waitFor(() => expect(receivedMessage).toBe('test message'));
    mockServer.stop();
  });

  it('reconnects after disconnect', async () => {
    const url = 'ws://localhost:5003';
    const mockServer = new Server(url);

    const { result } = renderHook(() => useWebSocket<string>(url, {
      reconnectInterval: 50,
    }));

    await waitFor(() => expect(result.current.connectionStatus).toBe('open'));

    act(() => {
      mockServer.close();
    });

    // Wait for it to reconnect (React batches 'closed' and 'reconnecting' state updates)
    await waitFor(() => expect(result.current.connectionStatus).toBe('reconnecting'));
    mockServer.stop();
  });

  it('does not connect if url is null', () => {
    const { result } = renderHook(() => useWebSocket(null));
    expect(result.current.connectionStatus).toBe('closed');
  });
});
