# Task List - Vanilla JS/TS Core Class Refactoring

- [x] **Phase 1: Configure Types**
  - [x] Update `src/types/index.ts` to support `RealtimeClientOptions` and Node.js WebSocket constructors

- [x] **Phase 2: Build framework-agnostic `RealtimeClient`**
  - [x] Implement `src/core/RealtimeClient.ts`
  - [x] Manage raw WebSocket and reconnect managers natively in the class
  - [x] Set up interval ping and timeout keep-alive heartbeats in the class
  - [x] Implement Pub/Sub message subscriptions (`subscribe`) and status subscriptions (`subscribeStatus`)

- [x] **Phase 3: Refactor React hooks**
  - [x] Refactor `src/hooks/useWebSocket.ts` to delegate to `RealtimeClient`
  - [x] Refactor `src/hooks/RealtimeProvider.tsx` to instantiate `RealtimeClient`
  - [x] Refactor `src/hooks/useRealtime.ts` to sync with context

- [x] **Phase 4: Exports**
  - [x] Update `src/index.ts` to export `RealtimeClient` from `./core/RealtimeClient.js`

- [x] **Phase 5: Extensive Test Suites**
  - [x] Add `tests/core/RealtimeClient.test.ts` to test Vanilla class directly
  - [x] Update `tests/hooks/heartbeat.test.ts` and `tests/hooks/useRealtime.test.tsx` to match the new client architecture
  - [x] Run `npm run test` and address any failures

- [x] **Phase 6: Quality Control & Validation**
  - [x] Check code coverage using `npm run test:coverage` to ensure it exceeds 90%
  - [x] Verify type safety using `npm run lint`
  - [x] Run `npm run build` to verify tree-shakable bundle compilation under `dist/`
