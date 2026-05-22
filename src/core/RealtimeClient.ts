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

  public connect() {
    if (this.ws) {
      this.disconnect();
    }

    if (!this.url) return;

    this.setStatus('connecting');
    
    // Choose WebSocket constructor (custom or standard browser API)
    const WSConstructor = this.options.webSocketConstructor || (typeof WebSocket !== 'undefined' ? WebSocket : null);
    if (!WSConstructor) {
      throw new Error('WebSocket constructor is not available. Pass a custom constructor via options.webSocketConstructor if running in Node.js.');
    }

    const wsInstance = new WSConstructor(this.url, this.options.protocols);
    this.ws = wsInstance;

    wsInstance.onopen = (event: Event) => {
      if (this.ws !== wsInstance) return;

      this.setStatus('open');
      this.reconnectCount = 0;
      this.reconnectManager?.stop();
      this.startHeartbeat();
      this.options.onOpen?.(event);
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
    }
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
