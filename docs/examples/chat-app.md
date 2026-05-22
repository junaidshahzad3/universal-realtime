# Example: Chat Application

A full-featured chat application with user presence and real-time messaging using `useWebSocket` and `usePresence`.

```tsx
import React, { useState } from 'react';
import { useWebSocket, usePresence } from 'universal-realtime';

export const ChatApp = () => {
  const [text, setText] = useState('');
  const [messages, setMessages] = useState<string[]>([]);

  // 1. Join the presence room
  const { users, count, isConnected } = usePresence({
    wsUrl: 'ws://api.example.com/presence',
    roomId: 'general-chat',
    identity: { id: 'user-1', metadata: { name: 'Junaid' } },
  });

  // 2. Connect to the messaging socket
  const { sendMessage, connectionStatus } = useWebSocket<string>('ws://api.example.com/messages', {
    onMessage: (msg) => setMessages((prev) => [...prev, msg]),
  });

  const handleSend = () => {
    sendMessage(text);
    setText('');
  };

  return (
    <div>
      <h2>Real-time Chat ({count} users online)</h2>
      <p>Status: {connectionStatus} | {isConnected ? 'Presence Active' : 'Joining...'}</p>
      
      <div className="users">
        {users.map((u) => (
          <span key={u.id}>{u.metadata?.name} </span>
        ))}
      </div>

      <div className="messages">
        {messages.map((m, i) => (
          <div key={i}>{m}</div>
        ))}
      </div>

      <input value={text} onChange={(e) => setText(e.target.value)} />
      <button onClick={handleSend}>Send</button>
    </div>
  );
};
```
