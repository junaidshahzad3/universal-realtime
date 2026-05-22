import { useState, useEffect } from 'react';

export type ConnectionStatus = 'online' | 'offline' | 'unknown';

export interface UseConnectionStatusReturn {
  status: ConnectionStatus;
  isOnline: boolean;
  isOffline: boolean;
  since: Date | null;
}

/**
 * Tracks the browser's online/offline status using window events.
 * 
 * @returns {UseConnectionStatusReturn} Object containing the current status and the time it last changed.
 */
export function useConnectionStatus(): UseConnectionStatusReturn {
  const [status, setStatus] = useState<ConnectionStatus>(() => {
    if (typeof window === 'undefined') return 'unknown';
    return navigator.onLine ? 'online' : 'offline';
  });

  const [since, setSince] = useState<Date | null>(() => {
    if (typeof window === 'undefined') return null;
    return new Date();
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setStatus('online');
      setSince(new Date());
    };

    const handleOffline = () => {
      setStatus('offline');
      setSince(new Date());
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    status,
    isOnline: status === 'online',
    isOffline: status === 'offline',
    since,
  };
}
