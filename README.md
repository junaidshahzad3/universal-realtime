# use-realtime 📡

Ready-to-use React hooks for real-time and live data. Small, well-tested, and zero-bloat.

## 🚀 Installation

```bash
npm install use-realtime
```

## 🪝 Hooks

### 1. `useWebSocket`
WebSocket connection with auto-reconnect and exponential backoff.

```tsx
const { lastMessage, sendMessage, connectionStatus } = useWebSocket('ws://api.example.com');
```

### 2. `useSSE`
Server-Sent Events with auto-reconnect.

```tsx
const { data, connectionStatus } = useSSE('https://api.example.com/stream');
```

### 3. `usePresence`
"Who's online" tracking built on WebSockets.

```tsx
const { users, count } = usePresence({
  wsUrl: 'ws://api.example.com/presence',
  roomId: 'chat-123',
  identity: { id: 'user-1', metadata: { name: 'Junaid' } }
});
```

### 4. `useOptimisticUpdate`
Instant UI updates with automatic rollback.

```tsx
const { data, update, isPending } = useOptimisticUpdate(initialData);

const handleUpdate = () => {
  update(newData, async () => {
    return await api.save(newData);
  });
};
```

### 5. `useConnectionStatus`
Unified browser online/offline state.

```tsx
const { isOnline, since } = useConnectionStatus();
```

## 🛠 Features
- **Zero dependencies**: Only React as a peer dependency.
- **Tree-shakable**: Small bundle size (<15kb gzipped).
- **TypeScript**: Full type safety and generics.
- **SSR Safe**: Works with Next.js and Remix.
- **Auto-reconnect**: Built-in exponential backoff.

## 📄 License
MIT
