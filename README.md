# react-broadcast-sync

A lightweight React hook for syncing state and communication across browser tabs using the BroadcastChannel API. This package provides a clean and type-safe abstraction over the native API, enabling efficient, scoped, and reliable cross-tab messaging.

## ✨ Features

- 🚀 Simple and intuitive API
- 🔄 Real-time synchronization across tabs
- ✅ TypeScript support
- 📦 Zero dependencies
- 🧹 Automatic message expiration and cleanup
- 🧪 Send/receive any serializable message
- 🧩 Namespace and source scoping support
- 🔒 Clear individual or all messages
- ✅ Only accept allowed message types (optional)
- 🧠 `BroadcastProvider` for context-based usage

---

## 📦 Installation

```bash
npm install react-broadcast-sync
# or
yarn add react-broadcast-sync
# or
pnpm add react-broadcast-sync
```

---

## 🚀 Quick Start

### 🔧 Basic Usage

```tsx
import { useBroadcastChannel } from 'react-broadcast-sync';

function MyComponent() {
  const { messages, postMessage, clearMessage } = useBroadcastChannel('my-channel');

  const handleSend = () => {
    postMessage('greeting', { text: 'Hello from another tab!' });
  };

  return (
    <>
      <button onClick={handleSend}>Send</button>
      {messages.map((msg) => (
        <div key={msg.id}>
          {msg.message.text}
          <button onClick={() => clearMessage(msg.id)}>Clear</button>
        </div>
      ))}
    </>
  );
}
```

---

### ⚙️ Advanced Usage

```tsx
const {
  channelName,
  messages,
  sentMessages,
  postMessage,
  clearMessage,
  clearAllMessages,
  clearSentMessage,
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

#### 💬 Sending a message with expiration:

```tsx
postMessage('notification', { text: 'This disappears in 5s' }, { expirationDuration: 5000 });
```

---

### 🧩 Using `BroadcastProvider`

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
      {messages.map((msg) => (
        <p key={msg.id}>{msg.message.text}</p>
      ))}
    </div>
  );
}
```

---

## 📘 API Reference

### `useBroadcastChannel` Hook

```typescript
const {
  channelName,
  messages,
  sentMessages,
  postMessage,
  clearMessage,
  clearAllMessages,
  clearSentMessage,
  error
} = useBroadcastChannel(channelName, options);
```

#### Options

```typescript
interface BroadcastOptions {
  sourceName?: string;           // Custom name for the message source
  cleaningInterval?: number;     // Interval in ms for cleaning expired messages (default: 1000)
  keepLatestMessage?: boolean;   // Keep only the latest message (default: false)
  registeredTypes?: string[];    // List of allowed message types
  namespace?: string;           // Channel namespace for isolation
  deduplicationTTL?: number;    // Time in ms to keep message IDs for deduplication (default: 5 minutes)
  cleanupDebounceMs?: number;   // Debounce time in ms for cleanup operations (default: 0)
}
```

#### Default Values

| Option              | Default Value | Description |
|---------------------|---------------|-------------|
| `sourceName`        | `undefined`   | Auto-generated if not provided |
| `cleaningInterval`  | `1000`        | 1 second between cleanup runs |
| `keepLatestMessage` | `false`       | Keep all messages by default |
| `registeredTypes`   | `[]`          | Accept all message types by default |
| `namespace`         | `''`          | No namespace by default |
| `deduplicationTTL`  | `300000`      | 5 minutes (5 * 60 * 1000 ms) |
| `cleanupDebounceMs` | `0`           | No debounce by default |

#### Return Value

```typescript
interface BroadcastActions {
  channelName: string;          // The resolved channel name (includes namespace)
  messages: BroadcastMessage[]; // Received messages
  sentMessages: BroadcastMessage[]; // Messages sent by this instance
  postMessage: (type: string, content: any, options?: SendMessageOptions) => void;
  clearMessage: (id: string) => void;
  clearAllMessages: () => void;
  clearSentMessage: (id: string) => void;
  error: string | null;        // Current error state
}
```

### `useBroadcastChannel(channelName, options?)`

Returns an object with:

| Property              | Type                    | Description |
|-----------------------|-------------------------|-------------|
| `channelName`         | `string`                | The resolved channel name (includes namespace) |
| `messages`            | `BroadcastMessage[]`    | All received messages from other tabs |
| `sentMessages`        | `BroadcastMessage[]`    | Messages sent from this tab |
| `postMessage()`       | `function`              | Send a message to all tabs |
| `clearMessage()`      | `function`              | Remove a message locally and notify others to clear it |
| `clearAllMessages()`  | `function`              | Remove all messages locally and notify others |
| `clearSentMessage()`  | `function`              | Remove a sent message without affecting others |
| `error`               | `string \| null`        | Any runtime error from the channel |

#### 📨 Send Options:

```ts
interface SendMessageOptions {
  expirationDuration?: number;  // TTL in ms
  expirationDate?: number;      // Exact expiry timestamp
}
```

#### 📩 Message Format:

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

---

## ✅ Best Practices

- **Use `namespace`** to isolate functionality between different app modules.
- **Register allowed message types** using `registeredTypes` to avoid processing unknown or irrelevant messages.
- **Always handle `error`** state in UI or logs to detect channel failures.
- **Use `keepLatestMessage: true`** if you only care about the most recent message (e.g. status updates).
- **Set appropriate `deduplicationTTL`** based on your message frequency and importance.
- **Use `cleanupDebounceMs`** when dealing with rapid message updates to prevent performance issues.

## 🎯 Common Use Cases

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

## 🔧 Performance Considerations

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

### Memory Management
- Clear messages when they're no longer needed using `clearMessage` or `clearAllMessages`
- Use message expiration for temporary data
- Consider using `keepLatestMessage: true` for status updates to prevent memory buildup

## 🚨 Troubleshooting

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

## ⚡ Performance Considerations

1. **Message Size**
   - Keep messages small and serializable
   - Avoid sending large objects or circular references
   - Consider using message IDs to reference larger data

2. **Message Frequency**
   - Use `keepLatestMessage: true` for high-frequency updates
   - Implement debouncing for rapid state changes
   - Consider using `expirationDuration` for temporary messages

3. **Memory Management**
   - Clear messages when they're no longer needed
   - Use `cleaningInterval` to automatically remove expired messages
   - Implement proper cleanup in component unmount

## 🧪 Testing

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

## 🌐 Browser Support

Relies on [BroadcastChannel API](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel):

- ✅ Chrome 54+
- ✅ Firefox 38+
- ✅ Edge 79+
- ✅ Safari 15.4+
- ✅ Opera 41+

---

## 🤝 Contributing

PRs and feature suggestions welcome! Open an issue or submit a pull request.

---

## 🪪 License

MIT © [Idan Shalem](https://github.com/IdanShalem)
