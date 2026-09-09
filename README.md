# universal-realtime

[![npm](https://img.shields.io/npm/v/universal-realtime?color=%23c2410c)](https://www.npmjs.com/package/universal-realtime)
[![bundle](https://img.shields.io/badge/core-~5%20KB%20min-informational)](https://www.npmjs.com/package/universal-realtime)
[![dependencies](https://img.shields.io/badge/runtime%20deps-0-success)](https://www.npmjs.com/package/universal-realtime)
[![tests](https://img.shields.io/badge/tests-77%20passing-success)](#testing)
[![license](https://img.shields.io/npm/l/universal-realtime)](LICENSE)

A lightweight, zero-dependency real-time engine for JavaScript, TypeScript, Node.js and React.

Connections drop — on trains, in lifts, when a load balancer recycles. `universal-realtime`
handles the recovery so your app doesn't have to: auto-reconnection with jittered
exponential backoff, traffic-aware heartbeats, an offline send queue, presence rooms,
Server-Sent Events, and optimistic UI updates.

### ▶︎ [Try it in your browser — no install](https://universal-realtime.vercel.app)

Cut the connection and watch the backoff grow, messages queue while offline and flush on
reconnect, and presence rooms empty themselves. Four steps, each with the code beside a
live demo.

---

## Installation

```bash
npm install universal-realtime
```

React is only needed if you use the hooks — see the entry points below.

## Entry points

| Import from | Contains | Needs React |
|---|---|---|
| `universal-realtime/client` | `RealtimeClient`, `ReconnectManager`, `getDelay` | **No** |
| `universal-realtime` | everything above **plus** the React hooks | Yes |
| `universal-realtime/server` | `RealtimeServer`, `PresenceRoom`, `SessionStore` (Node, needs `ws`) | No |

Use `/client` in vanilla JS/TS, Node, Angular, Vue or Svelte. The root entry imports React
for the hooks, so importing it without React installed will fail.

## Key Features

* **Framework-Agnostic Core** — `RealtimeClient` runs in vanilla JS/TS, Node.js (via a custom WebSocket constructor), Angular, Vue, Svelte, or SSR environments (Next.js/Remix safe).
* **Auto-Reconnection** — exponential backoff with ±25% jitter, clamped to your `maxInterval`, so a recovering server isn't stampeded by every client at once.
* **Offline Send Queue** — messages sent while the socket is down are held in order and flushed on reconnect.
* **Traffic-Aware Heartbeats** — a keep-alive only pings after a quiet interval; any inbound frame resets the timer, so a busy connection never spends bandwidth proving it is alive.
* **Multiplexed React Hooks** — `RealtimeProvider` and `useRealtime` share a single connection across many components without Context render cascades.
* **Presence Rooms** — join a room, and leaving is automatic on disconnect.
* **Zero runtime dependencies** — core client ≈5 KB minified; the React hooks add roughly the same again.

---

## Framework-Agnostic Engine (`RealtimeClient`)

Perfect for pure JS/TS scripts, backend Node.js, or any non-React frameworks.

Import from the `/client` subpath. It contains only the core engine and never
imports React, so it works in projects that don't have React installed:

```typescript
import { RealtimeClient } from 'universal-realtime/client';

// Instantiates client (gracefully safe in SSR)
const client = new RealtimeClient('ws://api.example.com', {
  reconnect: true,
  reconnectAttempts: 5,
  heartbeat: {
    interval: 30000,
    timeout: 5000,
    message: 'ping'
  }
});

// Subscribe to connection status changes
const unsubscribeStatus = client.subscribeStatus((status) => {
  console.log('Connection status is:', status); // 'connecting' | 'open' | 'closing' | 'closed' | 'reconnecting'
});

// Subscribe to incoming messages
const unsubscribeMessages = client.subscribe((message) => {
  console.log('Received:', message);
});

// Send a message
client.sendMessage({ type: 'greet', body: 'hello' });

// Cleanup
unsubscribeStatus();
unsubscribeMessages();
client.disconnect();
```

### Node.js Support
In backend Node.js environments (where native `WebSocket` might not be globally available), pass a custom WebSocket constructor (e.g. from the `ws` package):

```typescript
import { RealtimeClient } from 'universal-realtime/client';
import WebSocket from 'ws'; // node WebSocket library

const client = new RealtimeClient('ws://api.example.com', {
  webSocketConstructor: WebSocket,
});
```

### Advanced Core Features

#### 1. Dynamic Authentication Handshake
You can supply an asynchronous `auth` parameter to dynamically resolve authentication credentials or tokens before opening a connection. The returned key-value pairs are automatically appended as connection query parameters:

```typescript
const client = new RealtimeClient('ws://api.example.com', {
  auth: async () => {
    const token = await fetchSecureToken();
    return { token, clientVersion: '1.3.0' };
  }
});
```

#### 2. Automatic Offline Event Queuing
If the client is offline or re-establishing a connection, any message sent via `sendMessage()` is automatically cached in an internal FIFO queue and flushed in order the moment a connection is established.

#### 3. Reconnection Jitter
Avoid "thundering herd" server bottlenecks. Toggle randomized ±25% reconnection jitter to stagger client reconnection attempts:

```typescript
const client = new RealtimeClient('ws://api.example.com', {
  reconnect: true,
  reconnectJitter: true, // staggered reconnection delays
});
```

#### 4. Raw Connection Passthrough (`unwrap`)
Access the raw, typed underlying WebSocket instance safe and casted:

```typescript
const rawSocket = client.unwrap<WebSocket>();
```

---

## React Hooks API (Thin Wrappers)

### 1. Central Connection Provider (`RealtimeProvider` + `useRealtime`)
Multiplexes all real-time events over **exactly 1 WebSocket connection** to reduce client resource load and prevent global React Context render cascades.

```tsx
import React from 'react';
import { RealtimeProvider, useRealtime } from 'universal-realtime';

function App() {
  return (
    <RealtimeProvider url="ws://api.example.com">
      <MessageList />
    </RealtimeProvider>
  );
}

function MessageList() {
  // Selective rendering: only re-renders when filters match!
  const { lastMessage, sendMessage, connectionStatus } = useRealtime<string>(
    (msg) => msg.startsWith('important:')
  );

  return (
    <div>
      <p>Connection: {connectionStatus}</p>
      <p>Last Important Message: {lastMessage}</p>
      <button onClick={() => sendMessage('Hello!')}>Send</button>
    </div>
  );
}
```

### 2. Standalone Hook (`useWebSocket`)
For simple, component-isolated WebSocket connections.

```tsx
import { useWebSocket } from 'universal-realtime';

function MyComponent() {
  const { lastMessage, sendMessage, connectionStatus } = useWebSocket('ws://api.example.com');
  
  return <div>Status: {connectionStatus}</div>;
}
```

### 3. Server-Sent Events (`useSSE`)
Robust stream consumer with built-in auto-reconnection.

```tsx
import { useSSE } from 'universal-realtime';

function EventStream() {
  const { data, connectionStatus } = useSSE('https://api.example.com/stream');
  
  return <div>Data: {data} | Connection: {connectionStatus}</div>;
}
```

### 4. Room Presence (`usePresence`)
Track "who's online" in real-time rooms.

```tsx
import { usePresence } from 'universal-realtime';

function ChatRoom() {
  const { users, count } = usePresence({
    wsUrl: 'ws://api.example.com/presence',
    roomId: 'lobby',
    identity: { id: 'user-1', metadata: { name: 'Junaid' } }
  });

  return <div>Active Users ({count}): {users.map(u => u.metadata.name).join(', ')}</div>;
}
```

### 5. Optimistic UI Updates (`useOptimisticUpdate`)
Instantly update the user interface and seamlessly roll back state if the network mutation fails.

```tsx
import { useOptimisticUpdate } from 'universal-realtime';

function TodoList({ initialTodos }) {
  const { data: todos, update, isPending } = useOptimisticUpdate(initialTodos);

  const addTodo = (newTodo) => {
    update([...todos, newTodo], async () => {
      // Async server call
      return await api.saveTodo(newTodo);
    });
  };

  return <button onClick={() => addTodo({ text: 'Buy milk' })}>Add Todo</button>;
}
```

---

## Testing

```bash
npm test              # 77 tests
npm run test:coverage # ~96% statements
npm run lint          # tsc --noEmit
```

Coverage includes the behaviours that are hard to get right and easy to regress:
reconnection backoff invariants, server heartbeat and zombie-connection termination,
presence join/leave across rooms, offline queue flushing, SSE error and reconnect
branches, and listener isolation when a subscriber throws.

`npm publish` is gated on `lint && test && build`, so a stale `dist/` cannot reach the
registry.

## Changelog

See [CHANGELOG.md](CHANGELOG.md). Notable in **1.4.x**: a React-free `/client` entry point,
a presence leak where users were never removed on disconnect, `usePresence` silently
discarding its `roomId`, and a backoff cap that jitter could exceed.

## License

MIT

