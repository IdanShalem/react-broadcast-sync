# react-broadcast-sync — Project Overview

A deep technical reference for contributors and maintainers. Covers architecture, every module, internal mechanics, the full API surface, tooling, changes made to date, and the feature roadmap.

---

## Table of Contents

- [Purpose](#purpose)
- [Repository Structure](#repository-structure)
- [Architecture](#architecture)
- [Module Reference](#module-reference)
  - [src/index.ts](#srcindexts)
  - [src/types/types.ts](#srctypestypests)
  - [src/utils/messageUtils.ts](#srcutilsmessageutilsts)
  - [src/utils/debug.ts](#srcutilsdebugts)
  - [src/hooks/useBroadcastChannel.ts](#srchooksusebroadcastchannelts)
  - [src/BroadcastProvider.tsx](#srcbroadcastprovidertsx)
- [Internal Message Protocol](#internal-message-protocol)
- [Message Lifecycle](#message-lifecycle)
- [Full API Reference](#full-api-reference)
- [Build System](#build-system)
- [Quality Tooling](#quality-tooling)
- [Test Suite](#test-suite)
- [Changes Made](#changes-made)
- [Roadmap](#roadmap)

---

## Purpose

`react-broadcast-sync` is a lightweight React library (~3KB minzipped) that wraps the native [BroadcastChannel API](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel) into two ergonomic primitives: a hook (`useBroadcastChannel`) and a context provider (`BroadcastProvider`). It lets React apps sync state across browser tabs in real time — without a server, without websockets, and without any external state management library.

**Common use cases:** cross-tab notifications, form state sync, shared auth state, todo/presence, scroll/hover sync, multi-tab dashboards.

---

## Repository Structure

```
react-broadcast-sync/
├── src/
│   ├── index.ts                          # Public exports
│   ├── types/
│   │   └── types.ts                      # All TypeScript interfaces and types
│   ├── utils/
│   │   ├── messageUtils.ts               # Pure utility functions
│   │   └── debug.ts                      # Structured debug logger
│   ├── hooks/
│   │   └── useBroadcastChannel.ts        # Core hook (all logic lives here)
│   ├── BroadcastProvider.tsx             # Context provider wrapper
│   └── tests/
│       ├── useBroadcastChannel.test.tsx  # Core hook unit tests
│       ├── useBroadcastChannel.same-tab.test.tsx  # Same-tab multi-hook tests
│       ├── BroadcastProvider.test.tsx    # Provider tests
│       ├── messageUtils.test.ts          # Utility function tests
│       └── debug.test.ts                 # Debug logger tests
├── demo/
│   └── react-broadcast-sync-demo/        # Vite + React 18 + MUI demo app
├── dist/                                 # Build output (ESM + CJS + .d.ts)
├── codegen/                              # Test plan documents
├── rollup.config.mjs                     # Build configuration
├── tsconfig.json                         # TypeScript configuration
├── jest.config.cjs                       # Jest configuration
├── jest.setup.ts                         # Jest global setup
├── eslint.config.js                      # ESLint rules
├── commitlint.config.js                  # Conventional commit enforcement
├── .prettierrc                           # Prettier configuration
└── .github/workflows/
    ├── ci.yml                            # lint → typecheck → build → test → coverage
    └── release.yml                       # Semantic release to npm + GitHub
```

---

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│                        Browser Tab A                        │
│                                                            │
│  useBroadcastChannel('my-channel', options)                │
│  ┌──────────┐  postMessage()  ┌──────────────────────────┐ │
│  │  React   │ ─────────────▶  │   BroadcastChannel API   │ │
│  │  State   │                 │   (native browser API)   │ │
│  │ messages │ ◀── handleMsg ─ └──────────────────────────┘ │
│  └──────────┘                           │                   │
└─────────────────────────────────────────┼───────────────────┘
                                          │ (same origin, same channel name)
┌─────────────────────────────────────────┼───────────────────┐
│                        Browser Tab B    │                    │
│                                         ▼                   │
│  useBroadcastChannel('my-channel', options)                │
│  ┌──────────┐                ┌──────────────────────────┐  │
│  │  React   │ ◀── handleMsg ─│   BroadcastChannel API   │  │
│  │  State   │                └──────────────────────────┘  │
│  │ messages │                                               │
│  └──────────┘                                               │
└────────────────────────────────────────────────────────────┘
```

Each hook instance creates exactly one `BroadcastChannel` object. The channel is created on mount and closed on unmount. Every `postMessage` call serializes a `BroadcastMessage` envelope and posts it; every received event is processed by `handleMessage` which applies a chain of guards before accepting the message into React state.

---

## Module Reference

### `src/index.ts`

Public entry point. Exports exactly what consumers of the npm package see:

```typescript
export { useBroadcastChannel } from './hooks/useBroadcastChannel';
export { BroadcastProvider, useBroadcastProvider } from './BroadcastProvider';

export type {
  BroadcastOptions,
  SendMessageOptions,
  BroadcastMessage,
  BroadcastActions,
} from './types/types';
```

`MessageCallback` and `OnMessageMap` are intentionally not re-exported here yet — they are used in `BroadcastOptions` so TypeScript infers them, but they can be added to the public surface if consumers need to reference them explicitly.

---

### `src/types/types.ts`

Single source of truth for all TypeScript types. Key interfaces:

#### `BroadcastOptions`

Options passed as the second argument to `useBroadcastChannel`:

| Field                       | Type                              | Default         | Description                                                                                                       |
| --------------------------- | --------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------- |
| `sourceName`                | `string`                          | auto-generated  | Human-readable identifier for this tab/instance. Auto-generated as `tab-<random>` if omitted.                     |
| `cleaningInterval`          | `number`                          | `1000`          | How often (ms) expired messages are swept from `messages` state. Set to `0` to disable.                           |
| `keepLatestMessage`         | `boolean`                         | `false`         | When `true`, `messages` only ever holds the single most recent message. Useful for high-frequency status updates. |
| `registeredTypes`           | `string[]`                        | `[]`            | Allowlist of message types. Empty array = accept everything. Non-matching types are silently dropped.             |
| `namespace`                 | `string`                          | `''`            | Appended to the channel name as `channelName-namespace`. Isolates channels with the same name across app modules. |
| `deduplicationTTL`          | `number`                          | `300000` (5min) | Window (ms) during which a message with the same `id` is considered a duplicate and dropped.                      |
| `cleanupDebounceMs`         | `number`                          | `0`             | Debounces the cleanup function. Useful when messages arrive rapidly to avoid excessive filtering passes.          |
| `batchingDelayMs`           | `number`                          | `20`            | Groups outgoing messages into a single array post within this window. Set to `0` to disable batching.             |
| `excludedBatchMessageTypes` | `string[]`                        | `[]`            | Types that bypass batching and are always sent immediately.                                                       |
| `onMessage`                 | `MessageCallback \| OnMessageMap` | `undefined`     | Callback(s) fired when a received message passes all filters. See [onMessage](#onmessage).                        |

#### `BroadcastMessage`

The shape of every message on the wire and in state:

```typescript
interface BroadcastMessage {
  id: string; // Base64-encoded unique ID (random + source + timestamp)
  type: string; // Developer-defined category string
  message: any; // Arbitrary serializable payload
  timestamp: number; // Unix ms when the message was created
  source: string; // sourceName of the sender
  expirationDate?: number; // Unix ms when the message expires (optional)
}
```

#### `MessageCallback` / `OnMessageMap`

```typescript
type MessageCallback = (msg: BroadcastMessage) => void;
type OnMessageMap = { [type: string]: MessageCallback };
```

#### `BroadcastActions`

The return type of `useBroadcastChannel` and `useBroadcastProvider`. See [Full API Reference](#full-api-reference).

#### Internal types

```typescript
type InternalMessage = 'CLEAR_SENT_MESSAGES' | 'PING' | 'PONG';
```

These are never exposed to consumers. They are hashed with a channel-specific secret to prevent collision with user-defined types.

---

### `src/utils/messageUtils.ts`

Pure utility functions with no React dependencies. All are exported for testing.

#### `generateRandomPart(): string`

Returns a 9-character alphanumeric string via `Math.random().toString(36)`.

#### `generateSourceName(): string`

Returns `tab-<random>`. Used when `sourceName` is not provided.

#### `generateMessageId(source, timestamp): string`

Combines random, source, and timestamp, then base64-encodes the result. Trailing `=` padding is stripped.

#### `isValidMessage(message): boolean`

Guards against malformed or non-library messages. Validates that all four required primitive fields exist with the correct types:

- `id` must be a `string`
- `type` must be a `string`
- `source` must be a `string`
- `timestamp` must be a `number`
- `expirationDate` is optional and not checked here

#### `isMessageExpired(message): boolean`

Returns `true` if `message.expirationDate` exists and is in the past. Messages without an expiration date never expire.

#### `createMessage(type, content, source, options): BroadcastMessage`

Constructs a complete `BroadcastMessage`. Accepts `expirationDuration` (relative ms) or `expirationDate` (absolute timestamp). `expirationDate` takes precedence.

#### `getInternalMessageType(baseType, channelName, namespace): string`

Produces a collision-resistant internal type string. Format: `__INTERNAL__:<baseType>:<base64(secret:baseType:channelName-namespace)>`. The base64 hash makes it unique per channel so internal messages from one channel cannot accidentally trigger handlers on another.

#### `isInternalType(type): boolean`

Returns `true` if the type string starts with `__INTERNAL__:`.

#### `isValidInternalClearMessage(message): boolean`

Returns `true` if the message has the internal type prefix and a string `source`. Used to route PING/PONG/CLEAR_SENT_MESSAGES before user-facing filters run.

#### `debounce(fn, wait)`

Standard trailing-edge debounce. Returns the debounced function augmented with `.cancel()` and `.flush()` methods. Used internally for the optional cleanup debounce.

---

### `src/utils/debug.ts`

Structured debug logger gated behind `process.env.REACT_APP_DEBUG_BROADCAST === 'true'`. All output is prefixed with an ISO timestamp and `[react-broadcast-sync]`.

```typescript
debug.channel.created(name)       // info
debug.channel.closed(name)        // info
debug.message.sent(message)       // info
debug.message.received(message)   // info
debug.message.expired(id)         // info
debug.message.duplicate(id)       // warn
debug.message.ignored(type)       // info
debug.message.allSentCleared()    // info
debug.message.allReceivedCleared() // info
debug.ping.inProgress()           // warn
debug.cleanup.started()           // info
debug.cleanup.completed(count)    // info
debug.error({ action, channelName?, type?, source?, originalError? }) // error
```

Enable with:

```bash
REACT_APP_DEBUG_BROADCAST=true npm start
```

---

### `src/hooks/useBroadcastChannel.ts`

The core of the library. All logic lives here. ~530 lines.

#### State

| Name               | Type                 | Description                                        |
| ------------------ | -------------------- | -------------------------------------------------- |
| `messages`         | `BroadcastMessage[]` | Received messages from other sources               |
| `sentMessages`     | `BroadcastMessage[]` | Messages sent by this instance                     |
| `error`            | `string \| null`     | Current error string, auto-cleared after 3 seconds |
| `isPingInProgress` | `boolean`            | True while a `ping()` is collecting responses      |

#### Refs (stable across renders, no re-renders on change)

| Name                     | Description                                                      |
| ------------------------ | ---------------------------------------------------------------- |
| `channel`                | The live `BroadcastChannel` instance                             |
| `receivedMessageIds`     | `Map<id, timestamp>` — used for deduplication TTL tracking       |
| `activeSourcesCollector` | `Set<string>` — collects PONG source names during an active ping |
| `batchingTimeoutRef`     | Timer handle for the current batching window                     |
| `batchingMessagesRef`    | Buffer of messages waiting to be sent as a batch                 |
| `batchingErrorRef`       | True if a send error occurred during batching                    |
| `registeredTypesRef`     | Always-current copy of `registeredTypes` prop (see below)        |
| `onMessageRef`           | Always-current copy of `onMessage` option                        |

#### Memoized values

- `source`: stable `sourceName` or a once-generated random name
- `internalTypes`: `{ CLEAR_SENT_MESSAGES, PING, PONG }` — hashed per channel+namespace
- `resolvedChannelName`: `channelName` or `channelName-namespace`

#### `registeredTypesRef` pattern

Previously implemented as `useMemo(() => registeredTypes, [JSON.stringify(registeredTypes)])` — an anti-pattern. Now implemented as:

```typescript
const registeredTypesRef = useRef<string[]>(registeredTypes);
registeredTypesRef.current = registeredTypes; // sync on every render
```

This is the standard "ref as always-current value" React pattern. It keeps `handleMessage`'s dependency array shorter (no `stableRegisteredTypes` dep), which means the channel closes and reopens less often when props change.

#### `onMessageRef` pattern

Same pattern as above. `onMessage` is never in any dep array — it's always read at call time through the ref.

#### Effects

| Effect              | Deps                                                      | Purpose                                                          |
| ------------------- | --------------------------------------------------------- | ---------------------------------------------------------------- |
| Channel setup       | `[resolvedChannelName, handleMessage]`                    | Creates `BroadcastChannel`, attaches listener, closes on cleanup |
| Expiry cleanup      | `[cleaningInterval, debouncedCleanup, cleanupDebounceMs]` | Runs `setInterval` to filter expired messages                    |
| DeduplicationTTL GC | `[deduplicationTTL]`                                      | Runs every 60s to prune old entries from `receivedMessageIds`    |
| Batching flush      | `[]`                                                      | On unmount, flushes any unsent batched messages                  |

#### Batching

When `batchingDelayMs > 0`, calls to `postMessage` within the window are buffered in `batchingMessagesRef`. After the delay, the entire buffer is posted as a single array. The receiver handles both single messages (`object`) and batched messages (`array`). Types listed in `excludedBatchMessageTypes` bypass the buffer and are always sent immediately.

#### Ping / Pong

`ping(timeoutMs?)` broadcasts an internal PING message, then waits `timeoutMs` (default 300ms) collecting PONG responses. Each other tab on the same channel responds with a PONG containing its `source` name. Returns a `Promise<string[]>` of all sources that responded within the window.

#### `handleMessage` guard chain

Every received message passes through this chain in order. Any failed check causes an early return with no state update and no `onMessage` call.

```
1. isValidMessage()        — must have id/type/source/timestamp as correct primitives
2. source === self         — drop self-messages
3. isValidInternalClearMessage() — route PING / PONG / CLEAR_SENT_MESSAGES internally
4. registeredTypesRef.current  — drop types not in the allowlist (if set)
5. isMessageExpired()      — drop messages past their expirationDate
6. deduplicationTTL check  — drop messages seen within the TTL window
→  setMessages()           — add to state
→  onMessageRef.current()  — fire user callback (try/catch isolated)
```

---

### `src/BroadcastProvider.tsx`

A thin React context wrapper around `useBroadcastChannel`. Intended for cases where multiple child components need access to the same channel without prop drilling.

```typescript
<BroadcastProvider channelName="notifications">
  <NotificationBar />
  <NotificationBadge />
</BroadcastProvider>
```

Children consume the context with `useBroadcastProvider()`, which throws a descriptive error if used outside the provider.

**Current limitation:** `BroadcastProvider` only accepts `channelName` and `children` — it does not yet forward a `options` prop to `useBroadcastChannel`. This is tracked as a planned improvement (Priority 2 in the roadmap).

---

## Internal Message Protocol

Internal messages use a hashed type string to avoid collisions with user types. The hash includes a shared secret, the internal type name, and the full channel name (including namespace).

```
__INTERNAL__:PING:<base64(react-broadcast-sync:PING:channelName-namespace)>
__INTERNAL__:PONG:<base64(react-broadcast-sync:PONG:channelName-namespace)>
__INTERNAL__:CLEAR_SENT_MESSAGES:<base64(...)>
```

This means a PING on `my-channel` will never be confused with a PING on `other-channel`, even if both are open simultaneously.

Internal messages are routed before user-facing filters (`registeredTypes`, expiry, dedup) and never reach user state or `onMessage` callbacks.

---

## Message Lifecycle

### Sending

```
postMessage(type, content, options?)
  │
  ├── create BroadcastMessage envelope
  ├── should send immediately?
  │   ├── YES (batchingDelayMs=0 or type in excludedBatchMessageTypes)
  │   │   └── channel.postMessage(message)
  │   └── NO
  │       ├── push to batchingMessagesRef
  │       └── schedule setTimeout → channel.postMessage(batchingMessagesRef)
  └── setSentMessages(prev => [...prev, message])
```

### Receiving

```
BroadcastChannel 'message' event
  │
  ├── Array.isArray(event.data)?
  │   ├── YES (batch) → call handleMessage for each item
  │   └── NO (single) → call handleMessage once
  │
  └── handleMessage(event)
        ├── isValidMessage() → return if invalid
        ├── source === self → return
        ├── isValidInternalClearMessage()
        │   ├── CLEAR_SENT_MESSAGES → filter messages, return
        │   ├── PING → post PONG, return
        │   └── PONG → add source to collector, return
        ├── registeredTypes filter → return if not in list
        ├── isMessageExpired() → return if expired
        ├── deduplicationTTL → return if already seen
        ├── setMessages()
        └── onMessage callback (try/catch)
```

### Cleanup

On component unmount:

- Any buffered batching messages are flushed immediately
- The `BroadcastChannel` is closed and the event listener removed
- The cleanup interval and dedup GC interval are cleared

---

## Full API Reference

### `useBroadcastChannel(channelName, options?)`

```typescript
const {
  channelName, // string — resolved name (includes namespace if set)
  messages, // BroadcastMessage[] — received messages
  sentMessages, // BroadcastMessage[] — messages sent by this instance
  isPingInProgress, // boolean
  error, // string | null — auto-clears after 3s
  postMessage,
  clearReceivedMessages,
  clearSentMessages,
  getLatestMessage,
  ping,
  closeChannel,
} = useBroadcastChannel('my-channel', options);
```

#### `postMessage(type, content, options?)`

Sends a message. If batching is active, the message is buffered and sent with the next batch.

```typescript
postMessage('alert', { text: 'Hello!' });
postMessage('notification', { text: 'Expires in 5s' }, { expirationDuration: 5000 });
postMessage('snapshot', data, { expirationDate: Date.now() + 60000 });
```

#### `clearReceivedMessages(options?)`

Removes messages from `messages` state. No options = clear all. Filters use logical AND between criteria and logical OR within each array.

```typescript
clearReceivedMessages(); // clear all
clearReceivedMessages({ ids: ['abc'] }); // by id
clearReceivedMessages({ types: ['alert', 'info'] }); // by type
clearReceivedMessages({ sources: ['tab-xyz'] }); // by source
clearReceivedMessages({ types: ['alert'], sources: ['tab-xyz'] }); // must match both
```

#### `clearSentMessages(options?)`

Removes messages from `sentMessages` state. Optionally broadcasts the clear to other tabs.

```typescript
clearSentMessages(); // clear all local
clearSentMessages({ sync: true }); // clear + broadcast to other tabs
clearSentMessages({ ids: ['abc'], types: ['log'] }); // must match both
```

#### `getLatestMessage(options?)`

Returns the most recent message matching the optional filters, or `null` if none match.

```typescript
getLatestMessage(); // latest of any type/source
getLatestMessage({ type: 'alert' }); // latest 'alert'
getLatestMessage({ source: 'tab-abc' }); // latest from that source
getLatestMessage({ type: 'alert', source: 'tab-abc' }); // both
```

#### `ping(timeoutMs?)`

Broadcasts a PING and waits for PONGs. Returns `Promise<string[]>` of source names that responded.

```typescript
const activeTabs = await ping(); // default 300ms timeout
const activeTabs = await ping(500); // custom timeout
```

#### `closeChannel()`

Manually closes the channel and removes the event listener. Idempotent. The channel is also closed automatically on unmount — use this only for manual/early cleanup.

#### `onMessage` option

Fires after a message passes all receive filters and is added to state. Errors thrown by the callback are caught and debug-logged without breaking state.

```typescript
// Catch-all — fires for every incoming type
useBroadcastChannel('ch', {
  onMessage: msg => console.log(msg.type, msg.message),
});

// Per-type map — one callback per type
useBroadcastChannel('ch', {
  onMessage: {
    error: msg => showToast(msg.message.text),
    success: msg => celebrate(),
    log: msg => console.log(msg.message),
  },
});
```

The callback runs against the latest prop value on every call (stored via ref). Changing `onMessage` between renders uses the new callback immediately with no stale closure risk.

### `BroadcastProvider` / `useBroadcastProvider`

```typescript
<BroadcastProvider channelName="notifications">
  <Child />
</BroadcastProvider>

function Child() {
  const { messages, postMessage } = useBroadcastProvider();
}
```

---

## Build System

Built with [Rollup](https://rollupjs.org/). Produces three artifacts:

| File                | Format                  | Use                            |
| ------------------- | ----------------------- | ------------------------------ |
| `dist/index.esm.js` | ESM                     | Bundlers (Vite, Webpack, etc.) |
| `dist/index.cjs.js` | CommonJS                | Node.js / Jest                 |
| `dist/index.d.ts`   | TypeScript declarations | IDE + tsc                      |

Sourcemaps are emitted for both JS bundles. The output is minified with `@rollup/plugin-terser`.

Peer dependencies (`react`, `react-dom`) are externalized — not bundled. Runtime dependencies (`@babel/runtime`, `tslib`) are externalized from the bundle but listed as `dependencies` so they install with the package.

---

## Quality Tooling

| Tool                          | Purpose                                                             |
| ----------------------------- | ------------------------------------------------------------------- |
| TypeScript (strict mode)      | Type safety across the entire codebase                              |
| ESLint + `react-hooks` plugin | Enforces hook rules and dep arrays                                  |
| Prettier                      | Consistent formatting                                               |
| Husky + lint-staged           | Runs ESLint + Prettier + `tsc --noEmit` on every commit             |
| commitlint                    | Enforces Conventional Commits format                                |
| semantic-release              | Automated versioning, CHANGELOG, and npm publish on merge to `main` |
| Codecov                       | Coverage tracking via CI                                            |

### Commit Prefixes

| Prefix                     | Version Bump  | When to use                          |
| -------------------------- | ------------- | ------------------------------------ |
| `feat:`                    | minor (1.x.0) | New feature or option                |
| `fix:`                     | patch (1.0.x) | Bug fix                              |
| `chore:`                   | none          | Tooling, deps, CI                    |
| `docs:`                    | none          | Documentation only                   |
| `refactor:`                | none          | Code improvement, no behavior change |
| `test:`                    | none          | Tests only                           |
| `BREAKING CHANGE:` in body | major (x.0.0) | Breaking API change                  |

---

## Test Suite

Five test files covering ~137 tests (as of v1.7.0):

| File                                    | What it covers                                                                                              |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `useBroadcastChannel.test.tsx`          | Core hook — messages, clearing, errors, lifecycle, ping, batching, registeredTypes ref, onMessage callbacks |
| `useBroadcastChannel.same-tab.test.tsx` | Multiple hook instances in one tab — source isolation, dedup, namespace, keepLatestMessage, rapid bursts    |
| `BroadcastProvider.test.tsx`            | Provider wiring, context consumption, error boundary, cleanup                                               |
| `messageUtils.test.ts`                  | All utility functions — isValidMessage, createMessage, debounce, internal types                             |
| `debug.test.ts`                         | Debug logger — enabled/disabled, all log methods                                                            |

Tests use a `MockBroadcastChannel` that delivers messages synchronously to all channels on the same name. Two variants exist:

- Main test file: fully synchronous delivery (no `setTimeout`)
- Same-tab test file: asynchronous delivery (`setTimeout(0)`) to simulate real browser behavior

Run tests:

```bash
npm test                          # all tests
npm test -- --watch               # watch mode
npm test -- --coverage            # with coverage report
```

---

## Changes Made

### v1.7.0 — `feat: add onMessage callbacks with per-type handler map`

#### New feature: `onMessage` callbacks

**Files:** `src/types/types.ts`, `src/hooks/useBroadcastChannel.ts`

Added two new exported types:

```typescript
type MessageCallback = (msg: BroadcastMessage) => void;
type OnMessageMap = { [type: string]: MessageCallback };
```

And a new `onMessage` field on `BroadcastOptions`:

```typescript
onMessage?: MessageCallback | OnMessageMap;
```

Implemented in the hook via the "always-current ref" pattern — `onMessageRef.current = onMessage` is assigned synchronously on every render so the ref is always up to date. The callback is invoked at the end of `handleMessage`, after `setMessages`, in an isolated try/catch. This means:

- A callback throwing never breaks message state
- Errors in callbacks are debug-logged with `action: 'onMessage'`
- `onMessage` is never in any `useCallback` dep array (read through ref at call time)

#### Bug fix: `isValidMessage` strengthened

**File:** `src/utils/messageUtils.ts`

Old: only checked `'id' in message`. A message like `{ id: 123 }` would pass.

New: validates all four required fields with correct primitive types:

```typescript
typeof message.id === 'string' &&
  typeof message.type === 'string' &&
  typeof message.source === 'string' &&
  typeof message.timestamp === 'number';
```

#### Bug fix: `stableRegisteredTypes` anti-pattern removed

**File:** `src/hooks/useBroadcastChannel.ts`

Old: `useMemo(() => registeredTypes, [JSON.stringify(registeredTypes)])` — using `JSON.stringify` in a dep array is a code smell and ESLint anti-pattern.

New: replaced with the standard "always-current ref" pattern:

```typescript
const registeredTypesRef = useRef<string[]>(registeredTypes);
registeredTypesRef.current = registeredTypes;
```

`handleMessage` reads `registeredTypesRef.current` instead, and `stableRegisteredTypes` was removed from its dep array. This also reduces how often `handleMessage` is recreated (which previously caused the channel to be torn down and recreated).

#### Bug fix: `clearSentMessages` missing deps

**File:** `src/hooks/useBroadcastChannel.ts`

Old: `useCallback(..., [])` — empty deps despite using `source` and `internalTypes.CLEAR_SENT_MESSAGES` inside.

New: `useCallback(..., [source, internalTypes.CLEAR_SENT_MESSAGES])` — only the two values actually read inside are listed. `channel` is a ref and correctly stays out.

#### Tests added (45 new)

- `messageUtils.test.ts`: replaced single `isValidMessage` test with 9 cases covering all valid and invalid shapes
- `useBroadcastChannel.test.tsx`:
  - `describe('registeredTypes ref')`: 2 tests verifying filter updates after re-render
  - `describe('onMessage callbacks')`: 10 tests covering catch-all, type-map, unregistered type, self-message, registeredTypes filter, expiry, deduplication, alongside-state, stale-closure, throwing callback, batched messages

---

## Roadmap

The following features are planned in priority order. See `OVERVIEW.md` for implementation detail on each.

### Priority 2 — `BroadcastProvider` Options Support

**Status:** Planned

Currently `BroadcastProvider` only accepts `channelName` and `children`. It silently ignores all `BroadcastOptions`. Add an `options?: BroadcastOptions` prop and forward it to `useBroadcastChannel`.

```typescript
<BroadcastProvider channelName="alerts" options={{ registeredTypes: ['alert'], onMessage: cb }}>
  <AlertBar />
</BroadcastProvider>
```

---

### Priority 3 — Channel Auto-Recovery

**Status:** Planned

If a `BroadcastChannel` is closed unexpectedly (browser memory pressure, background tab throttling), the hook currently goes silent forever. Auto-recovery will detect this and reconnect.

**New options:**

```typescript
autoReconnect?: boolean;       // default: true
reconnectDelayMs?: number;     // default: 1000
maxReconnectAttempts?: number; // default: 5
```

**New return values:**

```typescript
isReconnecting: boolean;
reconnectCount: number;
```

**Mechanism:** Listen for `messageerror` events. On error, close old channel → wait `reconnectDelayMs` → create new `BroadcastChannel` → re-attach listener. Stop after `maxReconnectAttempts`.

---

### Priority 4 — Cross-tab History (`withHistory`)

**Status:** Planned

When a new tab connects, it can request the message history from already-open tabs. The responding tab sends its current `messages` in chunks to stay within serialization limits.

**New options:**

```typescript
withHistory?: boolean;       // auto-request history on connect; default: false
historyMaxMessages?: number; // max messages per response; default: 50
historyChunkSize?: number;   // messages per chunk; default: 20
```

**New methods:**

```typescript
requestHistory(): void;
respondWithHistory(): void;
```

**New internal message types:** `REQUEST_HISTORY`, `RESPOND_HISTORY_CHUNK`

**How it works:**

1. New tab opens with `withHistory: true` → broadcasts `REQUEST_HISTORY`
2. Each existing tab splits its `messages` into chunks (filtered: non-expired, matching `registeredTypes`, capped at `historyMaxMessages`) and sends each as `RESPOND_HISTORY_CHUNK`
3. New tab assembles chunks, deduplicates via `receivedMessageIds`, merges into state sorted by timestamp

**Chunk payload shape:**

```typescript
{
  requesterId: string;
  chunkIndex: number;
  totalChunks: number;
  messages: BroadcastMessage[];
}
```

---

### Priority 5 — Playwright Integration Tests

**Status:** Planned

Add real browser cross-tab tests using Playwright, which are fundamentally impossible to replicate with jsdom mocks.

**New files:**

- `playwright.config.ts`
- `tests/integration/cross-tab-messaging.test.ts`
- `tests/integration/history.test.ts`
- `tests/integration/callbacks.test.ts`
- `tests/integration/reconnect.test.ts`

**Test scenarios:**

- Tab A sends typed message → Tab B (matching `registeredType`) receives; Tab C (different type) does not
- Tab A sends 10 messages → Tab B opens → `requestHistory()` → Tab B state populates
- Tab A sends → Tab B `onMessage` callback fires
- Force-close Tab A's channel → auto-recovery → Tab B sends → Tab A receives again
- 5 rapid messages from Tab A → Tab B receives all (batch or individual)
- Duplicate message ID → Tab B only shows one entry

New npm script: `test:integration`. New CI job in `.github/workflows/ci.yml`.
