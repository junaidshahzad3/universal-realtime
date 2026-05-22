# Implementation Plan - use-realtime

Building a focused collection of React hooks for real-time and live data.

## Goal
Create a small, well-tested, zero-bloat npm library providing 5 production-quality hooks: `useWebSocket`, `useSSE`, `usePresence`, `useOptimisticUpdate`, and `useConnectionStatus`.

## User Review Required

> [!IMPORTANT]
> The directory `d:/Projects/Portfolio/use-realtime` was found to be empty. I will initialize the project from scratch following your requested folder structure.

> [!WARNING]
> I will use `tsup` for building as requested. Ensure you have Node.js and npm installed in your environment.

## Proposed Changes

### Phase 1: Project Initialization
Set up the base project structure and dependencies.

- [NEW] [package.json](file:///d:/Projects/Portfolio/use-realtime/package.json): Define scripts, peer dependencies (React), and dev dependencies (TypeScript, Vitest, tsup).
- [NEW] [tsconfig.json](file:///d:/Projects/Portfolio/use-realtime/tsconfig.json): Strict TypeScript configuration.
- [NEW] [vitest.config.ts](file:///d:/Projects/Portfolio/use-realtime/vitest.config.ts): Configure Vitest with `jsdom` and React Testing Library.

### Phase 2: Utilities
Core logic for reconnection and backoff.

#### [NEW] [backoff.ts](file:///d:/Projects/Portfolio/use-realtime/src/utils/backoff.ts)
- Implement `getDelay(attempt, base, max)` function.

#### [NEW] [reconnect.ts](file:///d:/Projects/Portfolio/use-realtime/src/utils/reconnect.ts)
- Implement a manager for the reconnection loop.

### Phase 3: Hooks Implementation
Developing hooks from simplest to most complex.

#### [NEW] [useConnectionStatus.ts](file:///d:/Projects/Portfolio/use-realtime/src/hooks/useConnectionStatus.ts)
- Track online/offline status using window events.

#### [NEW] [useOptimisticUpdate.ts](file:///d:/Projects/Portfolio/use-realtime/src/hooks/useOptimisticUpdate.ts)
- Manage optimistic state with rollback capability.

#### [NEW] [useWebSocket.ts](file:///d:/Projects/Portfolio/use-realtime/src/hooks/useWebSocket.ts)
- WebSocket implementation with auto-reconnect and generic message support.

#### [NEW] [useSSE.ts](file:///d:/Projects/Portfolio/use-realtime/src/hooks/useSSE.ts)
- Server-Sent Events implementation with auth header support (polyfill).

#### [NEW] [usePresence.ts](file:///d:/Projects/Portfolio/use-realtime/src/hooks/usePresence.ts)
- Built on top of `useWebSocket` for user presence tracking.

### Phase 4: Exports and Types
- [NEW] [src/types/index.ts](file:///d:/Projects/Portfolio/use-realtime/src/types/index.ts): Centralized types.
- [NEW] [src/index.ts](file:///d:/Projects/Portfolio/use-realtime/src/index.ts): Barrel exports.

### Phase 5: Testing
Reach >90% line coverage using Vitest and `mock-socket`.
- [NEW] `tests/hooks/*.test.ts`
- [NEW] `tests/utils/*.test.ts`

### Phase 6: Documentation and Examples
- [NEW] [docs/examples/chat-app.md](file:///d:/Projects/Portfolio/use-realtime/docs/examples/chat-app.md)
- [NEW] [docs/examples/live-dashboard.md](file:///d:/Projects/Portfolio/use-realtime/docs/examples/live-dashboard.md)
- [NEW] [docs/examples/collaborative-editing.md](file:///d:/Projects/Portfolio/use-realtime/docs/examples/collaborative-editing.md)
- [NEW] [README.md](file:///d:/Projects/Portfolio/use-realtime/README.md)

## Verification Plan

### Automated Tests
- Run `npm test` to verify all hooks and utilities.
- Target: >90% coverage.

### Build Verification
- Run `npm run build` to ensure `tsup` generates valid CJS, ESM, and d.ts files.
- Verify tree-shakability.
