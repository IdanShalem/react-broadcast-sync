# Telemetry Notice — react-broadcast-sync

## What is collected

**Privacy-first: telemetry is off by default.** No usage events are sent to Mixpanel unless the application explicitly passes `telemetry: true` to `useBroadcastChannel` or `BroadcastProvider`. When enabled, structural usage signals help the maintainer prioritise features and fix issues.

When telemetry is enabled, the following structural signals are sent on channel mount or method use:

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
- Application user identifiers in the event payload
- IP addresses in the event payload (Mixpanel may process them from request metadata; see its privacy policy)
- Any data from the messages your application sends or receives

## Session identifier

Each page load generates a random, ephemeral session ID using `crypto.randomUUID()`. This ID:

- Is **not persisted** to cookies, `localStorage`, `sessionStorage`, or any other storage mechanism.
- Is **regenerated on every page load**, making it impossible to track users across sessions.
- Does not by itself identify a user, though the recipient may process request metadata such as IP addresses.

The session ID is not persisted by this package, but Mixpanel may process request metadata such as IP addresses. Applications enabling telemetry should assess their own privacy obligations and disclose this transfer to their users.

## Data processor

Usage statistics are processed by [Mixpanel](https://mixpanel.com). Mixpanel's privacy policy is available at [https://mixpanel.com/legal/privacy-policy/](https://mixpanel.com/legal/privacy-policy/).

## How to opt in

Telemetry is disabled by default. Enable it explicitly per hook or provider with `telemetry: true`:

```tsx
// Enable for a specific channel
useBroadcastChannel('my-channel', { telemetry: true });

// Enable via BroadcastProvider
<BroadcastProvider channelName="my-channel" options={{ telemetry: true }}>
  <App />
</BroadcastProvider>;
```

There is no penalty or degraded functionality when leaving telemetry off. Upgrading from a version where telemetry was enabled by default? No option is needed to keep it off; use `telemetry: true` only if you want to opt in.

## Contact

Questions or concerns about this telemetry notice can be raised by [opening an issue](https://github.com/IdanShalem/react-broadcast-sync/issues) on the project repository.
