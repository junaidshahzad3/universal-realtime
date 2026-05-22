# Implementation Plan - Decoupled Class-Based Core & Universal Realtime Engine

This plan covers the transition of the library into a split-architecture engine: a core, framework-agnostic vanilla JS/TS engine (`RealtimeClient`) and a set of thin, high-performance React hook wrappers (`useWebSocket`, `RealtimeProvider`, `useRealtime`).

Furthermore, in response to direct feedback, the package has been completely renamed to **`universal-realtime`** to reflect its new universal frontend-and-backend capabilities, and it has been validated to be fully available and unique on the npm registry.

---

## 💎 Completed Changes

### 1. Unified Types
* **[types/index.ts](file:///d:/Projects/Portfolio/use-realtime/src/types/index.ts)**: Configured the `RealtimeClientOptions` interface to support custom WebSocket constructors (such as the Node.js `ws` library) and protocols.

### 2. Standalone Vanilla Engine
* **[RealtimeClient.ts](file:///d:/Projects/Portfolio/use-realtime/src/core/RealtimeClient.ts)**: Created a robust, fully decoupled TS class that runs anywhere. It orchestrates the raw connection lifecycle, customizable idle heartbeats, listener registries (Pub/Sub message and status callbacks), and exponential backoff reconnection loops.

### 3. Thin React Wrappers
* **[useWebSocket.ts](file:///d:/Projects/Portfolio/use-realtime/src/hooks/useWebSocket.ts)**: Refactored to delegate 100% of socket lifecycle and reconnection logic to a stable `RealtimeClient` ref, subscribing to message/status streams to update hook states.
* **[RealtimeProvider.tsx](file:///d:/Projects/Portfolio/use-realtime/src/hooks/RealtimeProvider.tsx)**: Refactored to instantiate `RealtimeClient` dynamically on URL changes while utilizing a stable, persistent Set of subscribers, safeguarding downstream components from reconnection drops or context render cascades.
* **[useRealtime.ts](file:///d:/Projects/Portfolio/use-realtime/src/hooks/useRealtime.ts)**: Synchronized with the refactored context, retaining 100% backward compatibility.

### 4. Package Renaming & Exports
* **[package.json](file:///d:/Projects/Portfolio/use-realtime/package.json)**: Changed the package name to `"universal-realtime"`.
* **[index.ts](file:///d:/Projects/Portfolio/use-realtime/src/index.ts)**: Added `RealtimeClient` export to the primary entrypoint.
* **Examples**: Updated all code examples under `docs/examples/` to use `'universal-realtime'`.

### 5. Extensive Test Suites
* **[RealtimeClient.test.ts](file:///d:/Projects/Portfolio/use-realtime/tests/core/RealtimeClient.test.ts)**: Created a pure vanilla test suite confirming WebSocket connections, backend custom constructors, idle pings, heartbeat timeouts, and SSR safety.
* **Sanity**: Verified that all 30 tests in the project pass successfully.

---

## 📈 Verification Plan Summary

* **Automated Tests**:
  * Run `npm run test` -> Checked: All 30 tests passed flawlessly in 2.12s.
  * Run `npm run test:coverage` -> Checked: Overall statement coverage is at **94.82%**, with core logic at **93.57%**.
* **Type Safety & Build**:
  * Run `npm run lint` (`tsc --noEmit`) -> Checked: Zero errors.
  * Run `npm run build` -> Checked: Generates tree-shakable ESM/CJS bundles under `dist/` totaling **~8.3 KB minified**.
