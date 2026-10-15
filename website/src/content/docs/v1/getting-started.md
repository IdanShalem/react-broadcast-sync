---
title: Getting started with v1.11.2
description: Read-only documentation reconstructed from react-broadcast-sync 1.11.2 sources.
---

:::caution[Read-only v1.11.2 archive]
Reconstructed from the published **1.11.2** tag, not copied from v2 documentation. This is a fixed historical snapshot, not coverage of every v1 minor release or a promise of ongoing v1 maintenance. New projects should use [current v2 docs](/getting-started/). [Version scope and migration](/changelog/).
:::

## Install this exact historical release

```bash
npm install react-broadcast-sync@1.11.2
```

The package declares React and React DOM `>=16.8.0` as peers and uses the browser's native `BroadcastChannel`. It does not add a cross-origin or server transport.

## Send from one tab, receive in another

```tsx
import { useBroadcastChannel } from 'react-broadcast-sync';

export default function Greeting() {
  const { messages, postMessage, error } = useBroadcastChannel('greetings', {
    telemetry: false,
  });
  return (
    <section>
      <button onClick={() => postMessage('greeting', { text: 'Hello!' })}>Send</button>
      {error && <p role="alert">{error}</p>}
      {messages.map(msg => (
        <p key={msg.id}>{msg.message.text}</p>
      ))}
    </section>
  );
}
```

Open the same-origin app in two tabs. Click **Send** in tab A; tab B receives the message. Tab A's local `messages` does not receive its own send. The generated source name should stay unique per tab; do not hardcode the same source name in every tab.

`telemetry: false` explicitly disables the historical package telemetry. Unlike v2, 1.11.2 otherwise enables it by default. See [historical telemetry](/v1/telemetry/).

## What happens next

Default batching buffers sends for up to 20 ms. The receiver accepts non-expired, permitted, non-duplicate IDs from other sources. A tab opened after the send does not recover it. `messages` is a local received-message log, not a stored current value. [Full v1 API](/v1/api/).

## Historical sources

- [Tagged README](https://github.com/IdanShalem/react-broadcast-sync/blob/9d1a9a92148054cd2b7073974d36069dc7f17ef5/README.md)
- [Tagged runtime](https://github.com/IdanShalem/react-broadcast-sync/blob/9d1a9a92148054cd2b7073974d36069dc7f17ef5/src/hooks/useBroadcastChannel.ts) and [types](https://github.com/IdanShalem/react-broadcast-sync/blob/9d1a9a92148054cd2b7073974d36069dc7f17ef5/src/types/types.ts)

The archive keeps version-specific behavior but corrects misleading prose against that version's code. It is not a verbatim reproduction of the historical README.
