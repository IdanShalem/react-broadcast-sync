---
title: Historical v1.11.2 telemetry
description: Read-only documentation reconstructed from react-broadcast-sync 1.11.2 sources.
---

:::caution[Read-only v1.11.2 archive]
Reconstructed from the published **1.11.2** tag, not copied from v2 documentation. This is a fixed historical snapshot, not coverage of every v1 minor release or a promise of ongoing v1 maintenance. New projects should use [current v2 docs](/getting-started/). [Version scope and migration](/changelog/).
:::

## V1 behavior is different from v2

The 1.11.2 package includes instrumentation **enabled by default**. Its `telemetry` option is active, not the compatibility no-op found in later v2. This archive does not run that package or emit its package-usage events while you read it. Website analytics are a separate concern.

## Opt out

```tsx
useBroadcastChannel('my-channel', { telemetry: false });

// Or through the provider:
<BroadcastProvider channelName="my-channel" options={{ telemetry: false }}>
  <App />
</BroadcastProvider>;
```

The tagged implementation collects structural mount/method signals such as the hook/provider entry point, names of supplied non-default options, callback shape, batching/browser support, and method names used once per page session. Its historical notice describes a random per-page session identifier and batched delivery to Mixpanel when the page hides or after 30 seconds.

Consult the [original tagged telemetry notice](https://github.com/IdanShalem/react-broadcast-sync/blob/9d1a9a92148054cd2b7073974d36069dc7f17ef5/TELEMETRY.md) and [tagged instrumentation code](https://github.com/IdanShalem/react-broadcast-sync/blob/9d1a9a92148054cd2b7073974d36069dc7f17ef5/src/utils/telemetry.ts) for historical detail. The old notice's legal/anonymity conclusions are historical assertions, not a fresh legal assessment by this archive. This page does not promise that the historical service endpoint is still maintained.

## Historical sources

- [Tagged README](https://github.com/IdanShalem/react-broadcast-sync/blob/9d1a9a92148054cd2b7073974d36069dc7f17ef5/README.md)
- [Tagged runtime](https://github.com/IdanShalem/react-broadcast-sync/blob/9d1a9a92148054cd2b7073974d36069dc7f17ef5/src/hooks/useBroadcastChannel.ts) and [types](https://github.com/IdanShalem/react-broadcast-sync/blob/9d1a9a92148054cd2b7073974d36069dc7f17ef5/src/types/types.ts)

The archive keeps version-specific behavior but corrects misleading prose against that version's code. It is not a verbatim reproduction of the historical README.
