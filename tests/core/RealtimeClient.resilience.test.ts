import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Server, WebSocket as MockWebSocket } from 'mock-socket';
import { RealtimeClient } from '../../src/core/RealtimeClient.js';

const openClient = (client: { getStatus: () => string }) =>
  new Promise<void>((resolve) => {
    const interval = setInterval(() => {
      if (client.getStatus() === 'open') {
        clearInterval(interval);
        resolve();
      }
    }, 5);
  });

const flush = (ms = 40) => new Promise<void>((r) => setTimeout(r, ms));

describe('RealtimeClient resilience and accessors', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubGlobal('WebSocket', MockWebSocket);
    // These paths deliberately log; keep the suite output readable.
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('isolates a throwing message subscriber from the others', async () => {
    const url = 'ws://localhost:6101';
    const server = new Server(url);
    const client = new RealtimeClient<string>(url);

    const received: string[] = [];
    client.subscribe(() => {
      throw new Error('subscriber blew up');
    });
    client.subscribe((msg) => received.push(msg));

    await openClient(client);
    server.emit('message', JSON.stringify('payload'));
    await flush();

    // The healthy subscriber still ran, and the failure was logged not rethrown.
    expect(received).toEqual(['payload']);
    expect(consoleError).toHaveBeenCalled();

    client.disconnect();
    server.close();
  });

  it('isolates a throwing status listener from the others', async () => {
    const url = 'ws://localhost:6102';
    const server = new Server(url);
    const client = new RealtimeClient<string>(url);

    const seen: string[] = [];
    client.subscribeStatus(() => {
      throw new Error('status listener blew up');
    });
    client.subscribeStatus((s) => seen.push(s));

    await openClient(client);

    expect(seen).toContain('open');
    expect(consoleError).toHaveBeenCalled();

    client.disconnect();
    server.close();
  });

  it('stops delivering to a listener once it unsubscribes', async () => {
    const url = 'ws://localhost:6103';
    const server = new Server(url);
    const client = new RealtimeClient<string>(url);

    const received: string[] = [];
    const unsubscribe = client.subscribe((m) => received.push(m));

    await openClient(client);
    server.emit('message', JSON.stringify('first'));
    await flush();

    unsubscribe();
    server.emit('message', JSON.stringify('second'));
    await flush();

    expect(received).toEqual(['first']);

    client.disconnect();
    server.close();
  });

  it('emits the current status immediately on subscribeStatus', async () => {
    const url = 'ws://localhost:6104';
    const server = new Server(url);
    const client = new RealtimeClient<string>(url);
    await openClient(client);

    // A listener attached after connect must still learn the current state.
    let first: string | null = null;
    client.subscribeStatus((s) => {
      if (first === null) first = s;
    });

    expect(first).toBe('open');

    client.disconnect();
    server.close();
  });

  it('does not re-notify listeners when the status is unchanged', async () => {
    const url = 'ws://localhost:6105';
    const server = new Server(url);
    const client = new RealtimeClient<string>(url);
    await openClient(client);

    const seen: string[] = [];
    client.subscribeStatus((s) => seen.push(s));
    const afterAttach = seen.length;

    // Disconnecting twice must only produce one 'closed' transition.
    client.disconnect();
    client.disconnect();
    await flush();

    const closedCount = seen.slice(afterAttach).filter((s) => s === 'closed').length;
    expect(closedCount).toBe(1);

    server.close();
  });

  it('drops rather than buffers outgoing messages when buffering is disabled', async () => {
    const url = 'ws://localhost:6106';
    const server = new Server(url);

    const delivered: string[] = [];
    server.on('connection', (socket: any) => {
      socket.on('message', (data: string) => delivered.push(data));
    });

    const client = new RealtimeClient<string>(url, { bufferOfflineMessages: false });

    // Sent before the socket is open: with buffering off this must be discarded.
    client.sendMessage('dropped-while-offline');

    await openClient(client);
    client.sendMessage('sent-while-online');
    await flush(80);

    // String payloads are sent verbatim; only objects are JSON-encoded.
    expect(delivered).toEqual(['sent-while-online']);

    client.disconnect();
    server.close();
  });

  it('applies the filter option before notifying subscribers', async () => {
    const url = 'ws://localhost:6107';
    const server = new Server(url);

    const client = new RealtimeClient<any>(url, {
      filter: (msg: any) => msg?.keep === true,
    });

    const received: any[] = [];
    client.subscribe((m) => received.push(m));

    await openClient(client);
    server.emit('message', JSON.stringify({ keep: false, n: 1 }));
    server.emit('message', JSON.stringify({ keep: true, n: 2 }));
    await flush(80);

    expect(received).toEqual([{ keep: true, n: 2 }]);

    client.disconnect();
    server.close();
  });

  it('exposes url, status, reconnect count and the raw socket', async () => {
    const url = 'ws://localhost:6108';
    const server = new Server(url);
    const client = new RealtimeClient<string>(url);

    expect(client.getUrl()).toBe(url);

    await openClient(client);

    expect(client.getStatus()).toBe('open');
    expect(client.getReconnectCount()).toBe(0);
    expect(client.getWebSocket()).not.toBeNull();

    client.disconnect();
    expect(client.getStatus()).toBe('closed');
    expect(client.getWebSocket()).toBeNull();

    server.close();
  });

  it('delivers non-JSON frames to subscribers as raw strings', async () => {
    const url = 'ws://localhost:6109';
    const server = new Server(url);
    const client = new RealtimeClient<any>(url);

    const received: any[] = [];
    client.subscribe((m) => received.push(m));

    await openClient(client);
    server.emit('message', 'plain-text-not-json');
    await flush();

    expect(received).toEqual(['plain-text-not-json']);

    client.disconnect();
    server.close();
  });
});
