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

### `useBroadcastChannel(channelName, options?)`

Returns an object with:

| Property              | Type                    | Description |
|-----------------------|-------------------------|-------------|
| `messages`            | `BroadcastMessage[]`    | All received messages from other tabs |
| `sentMessages`        | `BroadcastMessage[]`    | Messages sent from this tab |
| `postMessage()`       | `function`              | Send a message to all tabs |
| `clearMessage()`      | `function`              | Remove a message locally and notify others to clear it |
| `clearAllMessages()`  | `function`              | Remove all messages locally and notify others |
| `clearSentMessage()`  | `function`              | Remove a sent message without affecting others |
| `error`               | `string \| null`        | Any runtime error from the channel |

#### 🔧 Options (second argument):

```ts
interface BroadcastOptions {
  sourceName?: string;           // Optional custom ID for this tab
  cleaningInterval?: number;     // Interval (ms) for cleaning expired messages (default: 1000)
  keepLatestMessage?: boolean;   // If true, only latest message is kept
  registeredTypes?: string[];    // If defined, only accepts listed types
  namespace?: string;            // App-specific namespace for the channel
}
```

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

## 🔄 Combining Hook and Provider

You can use both the hook and provider approaches in the same application. This is useful when you need both global state and component-specific channels:

```tsx
function App() {
  return (
    <BroadcastProvider channelName="global-state">
      <GlobalStateComponent />
      <LocalStateComponent />
    </BroadcastProvider>
  );
}

// Uses the global channel from provider
function GlobalStateComponent() {
  const { messages } = useBroadcastProvider();
  return <div>{/* Use global messages */}</div>;
}

// Uses its own channel with the hook
function LocalStateComponent() {
  const { messages } = useBroadcastChannel('local-state');
  return <div>{/* Use local messages */}</div>;
}
```

## 🚨 Troubleshooting

### Common Issues

1. **Channel Not Working**
   - Ensure you're using a supported browser
   - Check if the channel name is consistent across tabs
   - Verify that the namespace is the same if using one

2. **Messages Not Received**
   - Check if `registeredTypes` includes the message type you're sending
   - Verify that the message source isn't the same as the receiver
   - Ensure the message hasn't expired

3. **TypeScript Errors**
   - Make sure you're using TypeScript 4.0 or higher
   - Check that your message types are properly defined
   - Verify that the message content is serializable

### Debug Mode

Enable debug logging by setting the environment variable:

```bash
REACT_APP_DEBUG_BROADCAST=true
```

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
