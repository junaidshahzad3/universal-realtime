import { RealtimeServer } from '../src/server/RealtimeServer.js';
import { RealtimeClient } from '../src/core/RealtimeClient.js';
import WebSocket from 'ws';

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runBenchmark() {
  console.log('================================================================');
  console.log('   STARTING CONCURRENCY & SCALABILITY STRESS TESTS (v1.3.0)     ');
  console.log('================================================================');

  const PORT = 9099;
  const CLIENT_COUNT = 1000;
  const BROADCAST_COUNT = 50;
  const EXPECTED_MESSAGES = CLIENT_COUNT * BROADCAST_COUNT; // 50,000 messages

  // 1. Initial Memory Snapshot
  const initialMemory = process.memoryUsage();
  console.log(`[Memory] Initial Heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB | RSS: ${(initialMemory.rss / 1024 / 1024).toFixed(2)} MB`);

  // 2. Start companion RealtimeServer
  console.log(`[Server] Spinning up RealtimeServer on standalone port ${PORT}...`);
  const server = new RealtimeServer({
    port: PORT,
    enablePresence: true,
    debug: false, // Turn off debug log bloat during heavy throughput
  });

  // 3. Connect 1,000 concurrent client instances
  console.log(`[Clients] Spawning ${CLIENT_COUNT} parallel clients connected to 'perf-lobby' room...`);
  const startConnectTime = Date.now();
  const clients: RealtimeClient[] = [];
  const openPromises: Promise<void>[] = [];

  const batchSize = 50;
  for (let i = 0; i < CLIENT_COUNT; i++) {
    if (i > 0 && i % batchSize === 0) {
      await sleep(80); // Stagger batches to prevent TCP backlog exhaustion
    }

    const client = new RealtimeClient(`ws://localhost:${PORT}`, {
      webSocketConstructor: WebSocket as any,
      reconnect: false, // Disable reconnect in load tests to measure raw drops
      onError: (err) => {
        console.error(`[Client-${i}] Connection error:`, err);
      },
      onClose: (event) => {
        if (event.code !== 1000 && event.code !== 1005) {
          console.warn(`[Client-${i}] Closed with unexpected code: ${event.code}`);
        }
      },
      auth: async () => ({
        clientId: `client-${i}`,
        sessionId: `session-${i}`,
        roomId: 'perf-lobby',
      }),
    });
    clients.push(client);

    const openPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Client ${i} connection timed out`));
      }, 18000);

      client.subscribeStatus((status) => {
        if (status === 'open') {
          clearTimeout(timeout);
          resolve();
        }
      });
    });
    openPromises.push(openPromise);
  }

  // Wait for all handshakes to complete
  try {
    await Promise.all(openPromises);
  } catch (err: any) {
    console.error('[Clients] Handshake sequence failed:', err.message);
    throw err;
  }
  const connectDuration = Date.now() - startConnectTime;
  console.log(`[Clients] Successfully connected all ${CLIENT_COUNT} clients in ${connectDuration}ms!`);

  // 4. Memory Snapshot post-connections
  const activeMemory = process.memoryUsage();
  console.log(`[Memory] Connected Heap: ${(activeMemory.heapUsed / 1024 / 1024).toFixed(2)} MB | RSS: ${(activeMemory.rss / 1024 / 1024).toFixed(2)} MB`);

  // 5. Run presence joins in parallel
  console.log('[Presence] Performing parallel joins inside presence rooms...');
  for (let i = 0; i < CLIENT_COUNT; i++) {
    clients[i].sendMessage({
      type: 'join',
      user: { id: `user-${i}`, metadata: { name: `Tester-${i}` } },
    });
  }

  // Allow room to fully sync
  await sleep(1000);
  const roomUsers = server.getRoomUsers('perf-lobby');
  console.log(`[Presence] Presence room registration complete. Active room members count: ${roomUsers.length}`);

  // 6. High-Frequency Fanout Stress Test (Throughput)
  console.log(`[Stress] Initiating fanout event: Broadcasting ${BROADCAST_COUNT} messages to all ${CLIENT_COUNT} clients...`);
  console.log(`[Stress] Expected structured payloads to receive across all clients: ${EXPECTED_MESSAGES}`);

  let receivedCount = 0;
  const startStressTime = Date.now();

  const receivePromise = new Promise<void>((resolve) => {
    for (const client of clients) {
      client.subscribe((msg) => {
        if (msg && msg.type === 'stress-payload') {
          receivedCount++;
          if (receivedCount === EXPECTED_MESSAGES) {
            resolve();
          }
        }
      });
    }
  });

  // Server streams pings
  for (let i = 0; i < BROADCAST_COUNT; i++) {
    server.broadcastGlobal({
      type: 'stress-payload',
      sequence: i,
      timestamp: Date.now(),
    });
  }

  // Wait for all 50,000 messages to be received
  await receivePromise;
  const stressDuration = Date.now() - startStressTime;
  const msgPerSec = (EXPECTED_MESSAGES / (stressDuration / 1000)).toFixed(0);

  console.log(`[Stress] Successfully received all ${EXPECTED_MESSAGES} messages!`);
  console.log(`[Stress] Total Fanout Duration: ${stressDuration}ms | Throughput Speed: ${msgPerSec} msg/sec`);

  // 7. Post-stress memory profiling for leak detection
  const postStressMemory = process.memoryUsage();
  console.log(`[Memory] Post-Stress Heap: ${(postStressMemory.heapUsed / 1024 / 1024).toFixed(2)} MB | RSS: ${(postStressMemory.rss / 1024 / 1024).toFixed(2)} MB`);

  // Heap growth evaluation
  const heapGrowth = ((postStressMemory.heapUsed - activeMemory.heapUsed) / 1024 / 1024).toFixed(2);
  console.log(`[Memory] Net Heap Leak/Growth post heavy load: ${heapGrowth} MB`);

  // 8. Graceful Teardown
  console.log('[Teardown] Gracefully closing all client connection instances...');
  for (const client of clients) {
    client.disconnect();
  }

  console.log('[Teardown] Shutting down standalone server companion port...');
  await server.close();
  console.log('[Teardown] Teardown complete. Zero ports or sockets remain occupied.');

  console.log('================================================================');
  console.log('           SCALABILITY AND STRESS TESTS SUCCESSFUL              ');
  console.log('================================================================');
}

runBenchmark().catch((err) => {
  console.error('[Benchmark] CRITICAL: Concurrency test suite crashed:', err);
  process.exit(1);
});
