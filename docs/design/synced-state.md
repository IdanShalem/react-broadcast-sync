# Current-state bootstrap proposal

Status: draft design and protocol foundation for issue #19. Not a released API.

## Scope

A state hook is different from history replay (#11). Share one current value per key, request it when joining, and never rebroadcast received values. Do not replay expired, cleared or arbitrary message logs. No persistence, server, automatic reconnect or atomic increments in this first API.

The existing late-tab recipe is a useful manual option. It targets responses by request ID and ignores bootstrap after a local/live edit, but first-response wins cannot choose between disagreeing peers. A state hook needs a stronger ordering rule before it can promise convergence.

## Proposed shape

```ts
const [value, setValue, sync] = useSyncedState(channel, key, initialValue, options);
```

Open questions before exposing this shape:

- Does channel mean a name, or existing actions? Existing actions do not allow adding a subscriber without replacing onMessage. Prefer a channel name for a first implementation, but document the additional connection.
- Should sync return a result containing whether a peer answered, rather than only the value? A timeout with no answer must not imply an authoritative default.
- Keep source IDs generated and unique. A user-supplied shared source name would suppress messages and undermine the tie-breaker.
- The initial value is a fallback, not a write. Version-zero defaults do not override a value received from a peer. Disagreeing defaults with no writes are not resolved by this protocol.
- A functional setter uses this tab's current value. Concurrent increments remain independent writes; one can be lost. Do not call this a distributed atomic counter.

## Version ordering

Each accepted write has `(clock, source)`:

1. Before a local write, increment this tab's Lamport clock above every observed clock.
2. Accept an incoming write only if its version is greater than the current version.
3. Compare clocks numerically, then source IDs by a fixed JavaScript string comparison. Do not use locale-dependent sorting.
4. Advance the local clock for any valid observed version, including a stale targeted response that cannot overwrite the current value.

This is logical last-write-wins, not wall-clock last-write-wins. Two concurrent writes choose the same deterministic winner in every tab after both messages arrive. It does not prove which user action happened last, or prevent a lost intent.

## Wire protocol

Use reserved, versioned message types for request, response and set. Include the state key and protocol version in every payload. Responses include the request ID and the value's original version, not a new write version. Do not increase a value's version merely by relaying it.

A join request gathers matching responses for a bounded window (the issue proposes 250 ms). Accept only a matching key/request/protocol and valid version. Pick the greatest version, regardless of arrival order, while never replacing a newer local/live write. Apply only once per accepted version; receipt must not trigger another set broadcast.

A reply with no committed version indicates only a peer fallback. Treat it separately from versioned state. A malicious peer can send an artificially huge clock; BroadcastChannel peers are trusted same-origin app contexts, not a security boundary. Validate safe nonnegative integer clocks and known payload shape, but do not claim this authenticates a sender.

## Required test matrix before a public hook

- Late join with one existing written value.
- Two disagreeing peers replying in reverse order: same greatest version wins.
- Local edit during join; stale response cannot replace it.
- Concurrent writes delivered in opposite orders: same final winner.
- Next local write follows a larger observed clock.
- Received state is never rebroadcast as a write.
- Keys, namespaces and protocol versions are isolated.
- StrictMode mount/cleanup, key/channel change, explicit sync, no peer and unsupported browser.
- Malformed payload, unsafe clock and send failure: no throw or false success.
- React >=16.8 compatibility, public types, generated agent docs and native Chromium/Firefox/WebKit cross-tab tests.

## Implementation status

This draft adds only an internal version comparator/clock helper and its tests. It does not export useSyncedState, alter current channel behavior or promise a release version. The old issue's 1.12.0 estimate is stale: current npm is 2.1.6. An eventual public hook would be an additive minor release, subject to review and approval.
