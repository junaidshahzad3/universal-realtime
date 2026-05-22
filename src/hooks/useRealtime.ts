import { useContext, useEffect, useState, useRef } from 'react';
import { RealtimeContext } from './RealtimeProvider.js';

/**
 * Custom consumer hook to access the shared app-wide real-time WebSocket connection.
 * Dynamically subscribes to incoming messages with highly optimized selective rendering.
 * 
 * @param filter - Optional callback to filter incoming messages. Component only re-renders if filter returns true.
 * @returns Object containing lastMessage, sendMessage, and connectionStatus.
 */
export function useRealtime<TMessage = any>(
  filter?: (msg: TMessage) => boolean,
): {
  lastMessage: TMessage | null;
  sendMessage: (data: any) => void;
  connectionStatus: 'connecting' | 'open' | 'closing' | 'closed' | 'reconnecting';
} {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }

  const [lastMessage, setLastMessage] = useState<TMessage | null>(null);

  // Store the filter in a ref so the listener always uses the latest filter without resubscribing
  const filterRef = useRef(filter);
  useEffect(() => {
    filterRef.current = filter;
  });

  useEffect(() => {
    const unsubscribe = context.subscribe((msg: TMessage) => {
      if (filterRef.current && !filterRef.current(msg)) {
        return;
      }
      setLastMessage(msg);
    });

    return unsubscribe;
  }, [context]);

  return {
    lastMessage,
    sendMessage: context.sendMessage,
    connectionStatus: context.connectionStatus,
  };
}
