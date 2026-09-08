import { useState, useEffect } from 'react';
import { useWebSocket } from './useWebSocket.js';
import type { UsePresenceOptions, UsePresenceReturn, PresenceUser } from '../types/index.js';

/**
 * Hook for managing user presence in a room, built on top of useWebSocket.
 * 
 * @param options - Configuration for WebSocket URL, room ID, and user identity.
 * @returns {UsePresenceReturn} Current users, count, and connection state.
 */
export function usePresence(options: UsePresenceOptions): UsePresenceReturn {
  const [users, setUsers] = useState<PresenceUser[]>([]);

  const { lastMessage, sendMessage, connectionStatus } = useWebSocket<{
    type: 'join' | 'leave' | 'sync';
    roomId?: string;
    user?: PresenceUser;
    users?: PresenceUser[];
  }>(options.wsUrl, {
    onOpen: () => {
      // Send join message with room info. roomId must travel on the frame:
      // the server scopes presence by it and uses it again to remove the user
      // on disconnect.
      sendMessage({
        type: 'join',
        roomId: options.roomId,
        user: {
          ...options.identity,
          joinedAt: new Date(),
        },
      });
    },
  });

  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'sync':
        if (lastMessage.users) {
          setUsers(lastMessage.users);
        }
        break;
      case 'join':
        if (lastMessage.user) {
          setUsers((prev) => {
            if (prev.some((u) => u.id === lastMessage.user!.id)) return prev;
            return [...prev, lastMessage.user!];
          });
          options.onJoin?.(lastMessage.user);
        }
        break;
      case 'leave':
        if (lastMessage.user) {
          setUsers((prev) => prev.filter((u) => u.id !== lastMessage.user!.id));
          options.onLeave?.(lastMessage.user);
        }
        break;
    }
  }, [lastMessage, options.onJoin, options.onLeave]);

  return {
    users,
    count: users.length,
    isConnected: connectionStatus === 'open',
  };
}
