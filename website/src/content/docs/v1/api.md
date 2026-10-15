---
title: v1.11.2 message API
description: Read-only documentation reconstructed from react-broadcast-sync 1.11.2 sources.
---

:::caution[Read-only v1.11.2 archive]
Reconstructed from the published **1.11.2** tag, not copied from v2 documentation. This is a fixed historical snapshot, not coverage of every v1 minor release or a promise of ongoing v1 maintenance. New projects should use [current v2 docs](/getting-started/). [Version scope and migration](/changelog/).
:::

## Hook

```tsx
const actions = useBroadcastChannel(channelName, options);
```

Use the same channel and namespace in communicating tabs. `namespace` is appended to the channel name; each hook owns its connection and local log. Same-source messages are filtered out.

## Options

| Option                      | Default in 1.11.2 | Meaning                                                                               |
| --------------------------- | ----------------- | ------------------------------------------------------------------------------------- |
| `sourceName`                | generated         | Unique sender identity; sharing it makes tabs ignore each other.                      |
| `cleaningInterval`          | `1000`            | Expired-message cleanup interval in ms.                                               |
| `keepLatestMessage`         | `false`           | Keep one last accepted arrival across all types in `messages`; no ordering or replay. |
| `registeredTypes`           | `[]`              | Empty accepts all application types; otherwise allow only listed types.               |
| `namespace`                 | `''`              | Channel scope suffix.                                                                 |
| `deduplicationTTL`          | `300000`          | Ignore repeated message IDs within this ms window. Not content deduplication.         |
| `cleanupDebounceMs`         | `0`               | Debounce cleanup; runtime default is 0 despite a conflicting old type comment.        |
| `batchingDelayMs`           | `20`              | Buffer sends in ms; 0 or negative sends immediately.                                  |
| `excludedBatchMessageTypes` | `[]`              | Listed types bypass batching.                                                         |
| `onMessage`                 | absent            | Function or type-keyed handler map for accepted application messages.                 |
| `telemetry`                 | `true`            | Historical package instrumentation; set false to opt out.                             |

## Actions and state

| Member                                 | Behavior in 1.11.2                                                                                                                                       |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `channelName`                          | Resolved channel name including namespace.                                                                                                               |
| `messages`                             | Accepted incoming-message log, excluding same-source messages.                                                                                           |
| `sentMessages`                         | Local send attempts, including buffered/failed sends. Not delivery receipts.                                                                             |
| `postMessage(type, content, options?)` | Queue/send a message. Returns void, not a delivery acknowledgement.                                                                                      |
| `clearReceivedMessages(options?)`      | Clear local received log; no filters clears all. Any matching ID, type or source removes a message (OR).                                                 |
| `clearSentMessages(options?)`          | Clear local sent log; nonempty ID/type filters combine with AND; empty arrays are wildcards. `sync: true` broadcasts the clear for this source to peers. |
| `getLatestMessage({ type?, source? })` | Read the last matching arrival in the local log, or null.                                                                                                |
| `ping(timeoutMs = 300)`                | Collect responding source names within a window; not proof of delivery of other messages. Returns `Promise<string[]>`.                                   |
| `isPingInProgress`                     | Whether this hook is collecting ping responses.                                                                                                          |
| `closeChannel()`                       | Flush eligible queued sends, close explicitly; do not expect automatic reopen/recovery.                                                                  |
| `error`                                | Error string or null; not every swallowed/batched failure has a caller-visible result.                                                                   |

## Message and expiry

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

`postMessage` accepts `{ expirationDuration?: number, expirationDate?: number }`. Expiry is not a conflict-ordering rule. Distinct IDs with old timestamps can still be accepted if unexpired. Batched native events may contain arrays; the hook unpacks them.

## Callbacks

```tsx
useBroadcastChannel('notifications', {
  telemetry: false,
  onMessage: {
    greeting: msg => console.log(msg.message),
  },
});
```

`onMessage` runs after acceptance filters and scheduling the local message update. Do not assume a React render has already completed. Internal ping/pong/clear messages do not invoke application callbacks. Separate message types help dispatch; they do not make concurrent writes atomic or prevent echo loops in application code.

## No late-tab or state algorithm

The log cannot replay messages to a new tab. There is no `withHistory` or `useSyncedState` export in 1.11.2. A manual request/reply bootstrap belongs to your app; it needs request IDs, late-reply/local-edit guards, and a deliberate policy if several peers disagree. Strict consistency needs an authority, not this local log alone.

## Historical sources

- [Tagged README](https://github.com/IdanShalem/react-broadcast-sync/blob/9d1a9a92148054cd2b7073974d36069dc7f17ef5/README.md)
- [Tagged runtime](https://github.com/IdanShalem/react-broadcast-sync/blob/9d1a9a92148054cd2b7073974d36069dc7f17ef5/src/hooks/useBroadcastChannel.ts) and [types](https://github.com/IdanShalem/react-broadcast-sync/blob/9d1a9a92148054cd2b7073974d36069dc7f17ef5/src/types/types.ts)

The archive keeps version-specific behavior but corrects misleading prose against that version's code. It is not a verbatim reproduction of the historical README.
