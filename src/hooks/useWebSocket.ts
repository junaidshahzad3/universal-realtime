import { useState, useEffect, useRef, useCallback } from 'react';
import { RealtimeClient } from '../core/RealtimeClient.js';
import type { UseWebSocketOptions, UseWebSocketReturn } from '../types/index.js';

/**
 * WebSocket hook with auto-reconnect and exponential backoff.
 * Delegates 100% of socket connection, heartbeat, and reconnection logic
 * to the framework-agnostic RealtimeClient class.
 * 
 * @param url - The WebSocket URL (null to disable connection).
 * @param options - Configuration options for the connection.
 * @returns {UseWebSocketReturn} Connection state and control functions.
 */
export function useWebSocket<TMessage = unknown>(
  url: string | null,
  options?: UseWebSocketOptions<TMessage>,
): UseWebSocketReturn<TMessage> {
  const [lastMessage, setLastMessage] = useState<TMessage | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<UseWebSocketReturn<TMessage>['connectionStatus']>(
    url ? 'connecting' : 'closed'
  );
  const [reconnectCount, setReconnectCount] = useState(0);

  const clientRef = useRef<RealtimeClient<TMessage> | null>(null);
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!url) {
      setConnectionStatus('closed');
      setReconnectCount(0);
      return;
    }

    const client = new RealtimeClient<TMessage>(url, {
      ...options,
      onOpen: (event) => {
        optionsRef.current?.onOpen?.(event);
      },
      onClose: (event) => {
        optionsRef.current?.onClose?.(event);
      },
      onError: (event) => {
        optionsRef.current?.onError?.(event);
      },
      onMessage: (message) => {
        optionsRef.current?.onMessage?.(message);
      },
    });

    clientRef.current = client;

    const unsubscribeMessage = client.subscribe((msg) => {
      setLastMessage(msg);
    });

    const unsubscribeStatus = client.subscribeStatus((status) => {
      setConnectionStatus(status);
      setReconnectCount(client.getReconnectCount());
    });

    return () => {
      client.disconnect();
      clientRef.current = null;
      unsubscribeMessage();
      unsubscribeStatus();
    };
  }, [url]);

  const sendMessage = useCallback((data: TMessage | string) => {
    clientRef.current?.sendMessage(data);
  }, []);

  return {
    lastMessage,
    sendMessage,
    connectionStatus,
    reconnectCount,
  };
}
