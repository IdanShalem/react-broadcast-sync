<p align="center">
  <img src="./assets/react-broadcast-sync-logo.png" alt="react-broadcast-sync logo" width="300" />
</p>

<p align="center">

# react-broadcast-sync

</p>

<p align="center">
  <a href="https://github.com/IdanShalem/react-broadcast-sync/actions/workflows/ci.yml">
    <img alt="CI" src="https://github.com/IdanShalem/react-broadcast-sync/actions/workflows/ci.yml/badge.svg" />
  </a>
  <a href="https://codecov.io/gh/IdanShalem/react-broadcast-sync">
    <img alt="Coverage" src="https://codecov.io/gh/IdanShalem/react-broadcast-sync/branch/main/graph/badge.svg" />
  </a>
  <a href="https://www.npmjs.com/package/react-broadcast-sync">
    <img alt="NPM Version" src="https://img.shields.io/npm/v/react-broadcast-sync.svg" />
  </a>
  <a href="https://www.npmjs.com/package/react-broadcast-sync">
    <img alt="NPM Downloads" src="https://img.shields.io/npm/dm/react-broadcast-sync.svg" />
  </a>
  <a href="https://bundlephobia.com/result?p=react-broadcast-sync">
    <img alt="Bundlephobia" src="https://badgen.net/bundlephobia/minzip/react-broadcast-sync" />
  </a>
  <a href="https://opensource.org/licenses/MIT">
    <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-blue.svg" />
  </a>
  <a href="https://github.com/IdanShalem/react-broadcast-sync/issues">
    <img alt="GitHub issues" src="https://img.shields.io/github/issues/IdanShalem/react-broadcast-sync" />
  </a>
</p>

Easily sync UI state or user events across browser tabs in React apps — notifications, presence, forms, and more. This package provides a clean and type-safe abstraction over the native API, enabling efficient, scoped, and reliable cross-tab messaging.

<p align="center">
  <img src="https://raw.githubusercontent.com/IdanShalem/react-broadcast-sync/main/demo/react-broadcast-sync-demo/public/assets/react-broadcast-sync-demo-video.gif" alt="React Broadcast Sync Demo" width="600" />
</p>

## Table of Contents

- [Features](#features)
- [Demo App](#demo-app)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Advanced Usage](#️advanced-usage)
- [BroadcastProvider](#using-broadcastprovider)
- [API Reference](#api-reference)
- [Best Practices](#best-practices)
- [Common Use Cases](#common-use-cases)
- [Performance Considerations](#performance-considerations)
- [Troubleshooting](#-roubleshooting)
- [Testing](#testing)
- [Browser Support](#browser-support)
- [Coming Soon](#coming-soon)
- [Versioning & Releases](#versioning--releases)
- [Contributing](#contributing)
- [License](#license)

## Features

- Simple and intuitive API
- Real-time synchronization across tabs
- TypeScript support
- Zero dependencies
- Automatic message expiration and cleanup
- Send/receive any serializable message
- Namespace and source scoping support
- Clear individual or all messages
- Only accept allowed message types (optional)
- `BroadcastProvider` for context-based usage
- **Ping and active source detection** (discover other tabs and their source names)

## Demo App

Check out our [live demo](https://react-broadcast-sync-3w3m.vercel.app/) to see the library in action! The demo showcases three main features:

1. **Counter Synchronization**

   - Real-time counter updates across tabs
   - Visual feedback for sync status
   - Smooth animations

2. **Text Synchronization**

   - Real-time text input sync
   - Multi-line support
   - Instant updates

3. **Todo List**
   - Synchronized todo items
   - Real-time hover effects
   - Scroll position sync
   - Completion status sync
   - Delete functionality

The demo is built with React 19, TypeScript, Material-UI, and Framer Motion. You can find the source code in the [demo directory](./demo/react-broadcast-sync-demo).

---

## Installation

```bash
npm install react-broadcast-sync
# or
yarn add react-broadcast-sync
# or
pnpm add react-broadcast-sync
```

---

## Quick Start

### Basic Usage

```tsx
import { useBroadcastChannel } from 'react-broadcast-sync';

function MyComponent() {
  const { messages, postMessage, clearReceivedMessages } = useBroadcastChannel('my-channel');

  const handleSend = () => {
    postMessage('greeting', { text: 'Hello from another tab!' });
  };

  return (
    <>
      <button onClick={handleSend}>Send</button>
      {messages.map(msg => (
        <div key={msg.id}>
          {msg.message.text}
          <button onClick={() => clearReceivedMessages({ ids: [msg.id] })}>Clear</button>
        </div>
      ))}
    </>
  );
}
```

---

### Advanced Usage

```tsx
const {
  channelName,
  messages,
  sentMessages,
  postMessage,
  clearReceivedMessages,
  clearSentMessages,
  error,
} = useBroadcastChannel('my-channel', {
  sourceName: 'my-tab',
  cleaningInterval: 2000,
  keepLatestMessage: true,
  registeredTypes: ['greeting', 'notification'],
  namespace: 'my-app',
  deduplicationTTL: 10 * 60 * 1000, // 10 minutes
  cleanupDebounceMs: 500, // Debounce cleanup operations by 500ms
});
```

#### Sending a message with expiration:

```tsx
postMessage('notification', { text: 'This disappears in 5s' }, { expirationDuration: 5000 });
```

---

### Using `BroadcastProvider`

You can wrap part of your app with `BroadcastProvider` and use `useBroadcastProvider()` to consume the channel context.

```tsx
import { BroadcastProvider, useBroadcastProvider } from 'react-broadcast-sync';

function App() {
  return (
    <BroadcastProvider channelName="notifications">
      <NotificationBar />
    </BroadcastProvider>
  );
}

function NotificationBar() {
  const { messages } = useBroadcastProvider();

  return (
    <div>
      {messages.map(msg => (
        <p key={msg.id}>{msg.message.text}</p>
      ))}
    </div>
  );
}
```

---

## API Reference

### `useBroadcastChannel` Hook

```typescript
const {
  channelName,
  messages,
  sentMessages,
  postMessage,
  clearReceivedMessages,
  clearSentMessages,
  error,
} = useBroadcastChannel(channelName, options);
```

#### Options

```typescript
interface BroadcastOptions {
  sourceName?: string; // Custom name for the message source
  cleaningInterval?: number; // Interval in ms for cleaning expired messages (default: 1000)
  keepLatestMessage?: boolean; // Keep only the latest message (default: false)
  registeredTypes?: string[]; // List of allowed message types
  namespace?: string; // Channel namespace for isolation
  deduplicationTTL?: number; // Time in ms to keep message IDs for deduplication (default: 5 minutes)
  cleanupDebounceMs?: number; // Debounce time in ms for cleanup operations (default: 0)
  batchingDelayMs?: number; // Delay in ms to batch outgoing messages (default: 20). If > 0, messages are batched and sent together.
  excludedBatchMessageTypes?: string[]; // Message types to always send immediately, never batched (default: []).
}
```

#### Default Values

| Option                      | Default Value | Description                         |
| --------------------------- | ------------- | ----------------------------------- |
| `sourceName`                | `undefined`   | Auto-generated if not provided      |
| `cleaningInterval`          | `1000`        | 1 second between cleanup runs       |
| `keepLatestMessage`         | `false`       | Keep all messages by default        |
| `registeredTypes`           | `[]`          | Accept all message types by default |
| `namespace`                 | `''`          | No namespace by default             |
| `deduplicationTTL`          | `300000`      | 5 minutes (5 _ 60 _ 1000 ms)        |
| `cleanupDebounceMs`         | `0`           | No debounce by default              |
| `batchingDelayMs`           | `20`          | Batch delay in ms (0 = off)         |
| `excludedBatchMessageTypes` | `[]`          | Types never batched                 |

#### Return Value

```typescript
interface BroadcastActions {
  channelName: string; // The resolved channel name (includes namespace)
  messages: BroadcastMessage[]; // Received messages
  sentMessages: BroadcastMessage[]; // Messages sent by this instance
  postMessage: (type: string, content: any, options?: SendMessageOptions) => void;
  clearReceivedMessages: (opts?: { ids?: string[]; types?: string[]; sources?: string[] }) => void;
  clearSentMessages: (opts?: { ids?: string[]; types?: string[]; sync?: boolean }) => void;
  getLatestMessage: (opts?: { type?: string; source?: string }) => BroadcastMessage | null;
  closeChannel: () => void;
  error: string | null; // Current error state
}
```

### `useBroadcastChannel(channelName, options?)`

Returns an object with:

| Property                  | Type                 | Description                                                                                                                                                                                  |
| ------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `channelName`             | `string`             | The resolved channel name (includes namespace)                                                                                                                                               |
| `messages`                | `BroadcastMessage[]` | All received messages from other tabs                                                                                                                                                        |
| `sentMessages`            | `BroadcastMessage[]` | Messages sent from this tab                                                                                                                                                                  |
| `postMessage()`           | `function`           | Send a message to all tabs                                                                                                                                                                   |
| `clearReceivedMessages()` | `function`           | Clear received messages. No filters ⇒ clear all. With filters, a message is deleted only if it matches **every** provided filter (`ids`, `types`, `sources`). Empty arrays act as wildcards. |
| `clearSentMessages()`     | `function`           | Clear messages this tab sent (same matching rules). Pass `sync: true` to broadcast the clear to other tabs.                                                                                  |
| `getLatestMessage()`      | `function`           | Get the latest message matching optional filters (`type`, `source`). Returns the most recent message that matches, or `null` if none.                                                        |
| `ping(timeoutMs?)`        | `function`           | Ping other tabs on the channel and collect their source names. `timeoutMs` (default: 300ms) controls how long to wait for responses before resolving. Returns a Promise of string array.     |
| `isPingInProgress`        | `boolean`            | `true` while a ping is active, otherwise `false`.                                                                                                                                            |
| `closeChannel()`          | `function`           | Explicitly closes the broadcast channel and removes event listeners. Safe to call multiple times.                                                                                            |
| `error`                   | `string \| null`     | Any runtime error from the channel                                                                                                                                                           |

#### Clearing examples

```tsx
// Clear everything we've received
clearReceivedMessages();

// Clear all messages we sent and broadcast the clear to other tabs
clearSentMessages({ sync: true });

// Clear by id or by type (OR inside each array)
clearReceivedMessages({ ids: ['123'] }); // id match
clearReceivedMessages({ types: ['alert', 'chat'] }); // type match

// Combine filters (logical AND between filters)
// Removes messages whose id is '123' AND type is 'alert'
clearSentMessages({ ids: ['123'], types: ['alert'] });
```

#### Send Options:

```ts
interface SendMessageOptions {
  expirationDuration?: number; // TTL in ms
  expirationDate?: number; // Exact expiry timestamp
}
```

#### Message Format:

```ts
interface BroadcastMessage {
  id: string;
  type: string;
  message: any;
  timestamp: number;
  source: string;
  expirationDate?: number;
}
```

#### Getting the Latest Message

You can use `getLatestMessage` to retrieve the most recent message received, optionally filtered by `type` and/or `source`. If no options are provided, it returns the latest message of any kind. If no message matches, it returns `null`.

**Signature:**

```ts
getLatestMessage(options?: { type?: string; source?: string }): BroadcastMessage | null
```

**Examples:**

```tsx
// Get the latest message of any type/source
const latest = getLatestMessage();

// Get the latest message of a specific type
const latestAlert = getLatestMessage({ type: 'alert' });

// Get the latest message from a specific source
const latestFromTab = getLatestMessage({ source: 'tab-123' });

// Get the latest message of a specific type from a specific source
const latestInfoFromTab = getLatestMessage({ type: 'info', source: 'tab-123' });

// Check if there are any messages of a type
if (getLatestMessage({ type: 'notification' })) {
  // ...
}
```

**Behavior:**

- If no messages are present, returns `null`.
- If no message matches the filter, returns `null`.
- If multiple messages match, returns the most recently received one.

#### Ping & Active Source Detection

`useBroadcastChannel` provides a `ping` method and an `isPingInProgress` state for discovering active sources (tabs) on the same channel.

- **`ping(timeoutMs?: number): Promise<string[]>`**: Broadcasts a ping and collects responses from other tabs within the timeout. Returns an array of source names (excluding your own).
- **`isPingInProgress: boolean`**: Indicates if a ping is currently in progress.

**Example:**

```tsx
const { ping, isPingInProgress } = useBroadcastChannel('my-channel', {
  sourceName: 'my-tab',
});

// To discover other active sources:
const activeSources = await ping(300); // e.g., ['tab-2', 'tab-3']

// To show loading state:
if (isPingInProgress) {
  // Show spinner or status
}
```

#### Closing the Channel Explicitly

You can use `closeChannel` to explicitly close the underlying BroadcastChannel and remove all event listeners. This is useful if you want to clean up resources before the component unmounts, or to stop all cross-tab communication on demand. Note that the channel will automatically close and all event listeners will be removed when the component unmounts, so this method is mainly useful for manual cleanup.

**Signature:**

```ts
closeChannel(): void
```

**Example:**

```tsx
const { closeChannel } = useBroadcastChannel('my-channel');

// ... later, when you want to stop all communication:
closeChannel();
```

**Notes:**

- After calling `closeChannel`, the channel is closed and will not send or receive any more messages.
- It is safe to call `closeChannel` multiple times (idempotent).
- You do not need to call this for normal React unmounting; the hook will clean up automatically. Use it for explicit/manual cleanup only.

---

## Best Practices

- **Use `namespace`** to isolate functionality between different app modules.
- **Register allowed message types** using `registeredTypes` to avoid processing unknown or irrelevant messages.
- **Always handle `error`** state in UI or logs to detect channel failures.
- **Use `keepLatestMessage: true`** if you only care about the most recent message (e.g. status updates).
- **Set appropriate `deduplicationTTL`** based on your message frequency and importance.
- **Use `cleanupDebounceMs`** when dealing with rapid message updates to prevent performance issues.

## Common Use Cases

### Real-time Notifications

```tsx
function NotificationSystem() {
  const { messages, postMessage } = useBroadcastChannel('notifications', {
    keepLatestMessage: true,
    registeredTypes: ['alert', 'info', 'warning'],
    deduplicationTTL: 60000, // 1 minute
  });

  return (
    <div>
      {messages.map(msg => (
        <Notification key={msg.id} type={msg.type} content={msg.message} />
      ))}
    </div>
  );
}
```

### Multi-tab Form Synchronization

```tsx
function FormSync() {
  const { messages, postMessage } = useBroadcastChannel('form-sync', {
    namespace: 'my-form',
    cleaningInterval: 5000,
  });

  const handleChange = (field: string, value: string) => {
    postMessage('field-update', { field, value }, { expirationDuration: 300000 }); // 5 minutes
  };

  return <Form onChange={handleChange} />;
}
```

### Tab Status Synchronization

```tsx
function TabStatus() {
  const { postMessage } = useBroadcastChannel('tab-status', {
    sourceName: 'main-tab',
    keepLatestMessage: true,
  });

  useEffect(() => {
    postMessage('tab-active', { timestamp: Date.now() });
    return () => postMessage('tab-inactive', { timestamp: Date.now() });
  }, []);

  return null;
}
```

## Performance Considerations

### Message Size

- Keep messages small and serializable
- Avoid sending large objects or circular references
- Consider using message IDs to reference larger data

### Message Frequency

- Use `keepLatestMessage: true` for high-frequency updates
- Implement debouncing for rapid state changes
- Consider using `expirationDuration` for temporary messages

#### Batching Mechanism

**Batching** allows you to group multiple outgoing messages and send them together in a single post to the BroadcastChannel. This can significantly reduce the number of cross-tab events, improve performance, and avoid flooding the channel when many messages are sent in rapid succession (e.g., during fast typing or bulk updates).

- **batchingDelayMs**: If set to a value greater than 0 (default: 20ms), outgoing messages are collected for up to this delay and then sent as an array. If 0 or negative, batching is disabled and all messages are sent immediately.
- **excludedBatchMessageTypes**: An array of message types that should always be sent immediately, even if batching is enabled. Use this for urgent or high-priority messages (e.g., 'alert', 'sync-now').

**How it works:**

- When batching is enabled, calls to `postMessage` within the batching window are buffered and sent as a batch (array of messages) after the delay.
- On the receiving side, the hook automatically handles both single messages and batches (arrays). If you listen to the channel directly, always check if `Array.isArray(event.data)`.
- If the tab unmounts or the channel closes, any unsent batched messages are flushed immediately.

**Why batching matters:**

- Reduces the number of events and improves efficiency, especially for high-frequency updates.
- Prevents message storms that can occur when many updates happen in a short time.
- Lets you control which messages are always sent immediately for real-time needs.

**Example:**

```tsx
const { postMessage } = useBroadcastChannel('my-channel', {
  batchingDelayMs: 50, // Batch messages for up to 50ms
  excludedBatchMessageTypes: ['alert'], // Always send 'alert' immediately
});

// These will be batched if sent within 50ms
postMessage('edit', { field: 'a', value: 1 });
postMessage('edit', { field: 'b', value: 2 });
// This will be sent immediately
postMessage('alert', { message: 'Something happened!' });
```

### Memory Management

- Clear messages when they're no longer needed using `clearReceivedMessages` / `clearSentMessages`
- Use `cleaningInterval` to automatically remove expired messages
- Implement proper cleanup in component unmount

### Message Deduplication

The `deduplicationTTL` option creates a time window (in milliseconds) during which messages with the same content and type from the same source are considered duplicates and will be ignored. This is particularly useful for:

- **Preventing Message Loops**: Avoids infinite message echo between tabs when they broadcast the same message back and forth
- **Reducing Redundancy**: Filters out identical messages sent in rapid succession, preventing unnecessary processing
- **Natural Debouncing**: Provides built-in debouncing behavior for broadcast events without additional code

Recommended TTL values based on use case:

- **High-frequency updates** (e.g., real-time typing, cursor position): 1000-5000ms
- **Medium-frequency updates** (e.g., form sync, status changes): 5000-15000ms
- **Low-frequency updates** (e.g., notifications, alerts): 15000-30000ms

Example:

```tsx
// Without deduplication, this could cause a message loop
function ChatComponent() {
  const { postMessage } = useBroadcastChannel('chat', {
    deduplicationTTL: 5000, // Ignore duplicate messages for 5 seconds
  });

  const handleMessage = (text: string) => {
    postMessage('chat-message', { text });
  };
}
```

### Cleanup Optimization

- Use `cleanupDebounceMs` to prevent excessive cleanup operations
- Recommended values:
  - For frequent updates: 500-1000ms
  - For infrequent updates: 0ms (no debounce)
- Adjust `cleaningInterval` based on your message expiration needs

## Troubleshooting

### Common Issues

1. **Messages Not Received**

   - Check if `registeredTypes` includes your message type
   - Verify the channel name and namespace match
   - Ensure the message hasn't expired
   - Check if `deduplicationTTL` isn't too short

2. **Performance Issues**

   - Increase `cleanupDebounceMs` if cleanup is too frequent
   - Use `keepLatestMessage: true` for high-frequency updates
   - Consider increasing `cleaningInterval` if cleanup is too aggressive

3. **Memory Leaks**
   - Ensure proper cleanup in component unmount
   - Use message expiration for temporary data
   - Clear messages when they're no longer needed

### Debug Mode

Enable debug logging by setting the environment variable:

```bash
REACT_APP_DEBUG_BROADCAST=true
```

This will log:

- Channel creation and closure
- Message sending and receiving
- Cleanup operations
- Error states

## Testing

### Unit Testing

```tsx
import { renderHook, act } from '@testing-library/react-hooks';
import { useBroadcastChannel } from 'react-broadcast-sync';

test('should send and receive messages', () => {
  const { result } = renderHook(() => useBroadcastChannel('test-channel'));

  act(() => {
    result.current.postMessage('test', { data: 'hello' });
  });

  expect(result.current.messages).toHaveLength(1);
  expect(result.current.messages[0].message.data).toBe('hello');
});
```

### Integration Testing

```tsx
import { render, screen } from '@testing-library/react';
import { BroadcastProvider } from 'react-broadcast-sync';

test('should render messages from provider', () => {
  render(
    <BroadcastProvider channelName="test-channel">
      <TestComponent />
    </BroadcastProvider>
  );

  // Your test assertions here
});
```

---

## Browser Support

Relies on [BroadcastChannel API](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel):

- ✅ Chrome 54+
- ✅ Firefox 38+
- ✅ Edge 79+
- ✅ Safari 15.4+
- ✅ Opera 41+

---

## Coming Soon

We're actively improving `react-broadcast-sync`! Here are some features and enhancements planned for upcoming versions:

- **Integration Tests**  
  Ensure robust behavior and edge-case coverage.

- **Automatic Channel Recovery**  
  Reconnect automatically if the `BroadcastChannel` gets disconnected or closed by the browser.

- **`clearMessagesByType()`**  
  Clear all messages of a specific type with a single call.

- **Per-Type Callbacks**  
  Define message handlers for specific types with `onMessage({ type, callback })`.

- **`clearAllSentMessages()` / `clearAllReceivedMessages()`**  
  Fine-grained control for clearing messages based on source.

We're committed to keeping this package lightweight, flexible, and production-ready.  
Your feedback and contributions are welcome — feel free to [open an issue](https://github.com/IdanShalem/react-broadcast-sync/issues)!

---

## Versioning & Releases

This project uses [Semantic Release](https://semantic-release.gitbook.io/) for fully automated versioning and changelog generation.

Every push to the `main` branch with a [Conventional Commit](https://www.conventionalcommits.org/en/v1.0.0/) message triggers a release that includes:

- ✅ Automatic semantic version bump (`major`, `minor`, or `patch`)
- ✅ Changelog generation and publishing to GitHub Releases
- ✅ Publishing to [npm](https://www.npmjs.com/package/react-broadcast-sync)

### Example Commit Messages

```bash
feat: add support for per-type callbacks
fix: debounce cleanup runs properly on tab reload
chore: update dependencies

---

## Contributing

PRs and feature suggestions welcome! Open an issue or submit a pull request.

---

## License

MIT © [Idan Shalem](https://github.com/IdanShalem)
```
