import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Server, WebSocket as MockWebSocket } from 'mock-socket';
import { usePresence } from '../../src/hooks/usePresence.js';

describe('usePresence', () => {
  beforeEach(() => {
    vi.stubGlobal('WebSocket', MockWebSocket);
  });

  it('connects and receives presence updates', async () => {
    const url = 'ws://localhost:6001';
    const mockServer = new Server(url);

    const onJoin = vi.fn();
    const { result } = renderHook(() => usePresence({
      wsUrl: url,
      roomId: 'room1',
      identity: { id: 'user1', metadata: { name: 'Junaid' } },
      onJoin,
    }));

    await waitFor(() => expect(result.current.isConnected).toBe(true));

    act(() => {
      mockServer.emit('message', JSON.stringify({
        type: 'sync',
        users: [
          { id: 'user1', joinedAt: new Date().toISOString() },
          { id: 'user2', joinedAt: new Date().toISOString() },
        ],
      }));
    });

    expect(result.current.count).toBe(2);

    act(() => {
      mockServer.emit('message', JSON.stringify({
        type: 'join',
        user: { id: 'user3', joinedAt: new Date().toISOString() },
      }));
    });

    expect(result.current.count).toBe(3);
    expect(onJoin).toHaveBeenCalled();
    mockServer.stop();
  });

  it('removes users on leave message', async () => {
    const url = 'ws://localhost:6002';
    const mockServer = new Server(url);

    const onLeave = vi.fn();
    const { result } = renderHook(() => usePresence({
      wsUrl: url,
      roomId: 'room1',
      identity: { id: 'user1' },
      onLeave,
    }));

    await waitFor(() => expect(result.current.isConnected).toBe(true));

    act(() => {
      mockServer.emit('message', JSON.stringify({
        type: 'sync',
        users: [{ id: 'user1' }, { id: 'user2' }],
      }));
    });

    act(() => {
      mockServer.emit('message', JSON.stringify({
        type: 'leave',
        user: { id: 'user2' },
      }));
    });

    expect(result.current.count).toBe(1);
    expect(onLeave).toHaveBeenCalled();
    mockServer.stop();
  });
});
