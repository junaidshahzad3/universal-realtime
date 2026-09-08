import { describe, it, expect } from 'vitest';
import { RealtimeServer } from '../../src/server/RealtimeServer.js';
import { RealtimeClient } from '../../src/core/RealtimeClient.js';
import WebSocket from 'ws';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const waitOpen = (client: { getStatus: () => string }) =>
  new Promise<void>((resolve) => {
    const interval = setInterval(() => {
      if (client.getStatus() === 'open') {
        clearInterval(interval);
        resolve();
      }
    }, 5);
  });

describe('RealtimeServer heartbeat loop', () => {
  it('keeps a responsive client connected across several ping cycles', async () => {
    const port = 8097;
    const server = new RealtimeServer({ port, heartbeatIntervalMs: 40 });

    const timeouts: any[] = [];
    server.on('heartbeat:timeout', (_socket, sessionId) => timeouts.push(sessionId));

    const client = new RealtimeClient(`ws://localhost:${port}`, {
      webSocketConstructor: WebSocket as any,
      reconnect: false,
    });
    await waitOpen(client);

    // ws answers protocol pings automatically, so isAlive is refreshed each cycle.
    await sleep(260); // ~6 heartbeat cycles

    expect(client.getStatus()).toBe('open');
    expect(timeouts).toHaveLength(0);

    client.disconnect();
    await server.close();
  });

  it('terminates a silent client and emits heartbeat:timeout', async () => {
    const port = 8098;
    const server = new RealtimeServer({ port, heartbeatIntervalMs: 40 });

    const timeouts: any[] = [];
    server.on('heartbeat:timeout', (_socket, sessionId) => timeouts.push(sessionId));

    const client = new RealtimeClient(`ws://localhost:${port}`, {
      webSocketConstructor: WebSocket as any,
      reconnect: false,
    });
    await waitOpen(client);

    // Stop reading from the socket so incoming pings are never processed and no
    // pong is returned — the server should treat this as a zombie connection.
    const raw = client.getWebSocket() as any;
    raw?._socket?.pause?.();

    await sleep(300); // several cycles: one to mark !isAlive, the next to terminate

    expect(timeouts.length).toBeGreaterThan(0);

    client.disconnect();
    await server.close();
  });

  it('stops the heartbeat timer on close so no interval is leaked', async () => {
    const port = 8099;
    const server = new RealtimeServer({ port, heartbeatIntervalMs: 20 });

    const client = new RealtimeClient(`ws://localhost:${port}`, {
      webSocketConstructor: WebSocket as any,
      reconnect: false,
    });
    await waitOpen(client);

    client.disconnect();
    await server.close();

    // If close() left the interval running it would keep touching torn-down
    // state; give it time to misbehave and assert it stays quiet.
    let threw: unknown = null;
    process.once('uncaughtException', (e) => (threw = e));
    await sleep(120);
    expect(threw).toBeNull();
  });
});
