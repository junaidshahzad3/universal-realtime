import { EventEmitter } from 'events';
import type { IncomingMessage } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { ServerOptions } from 'ws';
import { SessionStore } from './SessionStore.js';
import { PresenceRoom } from './PresenceRoom.js';
import type { PresenceUser } from '../types/index.js';

export interface RealtimeServerOptions {
  server?: any; // Existing http.Server instance
  port?: number; // Port to start standalone WebSocketServer
  validateAuth?: (token: string | null, queryParams: URLSearchParams, headers: any) => Promise<boolean> | boolean;
  heartbeatIntervalMs?: number; // Active ping frequency
  sessionTimeoutMs?: number; // Offline session buffer expiration
  enablePresence?: boolean;
  debug?: boolean;
}

export class RealtimeServer extends EventEmitter {
  private wss: WebSocketServer;
  private sessionStore: SessionStore;
  private presenceRooms = new Map<string, PresenceRoom>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  // Track socket properties like alive states, session identities, and room memberships
  private socketMetadata = new Map<
    WebSocket,
    {
      isAlive: boolean;
      sessionId: string | null;
      clientId: string | null;
      roomId: string | null;
      presenceUser: PresenceUser | null;
    }
  >();

  private log(message: string, ...args: any[]) {
    if (this.options.debug) {
      console.log(`[RealtimeServer][${new Date().toISOString()}] ${message}`, ...args);
    }
  }

  constructor(private options: RealtimeServerOptions = {}) {
    super();

    const wssOptions: ServerOptions = {
      backlog: 2000, // Staggers connection handshakes during concurrency spikes
    };
    if (options.server) {
      wssOptions.server = options.server;
    } else if (options.port) {
      wssOptions.port = options.port;
    } else {
      throw new Error('[RealtimeServer] Either an HTTP server or a port must be provided in server options.');
    }

    this.wss = new WebSocketServer(wssOptions);
    this.sessionStore = new SessionStore(options.sessionTimeoutMs || 60000);

    this.init();
  }

  /**
   * Initializes server events, starts heartbeat timers, and registers listeners.
   */
  private init(): void {
    this.wss.on('connection', async (socket: WebSocket, req: IncomingMessage) => {
      // 1. Setup default metadata
      this.socketMetadata.set(socket, {
        isAlive: true,
        sessionId: null,
        clientId: null,
        roomId: null,
        presenceUser: null,
      });

      // Handle raw TCP pong responses to keep state alive
      socket.on('pong', () => {
        const metadata = this.socketMetadata.get(socket);
        if (metadata) {
          metadata.isAlive = true;
        }
      });

      try {
        // 2. Extract configuration from connection query parameters
        const reqUrl = req.url || '/';
        const parsedUrl = new URL(reqUrl, 'http://localhost');
        const queryParams = parsedUrl.searchParams;

        const token = queryParams.get('access_token');
        const clientId = queryParams.get('clientId');
        const clientSessionId = queryParams.get('sessionId');
        const roomId = queryParams.get('roomId');

        // 3. Dynamic Handshake Authentication
        if (this.options.validateAuth) {
          const isValid = await this.options.validateAuth(token, queryParams, req.headers);
          if (!isValid) {
            this.log('Handshake dynamic authentication validation FAILED for token:', token);
            this.emit('auth:failed', socket, req);
            socket.close(4401, 'Unauthorized');
            this.socketMetadata.delete(socket);
            return;
          }
        }

        // 4. Set final active session metadata
        const sessionId = clientSessionId || `session_${Math.random().toString(36).substring(2)}`;
        this.log('Client connected. Handshake assigned SessionId:', sessionId, 'ClientId:', clientId, 'RoomId:', roomId);
        const meta = this.socketMetadata.get(socket);
        if (meta) {
          meta.sessionId = sessionId;
          meta.clientId = clientId;
          meta.roomId = roomId;
        }

        this.emit('connection', socket, sessionId, req);

        // 5. Offline Replay Buffer Flush
        if (sessionId && clientId) {
          const session = this.sessionStore.getOrCreateSession(sessionId, clientId);
          const bufferedMessages = this.sessionStore.flushBuffer(sessionId);
          if (bufferedMessages.length > 0) {
            this.log('Session offline buffer hit! Replaying messages directly to socket, count:', bufferedMessages.length);
            for (const msg of bufferedMessages) {
              socket.send(JSON.stringify(msg));
            }
            this.emit('session:flushed', sessionId, bufferedMessages.length);
          }
        }

        // 6. Setup client message router
        socket.on('message', (rawData) => {
          try {
            const dataStr = rawData.toString();
            const message = JSON.parse(dataStr);

            // Handle standard client messages and routing
            this.handleClientMessage(socket, message);
          } catch (err) {
            // Emits raw non-JSON messages as fallback
            this.emit('message:raw', socket, rawData);
          }
        });

        // 7. Cleanup on client disconnection
        socket.on('close', (code, reason) => {
          this.handleClientDisconnect(socket, code, reason);
        });

        socket.on('error', (err) => {
          this.emit('error', err, socket);
        });

      } catch (error: any) {
        this.emit('connection:error', error, socket);
        socket.close(1011, 'Internal connection handler error');
        this.socketMetadata.delete(socket);
      }
    });

    // 8. Start active ping-pong heartbeat loop
    this.startHeartbeatLoop();
  }

  /**
   * Routes standard protocol messages (like Presence joins and leaves).
   */
  private handleClientMessage(socket: WebSocket, message: any): void {
    const meta = this.socketMetadata.get(socket);
    this.log('Incoming client message frame:', message);

    if (this.options.enablePresence !== false && message && typeof message === 'object') {
      const type = message.type;
      
      if (type === 'join' && message.user) {
        const user = message.user as PresenceUser;
        // Room precedence: explicit roomId on the join frame, then the roomId
        // supplied as a connection query parameter, then the shared default room.
        const roomId =
          (typeof message.roomId === 'string' && message.roomId) || meta?.roomId || 'default';

        if (meta) {
          meta.presenceUser = user;
          // Persist the resolved room. handleClientDisconnect reads meta.roomId to
          // remove the user on leave, so without this a client that connected
          // without a roomId would stay in the room forever.
          meta.roomId = roomId;
        }

        let room = this.presenceRooms.get(roomId);
        if (!room) {
          room = new PresenceRoom(roomId);
          this.presenceRooms.set(roomId, room);
        }

        this.log('Client joining presence room:', roomId, 'User identity:', user);
        room.join(user, socket);
        this.emit('presence:join', roomId, user);
        return;
      }
    }

    // Emits general structured JSON message events to listeners
    this.emit('message', socket, message);
  }

  /**
   * Cleans up room memberships, stores offline message sessions, and emits close events.
   */
  private handleClientDisconnect(socket: WebSocket, code: number, reason: Buffer): void {
    const meta = this.socketMetadata.get(socket);
    this.socketMetadata.delete(socket);

    if (meta) {
      const { sessionId, clientId, roomId, presenceUser } = meta;
      this.log('Client socket disconnected. SessionId:', sessionId, 'RoomId:', roomId, 'CloseCode:', code);

      // Handle presence leave automatically
      if (this.options.enablePresence !== false && roomId) {
        const room = this.presenceRooms.get(roomId);
        if (room) {
          room.handleDisconnect(socket);
          if (presenceUser) {
            this.emit('presence:leave', roomId, presenceUser);
          }
          // Cleanup empty rooms to conserve resources
          if (room.size === 0) {
            room.clear();
            this.presenceRooms.delete(roomId);
          }
        }
      }

      // Store in SessionStore for offline buffer replay if it's an authenticated session
      if (sessionId && clientId) {
        this.sessionStore.touchSession(sessionId);
      }

      this.emit('disconnect', socket, sessionId, code, reason.toString());
    }
  }

  /**
   * Sends a message to a specific session ID, buffering it offline if the client is disconnected.
   */
  public sendToSession(sessionId: string, message: any): boolean {
    // Check if the session is currently connected online
    for (const [socket, meta] of this.socketMetadata.entries()) {
      if (meta.sessionId === sessionId && socket.readyState === WebSocket.OPEN) {
        this.log('Sending message to active online session:', sessionId);
        socket.send(JSON.stringify(message));
        return true;
      }
    }

    // Client is offline: buffer the message in SessionStore
    this.log('Session is currently offline. Buffering server message in SessionStore. SessionId:', sessionId);
    const session = this.sessionStore.getOrCreateSession(sessionId, '');
    if (session) {
      this.sessionStore.bufferMessage(sessionId, message);
      this.emit('session:buffered', sessionId, message);
      return false;
    }

    return false;
  }

  /**
   * Broadcasts a JSON message to all clients in a specific presence room.
   */
  public broadcastToRoom(roomId: string, message: any, excludeSocket?: WebSocket): void {
    const room = this.presenceRooms.get(roomId);
    if (room) {
      room.broadcast(message, excludeSocket);
    }
  }

  /**
   * Broadcasts a JSON message globally to all connected WebSocket clients.
   */
  public broadcastGlobal(message: any, excludeSocket?: WebSocket): void {
    const payload = JSON.stringify(message);
    for (const socket of this.socketMetadata.keys()) {
      if (excludeSocket && socket === excludeSocket) {
        continue;
      }
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(payload);
      }
    }
  }

  /**
   * Returns a list of active users in a specific presence room.
   */
  public getRoomUsers(roomId: string): PresenceUser[] {
    const room = this.presenceRooms.get(roomId);
    return room ? room.getUsers() : [];
  }

  /**
   * Starts active ping loop to detect and clean silent zombie clients.
   */
  private startHeartbeatLoop(): void {
    const interval = this.options.heartbeatIntervalMs || 30000;
    this.heartbeatTimer = setInterval(() => {
      this.log('Executing active heartbeat ping check...');
      for (const [socket, meta] of this.socketMetadata.entries()) {
        if (!meta.isAlive) {
          this.log('Active keep-alive timeout! Terminating inactive client socket. SessionId:', meta.sessionId);
          this.emit('heartbeat:timeout', socket, meta.sessionId);
          socket.terminate();
          continue;
        }

        meta.isAlive = false;
        if (socket.readyState === WebSocket.OPEN) {
          this.log('Sending WebSocket ping packet to client socket. SessionId:', meta.sessionId);
          socket.ping();
        }
      }
    }, interval);
  }

  /**
   * Gracefully shuts down the server, intervals, and active connections.
   */
  public close(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    this.sessionStore.destroy();

    for (const room of this.presenceRooms.values()) {
      room.clear();
    }
    this.presenceRooms.clear();

    // Terminate all active connections to prevent wss.close() from hanging
    for (const socket of this.socketMetadata.keys()) {
      socket.terminate();
    }
    this.socketMetadata.clear();

    return new Promise((resolve, reject) => {
      this.wss.close((err) => {
        if (err) return reject(err);
        this.emit('close');
        resolve();
      });
    });
  }
}
