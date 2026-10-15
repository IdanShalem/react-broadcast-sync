---
title: v1.11.2 provider
description: Read-only documentation reconstructed from react-broadcast-sync 1.11.2 sources.
---

:::caution[Read-only v1.11.2 archive]
Reconstructed from the published **1.11.2** tag, not copied from v2 documentation. This is a fixed historical snapshot, not coverage of every v1 minor release or a promise of ongoing v1 maintenance. New projects should use [current v2 docs](/getting-started/). [Version scope and migration](/changelog/).
:::

The context provider shares one hook connection and result with its descendants. It does not create a different transport or add persistence.

```tsx
import { BroadcastProvider, useBroadcastProvider } from 'react-broadcast-sync';

export default function App() {
  return (
    <BroadcastProvider channelName="notifications" options={{ telemetry: false }}>
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

| Prop          | Required | Meaning                                                                 |
| ------------- | -------- | ----------------------------------------------------------------------- |
| `channelName` | yes      | Shared channel name.                                                    |
| `options`     | no       | V1.11.2 `BroadcastOptions`, including the historical telemetry opt-out. |
| `children`    | yes      | Descendant components.                                                  |

`useBroadcastProvider()` outside a `BroadcastProvider` throws. Consumers under the same provider share state; separate providers or standalone hooks own separate connections. The [v1 message API](/v1/api/) semantics still apply.

## Historical sources

- [Tagged README](https://github.com/IdanShalem/react-broadcast-sync/blob/9d1a9a92148054cd2b7073974d36069dc7f17ef5/README.md)
- [Tagged runtime](https://github.com/IdanShalem/react-broadcast-sync/blob/9d1a9a92148054cd2b7073974d36069dc7f17ef5/src/hooks/useBroadcastChannel.ts) and [types](https://github.com/IdanShalem/react-broadcast-sync/blob/9d1a9a92148054cd2b7073974d36069dc7f17ef5/src/types/types.ts)

The archive keeps version-specific behavior but corrects misleading prose against that version's code. It is not a verbatim reproduction of the historical README.
