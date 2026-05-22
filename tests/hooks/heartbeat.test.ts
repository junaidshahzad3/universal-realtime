import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Server, WebSocket as MockWebSocket } from 'mock-socket';
import { useWebSocket } from '../../src/hooks/useWebSocket.js';

describe('useWebSocket Heartbeat Keep-Alive', () => {
  beforeEach(() => {
    vi.stubGlobal('WebSocket', MockWebSocket);
  });

  it('sends heartbeat ping messages at specified interval', async () => {
    const url = 'ws://localhost:5101';
    const mockServer = new Server(url);
    
    const messages: string[] = [];
    mockServer.on('connection', (socket) => {
      socket.on('message', (data) => {
        messages.push(data as string);
        // Reply to reset the heartbeat timeout on the client!
        socket.send(JSON.stringify('pong'));
      });
    });

    const { result } = renderHook(() =>
      useWebSocket(url, {
        heartbeat: {
          interval: 50,
          timeout: 25,
          message: 'heartbeat-ping',
        },
      })
    );

    await waitFor(() => expect(result.current.connectionStatus).toBe('open'));

    // Wait for the first ping
    await waitFor(() => {
      expect(messages).toContain('heartbeat-ping');
    }, { timeout: 500 });

    // Wait for the second ping
    await waitFor(() => {
      expect(messages.filter((m) => m === 'heartbeat-ping').length).toBeGreaterThanOrEqual(2);
    }, { timeout: 500 });

    mockServer.stop();
  });

  it('closes the connection on heartbeat timeout', async () => {
    const url = 'ws://localhost:5102';
    const mockServer = new Server(url);

    const { result } = renderHook(() =>
      useWebSocket(url, {
        heartbeat: {
          interval: 40,
          timeout: 10,
          message: 'ping',
        },
        reconnect: false, // disable reconnect to simplify assertion
      })
    );

    await waitFor(() => expect(result.current.connectionStatus).toBe('open'));

    // Wait for it to close due to heartbeat timeout
    await waitFor(() => {
      expect(result.current.connectionStatus).toBe('closed');
    }, { timeout: 500 });

    mockServer.stop();
  });
});
