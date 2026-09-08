import { describe, it, expect, vi } from 'vitest';
import { RealtimeServer } from '../../src/server/RealtimeServer.js';
import { RealtimeClient } from '../../src/core/RealtimeClient.js';
import WebSocket from 'ws';

describe('RealtimeServer module', () => {
  it('spins up a standalone server and broadcasts messages to clients', async () => {
    const port = 8091;
    const server = new RealtimeServer({ port });

    // Client connection
    const client = new RealtimeClient<any>(`ws://localhost:${port}`, {
      webSocketConstructor: WebSocket as any,
    });

    let serverReceived: any = null;
    server.on('message', (socket, msg) => {
      serverReceived = msg;
    });

    let clientReceived: any = null;
    client.subscribe((msg) => {
      clientReceived = msg;
    });

    // Wait for connection to open
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (client.getStatus() === 'open') {
          clearInterval(interval);
          resolve();
        }
      }, 5);
    });

    // Client -> Server send (must be JSON parseable, so we send an object)
    client.sendMessage({ body: 'hello server' });

    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (serverReceived && serverReceived.body === 'hello server') {
          clearInterval(interval);
          resolve();
        }
      }, 5);
    });

    expect(serverReceived.body).toBe('hello server');

    // Server -> Client broadcast
    server.broadcastGlobal({ body: 'hello client' });

    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (clientReceived && clientReceived.body === 'hello client') {
          clearInterval(interval);
          resolve();
        }
      }, 5);
    });

    expect(clientReceived.body).toBe('hello client');

    // Tear down
    client.disconnect();
    await server.close();
  });

  it('rejects unauthorized handshakes matching dynamic auth validation', async () => {
    const port = 8092;
    const server = new RealtimeServer({
      port,
      validateAuth: (token) => {
        return token === 'secret-handshake-123';
      },
    });

    // 1. Client connects with invalid token (turn off reconnect so it stays closed)
    const clientInvalid = new RealtimeClient(`ws://localhost:${port}`, {
      webSocketConstructor: WebSocket as any,
      reconnect: false,
      auth: async () => ({ access_token: 'bad-token' }),
    });

    // Expect close / closed status
    await new Promise<void>((resolve) => setTimeout(resolve, 80));
    expect(clientInvalid.getStatus()).toBe('closed');
    clientInvalid.disconnect();

    // 2. Client connects with valid token
    const clientValid = new RealtimeClient(`ws://localhost:${port}`, {
      webSocketConstructor: WebSocket as any,
      auth: async () => ({ access_token: 'secret-handshake-123' }),
    });

    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (clientValid.getStatus() === 'open') {
          clearInterval(interval);
          resolve();
        }
      }, 5);
    });

    expect(clientValid.getStatus()).toBe('open');

    // Tear down
    clientValid.disconnect();
    await server.close();
  });

  it('buffers server messages offline and flushes them on client reconnection', async () => {
    const port = 8093;
    const sessionId = 'test-session-1';
    const clientId = 'test-client-1';

    const server = new RealtimeServer({
      port,
      sessionTimeoutMs: 5000,
    });

    // 1. First connection
    const client = new RealtimeClient(`ws://localhost:${port}`, {
      webSocketConstructor: WebSocket as any,
      auth: async () => ({
        sessionId,
        clientId,
      }),
    });

    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (client.getStatus() === 'open') {
          clearInterval(interval);
          resolve();
        }
      }, 5);
    });

    // Disconnect client
    client.disconnect();
    await new Promise<void>((resolve) => setTimeout(resolve, 30));

    // 2. Server sends message to offline session
    const delivered = server.sendToSession(sessionId, 'missed-offline-msg');
    expect(delivered).toBe(false); // Buffered instead of sent

    let clientReceived: any = null;

    // 3. Client reconnects with same sessionId
    const clientReconnect = new RealtimeClient(`ws://localhost:${port}`, {
      webSocketConstructor: WebSocket as any,
      auth: async () => ({
        sessionId,
        clientId,
      }),
    });

    clientReconnect.subscribe((msg) => {
      clientReceived = msg;
    });

    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (clientReceived === 'missed-offline-msg') {
          clearInterval(interval);
          resolve();
        }
      }, 5);
    });

    expect(clientReceived).toBe('missed-offline-msg');

    // Tear down
    clientReconnect.disconnect();
    await server.close();
  });

  it('manages presence room membership streams automatically', async () => {
    const port = 8094;
    const server = new RealtimeServer({
      port,
      enablePresence: true,
    });

    // Client 1 connects to 'lobby' room
    const client1 = new RealtimeClient(`ws://localhost:${port}`, {
      webSocketConstructor: WebSocket as any,
      auth: async () => ({
        roomId: 'lobby',
      }),
    });

    let client1PresenceEvents: any[] = [];
    client1.subscribe((msg) => {
      client1PresenceEvents.push(msg);
    });

    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (client1.getStatus() === 'open') {
          clearInterval(interval);
          resolve();
        }
      }, 5);
    });

    // Client 1 joins the presence room
    client1.sendMessage({
      type: 'join',
      user: { id: 'user-a', metadata: { name: 'Alice' } },
    });

    // Wait for client 1 sync
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (client1PresenceEvents.some((e) => e.type === 'sync')) {
          clearInterval(interval);
          resolve();
        }
      }, 5);
    });

    const syncEvent = client1PresenceEvents.find((e) => e.type === 'sync');
    expect(syncEvent.users.map((u: any) => u.id)).toContain('user-a');

    // Client 2 connects to the same room
    const client2 = new RealtimeClient(`ws://localhost:${port}`, {
      webSocketConstructor: WebSocket as any,
      auth: async () => ({
        roomId: 'lobby',
      }),
    });

    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (client2.getStatus() === 'open') {
          clearInterval(interval);
          resolve();
        }
      }, 5);
    });

    client2.sendMessage({
      type: 'join',
      user: { id: 'user-b', metadata: { name: 'Bob' } },
    });

    // Client 1 should receive a 'join' event for Client 2
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (client1PresenceEvents.some((e) => e.type === 'join' && e.user.id === 'user-b')) {
          clearInterval(interval);
          resolve();
        }
      }, 5);
    });

    expect(client1PresenceEvents.some((e) => e.type === 'join' && e.user.id === 'user-b')).toBe(true);

    // Client 2 leaves
    client2.disconnect();

    // Client 1 should receive a 'leave' event for Client 2
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (client1PresenceEvents.some((e) => e.type === 'leave' && e.user.id === 'user-b')) {
          clearInterval(interval);
          resolve();
        }
      }, 5);
    });

    expect(client1PresenceEvents.some((e) => e.type === 'leave' && e.user.id === 'user-b')).toBe(true);

    // Tear down
    client1.disconnect();
    await server.close();
  });

  it('removes a user from the default room on disconnect when no roomId was supplied', async () => {
    // Regression: join fell back to the 'default' room without writing that room
    // back to the socket metadata, so the disconnect handler's `if (roomId)`
    // guard skipped cleanup and the user stayed in the room forever.
    const port = 8095;
    const server = new RealtimeServer({ port, enablePresence: true });

    const client = new RealtimeClient(`ws://localhost:${port}`, {
      webSocketConstructor: WebSocket as any,
    });

    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (client.getStatus() === 'open') {
          clearInterval(interval);
          resolve();
        }
      }, 5);
    });

    client.sendMessage({ type: 'join', user: { id: 'ghost', metadata: { name: 'Ghost' } } });

    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (server.getRoomUsers('default').length === 1) {
          clearInterval(interval);
          resolve();
        }
      }, 5);
    });

    expect(server.getRoomUsers('default').map((u) => u.id)).toContain('ghost');

    client.disconnect();

    await new Promise<void>((resolve) => setTimeout(resolve, 120));
    expect(server.getRoomUsers('default')).toHaveLength(0);

    await server.close();
  });

  it('scopes presence by a roomId supplied on the join frame', async () => {
    // Regression: the room was only ever read from the connection query string,
    // so `usePresence({ roomId })` — which sends it on the frame — collapsed
    // every caller into a single shared room.
    const port = 8096;
    const server = new RealtimeServer({ port, enablePresence: true });

    const mkClient = () =>
      new RealtimeClient(`ws://localhost:${port}`, {
        webSocketConstructor: WebSocket as any,
      });

    const waitOpen = (c: ReturnType<typeof mkClient>) =>
      new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          if (c.getStatus() === 'open') {
            clearInterval(interval);
            resolve();
          }
        }, 5);
      });

    const alice = mkClient();
    const bob = mkClient();
    await Promise.all([waitOpen(alice), waitOpen(bob)]);

    alice.sendMessage({ type: 'join', roomId: 'lobby', user: { id: 'alice' } });
    bob.sendMessage({ type: 'join', roomId: 'kitchen', user: { id: 'bob' } });

    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (server.getRoomUsers('lobby').length === 1 && server.getRoomUsers('kitchen').length === 1) {
          clearInterval(interval);
          resolve();
        }
      }, 5);
    });

    // Each user lands in their own room, and nothing leaks into 'default'.
    expect(server.getRoomUsers('lobby').map((u) => u.id)).toEqual(['alice']);
    expect(server.getRoomUsers('kitchen').map((u) => u.id)).toEqual(['bob']);
    expect(server.getRoomUsers('default')).toHaveLength(0);

    // Leaving one room must not disturb the other.
    alice.disconnect();
    await new Promise<void>((resolve) => setTimeout(resolve, 120));
    expect(server.getRoomUsers('lobby')).toHaveLength(0);
    expect(server.getRoomUsers('kitchen')).toHaveLength(1);

    bob.disconnect();
    await server.close();
  });
});
