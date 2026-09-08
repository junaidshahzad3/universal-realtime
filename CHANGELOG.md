# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.1] - 2026-09-08

### Fixed
- **Republish of 1.4.0 with a correct build.** The 1.4.0 tarball shipped a `dist/`
  built before the backoff cap fix landed, so that one fix was present in the
  source but missing from the published package. The other three fixes and the
  `/client` entry were unaffected. Upgrade from 1.4.0 to pick it up.

### Added
- A `prepublishOnly` script (`lint && test && build`) so a stale `dist/` can no
  longer reach the registry.

## [1.4.0] - 2026-09-08

### Added
- **React-free entry point** — import the core engine from `universal-realtime/client`
  in vanilla JS/TS, Node, Vue, Svelte or Angular. The root entry pulls in React for
  the hooks, so non-React consumers previously hit `MODULE_NOT_FOUND` despite the
  package advertising a framework-agnostic core.

### Fixed
- **Presence users were never removed on disconnect.** A client that connected
  without a `?roomId=` query parameter joined the `default` room, but the room was
  never written back to the socket metadata — so the disconnect handler's
  `if (roomId)` guard skipped cleanup and the user stayed in the room forever.
- **`usePresence` ignored its `roomId` option.** The value was accepted by the hook
  and never sent, collapsing every caller into a single shared room. The room now
  travels on the join frame, and the server honours it.
- **Backoff could exceed `maxInterval`.** Jitter was applied after the cap and
  returned unclamped, so roughly half of all reconnect delays landed above the
  configured maximum (up to 1.25x it). Delays are now re-clamped, while still
  staggering at the ceiling.
- **A throwing status listener escaped `subscribeStatus`.** The priming call was
  unguarded, unlike every other listener invocation, so a listener that threw on
  first call broke the caller that was merely subscribing.

### Testing
- Test suite grown from 39 to 77, including regression coverage for each fix above,
  server heartbeat and zombie-connection termination, SSE error and reconnect
  branches, and client listener isolation.

## [1.3.0] - 2026-05-24

- High-concurrency benchmarks, heap profiling and diagnostics loggers.
