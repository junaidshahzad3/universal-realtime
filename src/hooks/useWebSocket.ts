import { useState, useEffect, useRef, useCallback } from 'react';
import { ReconnectManager } from '../utils/reconnect.js';
import type { UseWebSocketOptions, UseWebSocketReturn } from '../types/index.js';

/**
 * WebSocket hook with auto-reconnect and exponential backoff.
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
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectManagerRef = useRef<ReconnectManager | null>(null);

  // Store options in a ref to prevent infinite re-connection loops
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const connect = useCallback(() => {
    if (typeof window === 'undefined' || !url) return;

    setConnectionStatus('connecting');
    const ws = new WebSocket(url, optionsRef.current?.protocols);
    wsRef.current = ws;

    ws.onopen = (event) => {
      setConnectionStatus('open');
      setReconnectCount(0);
      reconnectManagerRef.current?.stop();
      optionsRef.current?.onOpen?.(event);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as TMessage;
        if (optionsRef.current?.filter && !optionsRef.current.filter(data)) {
          return;
        }
        setLastMessage(data);
        optionsRef.current?.onMessage?.(data);
      } catch (e) {
        const data = event.data as unknown as TMessage;
        setLastMessage(data);
        optionsRef.current?.onMessage?.(data);
      }
    };

    ws.onerror = (event) => {
      optionsRef.current?.onError?.(event);
    };

    ws.onclose = (event) => {
      // Avoid state updates if component is unmounted or url changed
      if (wsRef.current !== ws) return;

      setConnectionStatus('closed');
      optionsRef.current?.onClose?.(event);

      if (optionsRef.current?.reconnect !== false && url) {
        setConnectionStatus('reconnecting');
        reconnectManagerRef.current?.start();
      }
    };
  }, [url]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!url) {
      setConnectionStatus('closed');
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    reconnectManagerRef.current = new ReconnectManager({
      maxAttempts: options?.reconnectAttempts ?? 10,
      baseInterval: options?.reconnectInterval ?? 1000,
      maxInterval: options?.maxReconnectInterval ?? 30000,
      onReconnect: (attempt) => {
        setReconnectCount(attempt + 1);
        connect();
      },
      onFailed: () => {
        setConnectionStatus('closed');
      },
    });

    connect();

    return () => {
      reconnectManagerRef.current?.stop();
      if (wsRef.current) {
        // Prevent onclose from triggering reconnect during unmount
        const ws = wsRef.current;
        wsRef.current = null;
        ws.close();
      }
    };
  }, [url, connect, options?.reconnectAttempts, options?.reconnectInterval, options?.maxReconnectInterval]);

  const sendMessage = useCallback((data: TMessage | string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      wsRef.current.send(message);
    }
  }, []);

  return {
    lastMessage,
    sendMessage,
    connectionStatus,
    reconnectCount,
  };
}
