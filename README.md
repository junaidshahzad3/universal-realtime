# universal-realtime

A premium, lightweight, zero-dependency real-time engine and hooks package for JavaScript, TypeScript, Node.js, and React. 

`universal-realtime` delivers a high-performance framework-agnostic client (`RealtimeClient`) alongside ultra-optimized React wrappers. It provides out-of-the-box support for auto-reconnection (exponential backoff), customizable heartbeats (ping/pong), Server-Sent Events, user presence, and optimistic UI updates.

---

## Key Features

* **Framework-Agnostic Core**: Build with `RealtimeClient` in vanilla JS/TS, Node.js (via custom WebSocket constructors), Angular, Vue, Svelte, or SSR environments (Next.js/Remix safe).
* **Multiplexed React Hooks**: Streamline app performance using `RealtimeProvider` and `useRealtime` to share a single, robust connection across many components with zero React Context render cascades.
* **Traffic-Aware Heartbeats**: Minimize unnecessary bandwidth with keep-alive heartbeats that only ping when the websocket connection is idle.
* **Auto-Reconnection**: Resilient reconnection using a custom exponential backoff manager.
* **Zero Dependencies & Tree-Shakable**: Built using modern ES tooling compiling to a microscopic size (~8 KB minified).

---

## Installation

```bash
npm install universal-realtime
```

---

## Framework-Agnostic Engine (`RealtimeClient`)

Perfect for pure JS/TS scripts, backend Node.js, or any non-React frameworks.

```typescript
import { RealtimeClient } from 'universal-realtime';

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
import { RealtimeClient } from 'universal-realtime';
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
    return { token, clientVersion: '1.1.0' };
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

## License
MIT

