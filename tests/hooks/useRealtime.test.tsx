import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Server, WebSocket as MockWebSocket } from 'mock-socket';
import { RealtimeProvider } from '../../src/hooks/RealtimeProvider.js';
import { useRealtime } from '../../src/hooks/useRealtime.js';

describe('RealtimeProvider and useRealtime', () => {
  beforeEach(() => {
    vi.stubGlobal('WebSocket', MockWebSocket);
  });

  it('throws error when useRealtime is used outside RealtimeProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      renderHook(() => useRealtime());
    }).toThrow('useRealtime must be used within a RealtimeProvider');

    consoleSpy.mockRestore();
  });

  it('shares single WebSocket connection and receives messages across multiple hooks', async () => {
    const url = 'ws://localhost:5201';
    const mockServer = new Server(url);

    let connectionCount = 0;
    mockServer.on('connection', () => {
      connectionCount++;
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RealtimeProvider url={url}>{children}</RealtimeProvider>
    );

    const { result } = renderHook(() => {
      const hook1 = useRealtime<string>();
      const hook2 = useRealtime<string>();
      return { hook1, hook2 };
    }, { wrapper });

    await waitFor(() => expect(result.current.hook1.connectionStatus).toBe('open'));
    await waitFor(() => expect(result.current.hook2.connectionStatus).toBe('open'));

    expect(connectionCount).toBe(1);

    act(() => {
      mockServer.emit('message', JSON.stringify('broadcast message'));
    });

    await waitFor(() => expect(result.current.hook1.lastMessage).toBe('broadcast message'));
    await waitFor(() => expect(result.current.hook2.lastMessage).toBe('broadcast message'));

    mockServer.stop();
  });

  it('filters incoming messages correctly to avoid updates', async () => {
    const url = 'ws://localhost:5202';
    const mockServer = new Server(url);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RealtimeProvider url={url}>{children}</RealtimeProvider>
    );

    const { result } = renderHook(() => 
      useRealtime<string>((msg) => msg.startsWith('alert')), 
      { wrapper }
    );

    await waitFor(() => expect(result.current.connectionStatus).toBe('open'));

    act(() => {
      mockServer.emit('message', JSON.stringify('normal message'));
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current.lastMessage).toBeNull();

    act(() => {
      mockServer.emit('message', JSON.stringify('alert: high cpu load'));
    });

    await waitFor(() => expect(result.current.lastMessage).toBe('alert: high cpu load'));

    mockServer.stop();
  });

  it('sends messages through the shared hook', async () => {
    const url = 'ws://localhost:5203';
    const mockServer = new Server(url);

    let receivedMessage: string | null = null;
    mockServer.on('connection', (socket) => {
      socket.on('message', (data) => {
        receivedMessage = data as string;
      });
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RealtimeProvider url={url}>{children}</RealtimeProvider>
    );

    const { result } = renderHook(() => useRealtime<string>(), { wrapper });

    await waitFor(() => expect(result.current.connectionStatus).toBe('open'));

    act(() => {
      result.current.sendMessage({ text: 'hello server' });
    });

    await waitFor(() => expect(receivedMessage).toBe(JSON.stringify({ text: 'hello server' })));

    mockServer.stop();
  });

  it('triggers reconnection on connection drop', async () => {
    const url = 'ws://localhost:5204';
    const mockServer = new Server(url);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RealtimeProvider url={url} options={{ reconnectInterval: 50 }}>{children}</RealtimeProvider>
    );

    const { result } = renderHook(() => useRealtime<string>(), { wrapper });

    await waitFor(() => expect(result.current.connectionStatus).toBe('open'));

    act(() => {
      mockServer.close();
    });

    await waitFor(() => expect(result.current.connectionStatus).toBe('reconnecting'));
    mockServer.stop();
  });

  it('triggers failed state when reconnect runs out of attempts', async () => {
    const url = 'ws://localhost:5205';
    const mockServer = new Server(url);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RealtimeProvider url={url} options={{ reconnectAttempts: 1, reconnectInterval: 10 }}>{children}</RealtimeProvider>
    );

    const { result } = renderHook(() => useRealtime<string>(), { wrapper });

    await waitFor(() => expect(result.current.connectionStatus).toBe('open'));

    // Close and stop server so reconnect attempts fail
    mockServer.close();
    mockServer.stop();

    await waitFor(() => expect(result.current.connectionStatus).toBe('closed'), { timeout: 1000 });
  });
});
