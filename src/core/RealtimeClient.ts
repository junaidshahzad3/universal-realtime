import { ReconnectManager } from '../utils/reconnect.js';
import type { RealtimeClientOptions, HeartbeatOptions } from '../types/index.js';

export type ConnectionStatus = 'connecting' | 'open' | 'closing' | 'closed' | 'reconnecting';

/**
 * Robust class-based, framework-agnostic RealtimeClient.
 * Manages raw WebSocket lifecycle, heartbeat keep-alive pings, exponential backoff reconnects,
 * and high-performance Pub/Sub event emitters.
 */
export class RealtimeClient<TMessage = any> {
  private url: string | null;
  private options: RealtimeClientOptions<TMessage>;
  private ws: WebSocket | null = null;
  private reconnectManager: ReconnectManager | null = null;
  private pingInterval: any = null;
  private pongTimeout: any = null;
  
  private listeners: Set<(msg: TMessage) => void> = new Set();
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();
  
  private connectionStatus: ConnectionStatus = 'closed';
  private reconnectCount = 0;
  
  // NEW: Offline message buffer queue
  private offlineQueue: Array<TMessage | string> = [];

  constructor(url: string | null, options?: RealtimeClientOptions<TMessage>) {
    this.url = url;
    this.options = options || {};
    this.initialize();
  }

  private initialize() {
    if (typeof window === 'undefined' && !this.options.webSocketConstructor) {
      // Gracefully bypass in SSR environment if no constructor is provided
      return;
    }

    if (!this.url) {
      this.setStatus('closed');
      return;
    }

    this.reconnectManager = new ReconnectManager({
      maxAttempts: this.options.reconnectAttempts ?? 10,
      baseInterval: this.options.reconnectInterval ?? 1000,
      maxInterval: this.options.maxReconnectInterval ?? 30000,
      jitter: this.options.jitter !== false,
      onReconnect: (attempt) => {
        this.reconnectCount = attempt + 1;
        this.setStatus('reconnecting');
        this.connect();
      },
      onFailed: () => {
        this.setStatus('closed');
      },
    });

    this.connect();
  }

  public async connect() {
    if (this.ws) {
      this.disconnect();
    }

    if (!this.url) return;

    this.setStatus('connecting');
    
    let connectionUrl = this.url!;

    // Resolve dynamic auth callback/tokens if present
    if (this.options.auth) {
      try {
        const authData = await this.options.auth();
        const urlObj = new URL(connectionUrl);
        if (typeof authData === 'string') {
          urlObj.searchParams.set('token', authData);
        } else if (typeof authData === 'object' && authData !== null) {
          Object.entries(authData).forEach(([key, val]) => {
            urlObj.searchParams.set(key, String(val));
          });
        }
        connectionUrl = urlObj.toString();
      } catch (err) {
        console.error('[RealtimeClient] Failed to execute dynamic auth hook:', err);
      }
    }
    
    // Choose WebSocket constructor (custom or standard browser API)
    const WSConstructor = this.options.webSocketConstructor || (typeof WebSocket !== 'undefined' ? WebSocket : null);
    if (!WSConstructor) {
      throw new Error('WebSocket constructor is not available. Pass a custom constructor via options.webSocketConstructor if running in Node.js.');
    }

    const wsInstance = new WSConstructor(connectionUrl, this.options.protocols);
    this.ws = wsInstance;

    wsInstance.onopen = (event: Event) => {
      if (this.ws !== wsInstance) return;

      this.setStatus('open');
      this.reconnectCount = 0;
      this.reconnectManager?.stop();
      this.startHeartbeat();
      this.options.onOpen?.(event);
      
      // Auto-flush offline buffered queues
      this.flushOfflineQueue();
    };

    wsInstance.onmessage = (event: MessageEvent) => {
      if (this.ws !== wsInstance) return;

      this.resetHeartbeatTimeout();
      
      let parsedData: any;
      try {
        parsedData = JSON.parse(event.data);
      } catch (e) {
        parsedData = event.data;
      }

      if (this.options.filter && !this.options.filter(parsedData)) {
        return;
      }

      this.options.onMessage?.(parsedData);
      this.listeners.forEach((listener) => {
        try {
          listener(parsedData);
        } catch (err) {
          console.error('Error in RealtimeClient subscriber listener:', err);
        }
      });
    };

    wsInstance.onerror = (event: Event) => {
      if (this.ws !== wsInstance) return;
      this.options.onError?.(event);
    };

    wsInstance.onclose = (event: CloseEvent) => {
      if (this.ws !== wsInstance) return;

      this.stopHeartbeat();
      this.setStatus('closed');
      this.options.onClose?.(event);

      if (this.options.reconnect !== false && this.url) {
        this.setStatus('reconnecting');
        this.reconnectManager?.start();
      }
    };
  }

  public disconnect() {
    this.stopHeartbeat();
    this.reconnectManager?.stop();

    if (this.ws) {
      const activeWs = this.ws;
      this.ws = null;
      try {
        activeWs.close();
      } catch (err) {
        // Safe drop if already closing
      }
    }

    this.setStatus('closed');
  }

  public sendMessage(data: TMessage | string) {
    const readyStateOpen = typeof WebSocket !== 'undefined' ? WebSocket.OPEN : 1;
    if (this.ws?.readyState === readyStateOpen) {
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      this.ws.send(payload);
    } else if (this.options.bufferOfflineMessages !== false) {
      console.log('[RealtimeClient] Queueing message because connection is offline.');
      this.offlineQueue.push(data);
    }
  }

  private flushOfflineQueue() {
    if (this.offlineQueue.length === 0) return;
    console.log(`[RealtimeClient] Flushing ${this.offlineQueue.length} offline buffered messages.`);
    while (this.offlineQueue.length > 0) {
      const msg = this.offlineQueue.shift();
      if (msg !== undefined) {
        this.sendMessage(msg);
      }
    }
  }

  /**
   * Returns the raw underlying WebSocket client instance, cast to target type T.
   */
  public unwrap<T = WebSocket>(): T | null {
    return this.ws as unknown as T;
  }

  public subscribe(listener: (msg: TMessage) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public subscribeStatus(listener: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.connectionStatus);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  public getUrl(): string | null {
    return this.url;
  }

  public getStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  public getReconnectCount(): number {
    return this.reconnectCount;
  }

  public getWebSocket(): WebSocket | null {
    return this.ws;
  }

  private setStatus(newStatus: ConnectionStatus) {
    if (this.connectionStatus !== newStatus) {
      this.connectionStatus = newStatus;
      this.statusListeners.forEach((listener) => {
        try {
          listener(newStatus);
        } catch (err) {
          console.error('Error in RealtimeClient status listener:', err);
        }
      });
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();

    const hb = this.options.heartbeat;
    if (!hb) return;

    const config = typeof hb === 'object' ? hb : {};
    const interval = config.interval ?? 30000;
    const timeout = config.timeout ?? 5000;
    const message = config.message ?? 'ping';

    this.pingInterval = setInterval(() => {
      const readyStateOpen = typeof WebSocket !== 'undefined' ? WebSocket.OPEN : 1;
      if (this.ws?.readyState === readyStateOpen) {
        const pingPayload = typeof message === 'string' ? message : JSON.stringify(message);
        this.ws.send(pingPayload);

        if (this.pongTimeout) clearTimeout(this.pongTimeout);

        this.pongTimeout = setTimeout(() => {
          if (this.ws) {
            this.ws.close(4000, 'Heartbeat timeout');
          }
        }, timeout);
      }
    }, interval);
  }

  private stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  private resetHeartbeatTimeout() {
    const hb = this.options.heartbeat;
    if (!hb) return;

    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }
}
