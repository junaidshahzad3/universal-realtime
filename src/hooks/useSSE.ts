import { useState, useEffect, useRef, useCallback } from 'react';
import type { UseSSEOptions, UseSSEReturn } from '../types/index.js';

/**
 * Server-Sent Events (SSE) hook with auto-reconnect.
 * 
 * @param url - The SSE endpoint (null to disable connection).
 * @param options - Configuration options for the connection.
 * @returns {UseSSEReturn} Connection state and last received data.
 */
export function useSSE<TData = unknown>(
  url: string | null,
  options?: UseSSEOptions<TData>,
): UseSSEReturn<TData> {
  const [data, setData] = useState<TData | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<UseSSEReturn<TData>['connectionStatus']>(
    url ? 'connecting' : 'closed'
  );
  const [error, setError] = useState<Event | null>(null);
  const esRef = useRef<EventSource | null>(null);

  // Store options in a ref to avoid infinite re-connection loops
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const connect = useCallback(() => {
    if (typeof window === 'undefined' || !url) return;

    // cleanup previous
    if (esRef.current) {
      esRef.current.close();
    }

    setConnectionStatus('connecting');

    // Note: native EventSource doesn't support headers.
    // This hook passes them to the constructor which may be handled by a polyfill.
    const es = new (window as any).EventSource(url, {
      withCredentials: optionsRef.current?.withCredentials,
      headers: optionsRef.current?.headers,
    });
    esRef.current = es;

    es.onopen = () => {
      setConnectionStatus('open');
      setError(null);
    };

    const eventName = optionsRef.current?.eventName ?? 'message';
    es.addEventListener(eventName, (event: MessageEvent) => {
      try {
        const parsed = JSON.parse(event.data) as TData;
        setData(parsed);
        optionsRef.current?.onMessage?.(parsed);
      } catch (e) {
        const raw = event.data as unknown as TData;
        setData(raw);
        optionsRef.current?.onMessage?.(raw);
      }
    });

    es.onerror = (event: Event) => {
      setError(event);
      optionsRef.current?.onError?.(event);
      
      if (es.readyState === (window as any).EventSource.CLOSED) {
        setConnectionStatus('closed');
        if (optionsRef.current?.reconnect !== false) {
          setConnectionStatus('reconnecting');
        }
      }
    };
  }, [url]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!url) {
      setConnectionStatus('closed');
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      return;
    }

    connect();

    return () => {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [url, connect]);

  return {
    data,
    connectionStatus,
    error,
  };
}
