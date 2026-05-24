# Isomorphic Real-Time Blueprint Guide: universal-realtime

This guide provides a comprehensive, production-ready blueprint for engineering highly resilient, full-stack real-time applications using the isomorphic `universal-realtime` framework. We will build a secure, full-stack real-time messaging and presence platform featuring:
* Secure, dynamic authentication upgrade handshakes.
* Multi-room presence tracking.
* Resilient offline caching with automatic connection recovery.
* Live diagnostic loggers.

---

## 1. Backend Server Architecture

On the server side, we instantiate `RealtimeServer` from `universal-realtime/server` (which runs high-performance wrapper logic over the Node.js `ws` package). We can hook it into an existing HTTP/S server or start it on a standalone port.

### `server.ts`
```typescript
import http from 'http';
import { RealtimeServer } from 'universal-realtime/server';

const PORT = 5001;
const httpServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('AetherCoder Real-Time API Node Server\n');
});

// Initialize framework-agnostic RealtimeServer
const server = new RealtimeServer({
  server: httpServer,
  enablePresence: true,
  debug: true, // Enables structured diagnostics logging
  heartbeatIntervalMs: 30000, // Active ping loop interval
  sessionTimeoutMs: 60000,    // Slider-expiration offline message cache

  // 1. Dynamic Handshake Upgrades Authorization
  validateAuth: async (token, queryParams, headers) => {
    if (!token) return false;
    
    try {
      // Validate secure session token (e.g. JWT or database lookup)
      const user = await verifyDatabaseSessionToken(token);
      return !!user;
    } catch {
      return false;
    }
  }
});

// 2. Client connection & event streams listeners
server.on('connection', (socket, sessionId, req) => {
  console.log(`[Socket] Authorized connection. Session: ${sessionId}`);
});

server.on('message', (socket, message) => {
  console.log(`[Socket] Received message frame:`, message);
});

server.on('disconnect', (socket, sessionId, code, reason) => {
  console.log(`[Socket] Disconnected. Session: ${sessionId} | Code: ${code}`);
});

// Launch server
httpServer.listen(PORT, () => {
  console.log(`Server successfully listening on http://localhost:${PORT}`);
});
```

---

## 2. Frontend Client Setup

On the client side, multiplex all connection events over **exactly one WebSocket connection** utilizing the selective rendering hooks to prevent global React Context render cascades.

### `App.tsx`
```tsx
import React from 'react';
import { RealtimeProvider } from 'universal-realtime';
import { ChatRoom } from './ChatRoom';

export default function App() {
  const fetchToken = async (): Promise<string> => {
    const res = await fetch('/api/auth/token');
    const { token } = await res.json();
    return token;
  };

  return (
    <RealtimeProvider
      url="ws://localhost:5001"
      options={{
        debug: true, // Output debug telemetry in browser console
        reconnect: true,
        reconnectAttempts: 10,
        jitter: true, // Staggers reconnections to prevent server storms
        bufferOfflineMessages: true, // Buffer unsent messages in memory
        
        // Dynamic dynamic auth callback
        auth: async () => {
          const token = await fetchToken();
          return {
            access_token: token,
            clientId: 'client-react-user',
            roomId: 'lobby-room-1',
          };
        }
      }}
    >
      <ChatRoom />
    </RealtimeProvider>
  );
}
```

---

## 3. Real-Time Chat & Presence Hooks

With the provider active, leverage hooks to track online participants in real-time rooms and execute mutations.

### `ChatRoom.tsx`
```tsx
import React, { useState } from 'react';
import { useRealtime, usePresence } from 'universal-realtime';

export function ChatRoom() {
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<any[]>([]);

  // 1. Live Presence tracking
  const { users, count, isConnected } = usePresence({
    wsUrl: 'ws://localhost:5001',
    roomId: 'lobby-room-1',
    identity: { id: 'user-react-1', metadata: { name: 'Junaid Shahzad' } }
  });

  // 2. High-Performance selective rendering messages hook
  const { sendMessage } = useRealtime<any>(
    (msg) => msg.type === 'chat_message', // Render filter
    (msg) => {
      setMessages((prev) => [...prev, msg]);
    }
  );

  const handleSend = () => {
    if (!inputText) return;
    
    sendMessage({
      type: 'chat_message',
      text: inputText,
      sender: 'Junaid Shahzad',
      timestamp: Date.now()
    });
    
    setInputText('');
  };

  return (
    <div className="chat-container">
      <header>
        <h3>Lobby Room 1</h3>
        <span>Status: {isConnected ? 'Online' : 'Offline'} | Active Users: {count}</span>
      </header>

      <div className="users-list">
        {users.map((u) => (
          <span key={u.id} className="user-badge">{u.metadata?.name || u.id}</span>
        ))}
      </div>

      <div className="messages-list">
        {messages.map((m, i) => (
          <div key={i} className="message">
            <strong>{m.sender}:</strong> {m.text}
          </div>
        ))}
      </div>

      <div className="input-bar">
        <input value={inputText} onChange={(e) => setInputText(e.target.value)} />
        <button onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}
```

---

## 4. Observability & Debugging

When `debug: true` is configured in the options of the client or server, it prints standardized telemetry to tracing dashboards or local console output:

### Client Console Telemetry
```text
[RealtimeClient][2026-05-24T12:00:00.123Z] Connecting client to URL: ws://localhost:5001/?access_token=jwt_xxx&clientId=client-react-user...
[RealtimeClient][2026-05-24T12:00:00.345Z] Connection successfully established.
[RealtimeClient][2026-05-24T12:00:00.347Z] Flushing 2 offline buffered messages.
[RealtimeClient][2026-05-24T12:00:00.350Z] Sending structured payload: {"type":"chat_message", ...}
```

### Server Process Telemetry
```text
[RealtimeServer][2026-05-24T12:00:00.120Z] Client connected. Handshake assigned SessionId: session_8cda91 ClientId: client-react-user RoomId: lobby-room-1
[RealtimeServer][2026-05-24T12:00:00.125Z] Session offline buffer hit! Replaying messages directly to socket, count: 2
[RealtimeServer][2026-05-24T12:00:00.348Z] Client joining presence room: lobby-room-1 User identity: {"id":"user-react-1","metadata":{"name":"Junaid Shahzad"}}
[RealtimeServer][2026-05-24T12:00:30.000Z] Executing active heartbeat ping check...
[RealtimeServer][2026-05-24T12:00:30.005Z] Sending WebSocket ping packet to client socket. SessionId: session_8cda91
```
