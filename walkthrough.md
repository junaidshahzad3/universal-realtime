# Class-Based Decoupled Architecture Walkthrough — use-realtime

The `use-realtime` library has been successfully upgraded to a decoupled, **class-based, framework-agnostic architecture** and published to the npm registry as **version 1.1.0** (with fully emoji-free, premium documentation). We created a robust, standalone engine `RealtimeClient` that handles all WebSocket connections, heartbeat keep-alives, and reconnection logic natively in vanilla TypeScript, while refactoring the React hooks to serve as thin, high-performance wrappers.

---

## Key Improvements & Architectural Highlights

### 1. Framework-Agnostic Core (`RealtimeClient`)
* **Total Decoupling**: All WebSocket connection, reconnection (exponential backoff), and heartbeat logic has been completely extracted from React hooks and encapsulated in a standard TypeScript class `RealtimeClient`.
* **Universal Usability**: Developers can now use `RealtimeClient` in pure JS/TS environments, Node.js (via the custom `webSocketConstructor` option), Angular, Vue, Next.js (SSR safe), Svelte, or vanilla scripts.
* **Pub/Sub Subscriptions**: Native `subscribe` and `subscribeStatus` interfaces provide standard callbacks for incoming messages and status changes, keeping memory overhead low.

### 2. High-Performance React Wrappers (Thin Hooks)
* **`useWebSocket`**: Refactored to delegate 100% of socket lifecycle and subscription logic to `RealtimeClient` inside a stable React ref. It subscribes to status/message updates to update local states seamlessly.
* **`RealtimeProvider`**: Instantiates a single `RealtimeClient` and leverages the subscription model to multiplex a single websocket connection to multiple consumer components without global render cascades.
* **100% Backward Compatible**: Retained identical signatures for `useWebSocket`, `RealtimeProvider`, and `useRealtime` so existing users can upgrade without breaking their codebase.

### 3. Exquisite Test Coverage (94.82%!)
* Added a brand new, highly robust unit test suite (`tests/core/RealtimeClient.test.ts`) that runs the client in a pure vanilla context with zero React overhead.
* Verified custom constructors, heartbeat timeouts, message broadcasting, and SSR safety.
* **Updated coverage**: Statement coverage has reached an amazing **94.82%**! All 30 tests pass flawlessly.

---

## Coverage Report

```
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |   94.82 |    75.78 |   91.66 |   94.82 |                   
 core              |   93.57 |    73.33 |    90.9 |   93.57 |                   
  ...timeClient.ts |   93.57 |    73.33 |    90.9 |   93.57 | ...85-186,195-196 
 hooks             |   94.72 |    75.49 |      90 |   94.72 |                   
  ...eProvider.tsx |   94.73 |       68 |     100 |   94.73 | 29-31,56-57       
  ...tionStatus.ts |     100 |    63.63 |     100 |     100 | 19-20,24,29       
  ...sticUpdate.ts |     100 |      100 |     100 |     100 |                   
  usePresence.ts   |     100 |     92.3 |     100 |     100 | 43                
  useRealtime.ts   |     100 |      100 |     100 |     100 |                   
  useSSE.ts        |   81.73 |       55 |   66.66 |   81.73 | ...61,65-74,83-85 
  useWebSocket.ts  |   97.64 |       85 |      80 |   97.64 | 49-50             
 utils             |     100 |     92.3 |     100 |     100 |                   
  backoff.ts       |     100 |      100 |     100 |     100 |                   
  reconnect.ts     |     100 |    91.66 |     100 |     100 | 19                
-------------------|---------|----------|---------|---------|-------------------
```

---

## File Structure & Project Architecture

```
use-realtime/
├── dist/                          ← Built, minified, ESM/CJS tree-shakable bundle (~8 KB)
├── src/
│   ├── index.ts                   ← Export hub (exports RealtimeClient + hooks)
│   ├── core/
│   │   └── RealtimeClient.ts      ← [NEW] Decoupled Framework-Agnostic Core Engine
│   ├── hooks/
│   │   ├── RealtimeProvider.tsx   ← React Central Provider (delegates to core client)
│   │   ├── useConnectionStatus.ts
│   │   ├── useOptimisticUpdate.ts
│   │   ├── usePresence.ts
│   │   ├── useRealtime.ts         ← Multi-consumer Pub/Sub listener
│   │   ├── useSSE.ts
│   │   └── useWebSocket.ts        ← WebSocket hook (delegates to core client)
│   ├── types/
│   │   └── index.ts               ← Type safety definitions
│   └── utils/
│       ├── backoff.ts
│       └── reconnect.ts
└── tests/                         ← 30 Passing Vitest Suite (94.82% Coverage)
    ├── core/
    │   └── RealtimeClient.test.ts ← [NEW] Pure Vanilla TS Client test suite
    └── hooks/
        └── ...
```

---

## Quality Assurance Summary

1. **Type Safety**: Running `npm run lint` yields clean compilation with **zero type errors**.
2. **Bundle Quality**: Running `npm run build` minifies and clean-compiles ESM/CJS bundles under `dist/` with a microscopic size of **~8 KB**, supporting complete tree-shaking.
3. **Execution Safety**: Implemented robust environment checks inside `RealtimeClient` constructor to cleanly and silently handle Server-Side Rendering (SSR) in frameworks like Next.js without throwing initialization errors.
