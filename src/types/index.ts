import type { ReactNode } from 'react';

export interface HeartbeatOptions {
  interval?: number; // default: 30000ms
  timeout?: number;  // default: 5000ms
  message?: string | object; // default: 'ping'
}

export interface UseWebSocketOptions<TMessage> {
  onMessage?: (message: TMessage) => void;
  onOpen?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  reconnect?: boolean;          // default: true
  reconnectAttempts?: number;   // default: 10
  reconnectInterval?: number;   // default: 1000ms (doubles each attempt)
  maxReconnectInterval?: number;// default: 30000ms
  protocols?: string | string[];
  /** Called before each message is set — use for filtering or transformation */
  filter?: (message: TMessage) => boolean;
  /** Keep-alive heartbeat options or true/false to enable default heartbeat */
  heartbeat?: HeartbeatOptions | boolean;
  /** Custom WebSocket constructor, useful for Node.js environments (e.g. ws package) */
  webSocketConstructor?: any;
}

export interface RealtimeClientOptions<TMessage = any> extends UseWebSocketOptions<TMessage> {}


export interface RealtimeContextType<TMessage = any> {
  sendMessage: (data: TMessage | string) => void;
  connectionStatus: 'connecting' | 'open' | 'closing' | 'closed' | 'reconnecting';
  subscribe: (listener: (msg: TMessage) => void) => () => void;
}

export interface RealtimeProviderProps<TMessage = any> {
  url: string | null;
  options?: UseWebSocketOptions<TMessage>;
  children: ReactNode;
}


export interface UseWebSocketReturn<TMessage> {
  lastMessage: TMessage | null;
  sendMessage: (data: TMessage | string) => void;
  connectionStatus: 'connecting' | 'open' | 'closing' | 'closed' | 'reconnecting';
  reconnectCount: number;
}

export interface UseSSEOptions<TData> {
  onMessage?: (data: TData) => void;
  onError?: (error: Event) => void;
  withCredentials?: boolean;
  headers?: Record<string, string>; // added via EventSource polyfill
  reconnect?: boolean;
  eventName?: string;               // default: 'message'
}

export interface UseSSEReturn<TData> {
  data: TData | null;
  connectionStatus: 'connecting' | 'open' | 'closed' | 'reconnecting';
  error: Event | null;
}

export interface PresenceUser {
  id: string;
  metadata?: Record<string, unknown>;
  joinedAt: Date;
}

export interface UsePresenceOptions {
  wsUrl: string | null;
  roomId: string;
  identity: { id: string; metadata?: Record<string, unknown> };
  onJoin?: (user: PresenceUser) => void;
  onLeave?: (user: PresenceUser) => void;
}

export interface UsePresenceReturn {
  users: PresenceUser[];
  count: number;
  isConnected: boolean;
}

export interface UseOptimisticUpdateOptions<TData> {
  onSuccess?: (data: TData) => void;
  onError?: (error: unknown, rollback: () => void) => void;
}

export interface UseOptimisticUpdateReturn<TData> {
  data: TData;
  isPending: boolean;
  update: (optimisticValue: TData, mutateFn: () => Promise<TData>) => Promise<void>;
}

export type ConnectionStatus = 'online' | 'offline' | 'unknown';

export interface UseConnectionStatusReturn {
  status: ConnectionStatus;
  isOnline: boolean;
  isOffline: boolean;
  since: Date | null;
}
