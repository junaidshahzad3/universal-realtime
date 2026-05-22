# Competitive Analysis — universal-realtime

A deep market analysis comparing `universal-realtime` with existing real-time solutions in the JavaScript, TypeScript, and React ecosystems.

---

## ⚔️ The Competitor Landscape

To build real-time features in JS/TS today, developers typically choose between three main categories of packages. Here is how `universal-realtime` compares directly to each:

### 1. `react-use-websocket` (The React Industry Standard)
* **What it is**: The most popular React hook for WebSockets (~3k+ stars).
* **Limitations**:
  * **Framework Lock-in**: Strictly bound to React. It cannot be used in Vue, Angular, Svelte, or Node.js microservices.
  * **Feature Scope**: Only supports WebSockets. If a developer needs SSE (Server-Sent Events) or Presence, they have to install and configure separate libraries.
  * **Re-render Overhead**: Reusing connections using its `share: true` flag updates state on every component using that URL, triggering widespread re-renders unless developers write complex manual optimization layers.
* **Our Edge**: 
  * **Framework-Agnostic Core**: Decoupled TS `RealtimeClient` works anywhere (including Node.js), while still delivering premium React hooks.
  * **Unified Suite**: WebSockets, SSE, Presence, Optimistic Updates, and Connection Status in a single library.
  * **Pub/Sub Ref Optimization**: Stable Context with ref-based arrays. The optional hook-level `filter` evaluates messages in memory. Only the target component re-renders—zero global render cascades.

### 2. Socket.IO (The Custom Protocol Giant)
* **What it is**: The veteran real-time framework with custom transport fallbacks.
* **Limitations**:
  * **Proprietary Protocol**: Requires running a dedicated Socket.IO Node.js server. It is completely incompatible with standard RFC 6455 raw WebSocket backends (e.g. Go, Python, Rust, Elixir).
  * **Heavyweight Bloat**: The client library is heavy (~15KB–20KB gzipped) and includes legacy polling mechanisms rarely needed in modern HTTP/2 environments.
* **Our Edge**: 
  * **100% Native Standards**: Runs on raw, standard WebSocket (`ws://` / `wss://`) and SSE browser protocols.
  * **Ultra-Lightweight**: Zero external runtime dependencies. Compiles to a microscopic **~8KB ESM bundle**.

### 3. Managed SaaS Platforms (Ably, Pusher, Supabase Presence)
* **What it is**: Proprietary cloud services providing out-of-the-box cursor and online presence tracking.
* **Limitations**:
  * **Vendor Lock-in**: Proprietary client SDKs that only connect to their specific cloud servers.
  * **Monthly SaaS Cost**: Free tiers are extremely limited. Scale is heavily billed per message and active connection, making it highly expensive.
* **Our Edge**:
  * **Zero Cost / Zero Lock-In**: A native, highly-optimized `usePresence` hook built on standard WebSockets with a standardized JSON sync payload. You can run it on *any* self-hosted open-source backend (Node, Go, Python, etc.) completely free.

---

## 📊 Feature Comparison Matrix

| Feature | `universal-realtime` (Our Package) | `react-use-websocket` | `Socket.IO` | `Pusher / Ably` |
| :--- | :---: | :---: | :---: | :---: |
| **Framework Agnostic** | **Yes** (Vanilla TS Client) | No (React only) | Yes | Yes (Proprietary SDKs) |
| **Micro-Bundle Size** | **Yes** (<8KB ESM) | Yes (<5KB) | No (~15KB-20KB) | No (Heavy SDKs) |
| **Heartbeat Keep-Alive** | **Yes** (Customizable, Native) | No (Manual setup) | Yes | Yes |
| **Context Multiplexing** | **Yes** (Pub/Sub Optimized) | No (URL Registry) | Yes | Yes |
| **Server-Sent Events (SSE)**| **Yes** (Built-in) | No | No | No |
| **Presence Support** | **Yes** (Native & Serverless) | No | No (Manual rooms) | Yes (Proprietary Channels) |
| **Optimistic Updates** | **Yes** (With auto-rollback) | No | No | No |
| **Standard WS Compatible**| **Yes** (RFC 6455) | Yes | No (Custom protocol) | No (Vendor protocol) |
| **Running inside Node.js** | **Yes** (WS Constructor compatible) | No | Yes | Yes |

---

## 💎 Our Key Unique Selling Points (USPs)

1. **The Ultimate Unified Real-Time Suite**:
   Developers no longer have to stitch together 4 different npm libraries to get a robust, production-grade real-time experience. With a single dependency, they get WebSockets, SSE, Presence, Optimistic UI Updates, and Connection Status indicators.
2. **Performance First (60 FPS Guarantee)**:
   By utilizing a custom Pub/Sub event emitter using mutable Refs, `universal-realtime` solves the massive re-render bottleneck that plagues React Context-based socket connections under high frequency.
3. **Decoupled Architecture**:
   Companies can share the exact same `RealtimeClient` logic (reconnections, intervals, heartbeats) across their React Web Apps, Vue Admin Dashboards, Angular Portals, and Node.js backend worker microservices.
4. **Zero-Lock-in Self-Hosted Presence**:
   Allows developers to implement production-grade presence and collaborative features (such as cursor tracking and live rooms) completely free using raw WebSockets, avoiding expensive SaaS bills.
