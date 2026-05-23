import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Server, WebSocket as MockWebSocket } from 'mock-socket';
import { RealtimeClient } from '../../src/core/RealtimeClient.js';

describe('RealtimeClient core class', () => {
  beforeEach(() => {
    vi.stubGlobal('WebSocket', MockWebSocket);
  });

  it('connects and broadcasts messages to subscribers', async () => {
    const url = 'ws://localhost:6001';
    const mockServer = new Server(url);
    
    const client = new RealtimeClient<string>(url);

    let receivedStatus: string | null = null;
    client.subscribeStatus((status) => {
      receivedStatus = status;
    });

    let receivedMsg: string | null = null;
    const unsubscribe = client.subscribe((msg) => {
      receivedMsg = msg;
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

    expect(receivedStatus).toBe('open');

    mockServer.emit('message', JSON.stringify('hello client'));

    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (receivedMsg === 'hello client') {
          clearInterval(interval);
          resolve();
        }
      }, 5);
    });

    expect(receivedMsg).toBe('hello client');
    
    unsubscribe();
    client.disconnect();
    mockServer.stop();
  });

  it('can send messages to the server', async () => {
    const url = 'ws://localhost:6002';
    const mockServer = new Server(url);

    let serverReceived: string | null = null;
    mockServer.on('connection', (socket) => {
      socket.on('message', (data) => {
        serverReceived = data as string;
      });
    });

    const client = new RealtimeClient<string>(url);

    // Wait for open
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (client.getStatus() === 'open') {
          clearInterval(interval);
          resolve();
        }
      }, 5);
    });

    client.sendMessage('message to server');

    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (serverReceived === 'message to server') {
          clearInterval(interval);
          resolve();
        }
      }, 5);
    });

    expect(serverReceived).toBe('message to server');
    client.disconnect();
    mockServer.stop();
  });

  it('handles custom webSocketConstructor', async () => {
    const url = 'ws://localhost:6003';
    const mockServer = new Server(url);

    // Remove global WebSocket to simulate Node environment
    vi.stubGlobal('WebSocket', undefined);

    const client = new RealtimeClient<string>(url, {
      webSocketConstructor: MockWebSocket,
    });

    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (client.getStatus() === 'open') {
          clearInterval(interval);
          resolve();
        }
      }, 5);
    });

    expect(client.getStatus()).toBe('open');
    client.disconnect();
    mockServer.stop();
  });

  it('runs heartbeat keep-alive pings and closes on timeout', async () => {
    const url = 'ws://localhost:6004';
    const mockServer = new Server(url);

    let pingCount = 0;
    mockServer.on('connection', (socket) => {
      socket.on('message', (data) => {
        if (data === 'ping') {
          pingCount++;
        }
      });
    });

    const client = new RealtimeClient<string>(url, {
      heartbeat: {
        interval: 30,
        timeout: 15,
        message: 'ping',
      },
      reconnect: false,
    });

    // Wait for open
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (client.getStatus() === 'open') {
          clearInterval(interval);
          resolve();
        }
      }, 5);
    });

    // Wait for ping to be sent
    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    expect(pingCount).toBeGreaterThanOrEqual(1);
    
    // Since we didn't reply with pong, the timeout will trigger and close the connection
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (client.getStatus() === 'closed') {
          clearInterval(interval);
          resolve();
        }
      }, 5);
    });

    expect(client.getStatus()).toBe('closed');
    client.disconnect();
    mockServer.stop();
  });

  it('safely handles null url or no window in SSR', () => {
    // Null URL
    const clientNull = new RealtimeClient(null);
    expect(clientNull.getStatus()).toBe('closed');

    // Simulated SSR environment
    const originalWindow = global.window;
    vi.stubGlobal('window', undefined);
    vi.stubGlobal('WebSocket', undefined);

    const clientSSR = new RealtimeClient('ws://localhost:6005');
    expect(clientSSR.getStatus()).toBe('closed');

    vi.stubGlobal('window', originalWindow);
  });

  it('unwraps the raw underlying WebSocket client', async () => {
    const url = 'ws://localhost:6006';
    const mockServer = new Server(url);
    const client = new RealtimeClient<string>(url);

    // Wait for open
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (client.getStatus() === 'open') {
          clearInterval(interval);
          resolve();
        }
      }, 5);
    });

    const rawWs = client.unwrap<MockWebSocket>();
    expect(rawWs).toBeInstanceOf(MockWebSocket);
    expect(client.getWebSocket()).toBe(rawWs);

    client.disconnect();
    mockServer.stop();
  });

  it('queues messages offline and flushes them once connected', async () => {
    const url = 'ws://localhost:6007';
    const mockServer = new Server(url);

    let serverReceived: string[] = [];
    mockServer.on('connection', (socket) => {
      socket.on('message', (data) => {
        serverReceived.push(data as string);
      });
    });

    const client = new RealtimeClient<string>(url);
    // Send messages immediately before connection handshake completes
    client.sendMessage('buffered-msg-1');
    client.sendMessage('buffered-msg-2');

    // Wait for connection to open and flush
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (serverReceived.length === 2) {
          clearInterval(interval);
          resolve();
        }
      }, 5);
    });

    expect(serverReceived).toContain('buffered-msg-1');
    expect(serverReceived).toContain('buffered-msg-2');

    client.disconnect();
    mockServer.stop();
  });

  it('executes dynamic async auth callback and appends query params', async () => {
    const url = 'ws://localhost:6008';
    const mockServer = new Server(url);

    let receivedUrl = '';
    mockServer.on('connection', (socket) => {
      receivedUrl = socket.url;
    });

    const client = new RealtimeClient<string>(url, {
      auth: async () => {
        return { access_token: 'secret-token-xyz', user_role: 'admin' };
      }
    });

    // Wait for open
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (client.getStatus() === 'open') {
          clearInterval(interval);
          resolve();
        }
      }, 5);
    });

    const parsedUrl = new URL(receivedUrl);
    expect(parsedUrl.searchParams.get('access_token')).toBe('secret-token-xyz');
    expect(parsedUrl.searchParams.get('user_role')).toBe('admin');

    client.disconnect();
    mockServer.stop();
  });
});
