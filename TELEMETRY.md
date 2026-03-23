# Telemetry Notice — react-broadcast-sync

## What is collected

`react-broadcast-sync` collects **anonymous, non-personal usage statistics** to help the maintainer understand how the library is used in practice. This data is used solely to prioritise features and fix real-world issues.

The following structural signals are sent on every channel mount:

| Signal              | Description                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------------- |
| `entry`             | Whether `useBroadcastChannel` or `BroadcastProvider` was used                                 |
| `options_used`      | Names of `BroadcastOptions` keys that differ from their default values                        |
| `onmessage_shape`   | Whether `onMessage` is absent, a function, or a type-keyed map                                |
| `batching_enabled`  | Whether `batchingDelayMs > 0`                                                                 |
| `browser_supported` | Whether `BroadcastChannel` is available in the browser                                        |
| `method_called`     | Which action methods (`postMessage`, `ping`, etc.) were called at least once per page session |

## What is never collected

- Channel names
- Source names (`sourceName`)
- Message content or message types
- User identifiers of any kind
- IP addresses (Mixpanel may record these server-side; see Mixpanel's privacy policy)
- Any data from the messages your application sends or receives

## Session identifier

Each page load generates a random, ephemeral session ID using `crypto.randomUUID()`. This ID:

- Is **not persisted** to cookies, `localStorage`, `sessionStorage`, or any other storage mechanism.
- Is **regenerated on every page load**, making it impossible to track users across sessions.
- Cannot be linked back to any individual user or device.

Because the identifier is non-persistent and randomly regenerated, the data collected does not constitute "personal data" under the GDPR definition (Regulation (EU) 2016/679, Article 4(1)).

## Legal basis

The data collected is fully anonymous and structural. No personal data or data that can identify a natural person is processed. The collection falls under the **legitimate interests** of the package maintainer (GDPR Article 6(1)(f)) to understand aggregate library usage patterns.

Because no cookies or persistent identifiers are set on the user's device, the ePrivacy Directive (Directive 2002/58/EC) cookie consent requirements do not apply.

## Data processor

Usage statistics are processed by [Mixpanel](https://mixpanel.com). Mixpanel's privacy policy is available at [https://mixpanel.com/legal/privacy-policy/](https://mixpanel.com/legal/privacy-policy/).

## How to opt out

Telemetry is enabled by default and can be disabled at any time by passing `telemetry: false`:

```tsx
// Disable for a specific channel
useBroadcastChannel('my-channel', { telemetry: false });

// Disable via BroadcastProvider
<BroadcastProvider channelName="my-channel" options={{ telemetry: false }}>
  <App />
</BroadcastProvider>;
```

There is no penalty, degraded functionality, or behaviour change when opting out.

## Contact

Questions or concerns about this telemetry notice can be raised by [opening an issue](https://github.com/IdanShalem/react-broadcast-sync/issues) on the project repository.
