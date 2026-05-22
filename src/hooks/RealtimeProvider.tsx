import React, { createContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { RealtimeClient } from '../core/RealtimeClient.js';
import type { RealtimeContextType, RealtimeProviderProps } from '../types/index.js';

export const RealtimeContext = createContext<RealtimeContextType | null>(null);

/**
 * High-performance central Provider for managing a shared single WebSocket connection.
 * Multiplexes communication to prevent multiple connections and avoids React Context re-render cascades.
 */
export function RealtimeProvider({ url, options, children }: RealtimeProviderProps) {
  const [connectionStatus, setConnectionStatus] = useState<RealtimeContextType['connectionStatus']>(
    url ? 'connecting' : 'closed'
  );
  
  const clientRef = useRef<RealtimeClient | null>(null);
  const listenersRef = useRef<Set<(msg: any) => void>>(new Set());

  // Store options in a ref to prevent stale closures and infinite reconnect loops
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!url) {
      setConnectionStatus('closed');
      return;
    }

    const client = new RealtimeClient(url, {
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
      listenersRef.current.forEach((listener) => {
        try {
          listener(msg);
        } catch (err) {
          console.error('Error in RealtimeProvider subscriber listener:', err);
        }
      });
    });

    const unsubscribeStatus = client.subscribeStatus((status) => {
      setConnectionStatus(status);
    });

    return () => {
      client.disconnect();
      clientRef.current = null;
      unsubscribeMessage();
      unsubscribeStatus();
    };
  }, [url]);

  const sendMessage = useCallback((data: any) => {
    clientRef.current?.sendMessage(data);
  }, []);

  const subscribe = useCallback((listener: (msg: any) => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const value = useMemo<RealtimeContextType>(() => ({
    sendMessage,
    connectionStatus,
    subscribe,
  }), [sendMessage, connectionStatus, subscribe]);

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}
