/**
 * Framework-agnostic entry point.
 *
 * Import from `universal-realtime/client` in vanilla JS/TS, Node.js, Angular,
 * Vue, Svelte or any non-React environment. Nothing here imports React, so the
 * package works without React installed.
 *
 * The root entry (`universal-realtime`) re-exports all of this *plus* the React
 * hooks, and therefore requires React.
 */
export { RealtimeClient } from './core/RealtimeClient.js';
export { ReconnectManager } from './utils/reconnect.js';
export { getDelay } from './utils/backoff.js';
export * from './types/index.js';
