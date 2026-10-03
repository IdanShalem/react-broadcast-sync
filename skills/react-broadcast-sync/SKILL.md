---
name: react-broadcast-sync
description: Use when adding cross-tab messaging or state sync to a React app with the react-broadcast-sync package (useBroadcastChannel, BroadcastProvider). Covers syncing state between tabs, giving late-opened tabs the current state, and common mistakes.
---

# react-broadcast-sync

Cross-tab messaging for React over the browser `BroadcastChannel` API. Version 2.x. Same origin only.

## What it is and is not

- `messages` is an event log of what OTHER tabs sent. It is not current state.
- A tab never receives its own messages.
- Messages are not replayed. A tab opened later sees only messages sent after it opened.
- Deduplication is by message ID, not content.
- There is no automatic state replication. You send messages and apply them yourself.
- Telemetry is off by default (since 2.0.0). Do not add `telemetry: true` unless the user asks for it.

## Install

```bash
npm install react-broadcast-sync
```

## Recipe 1: sync a piece of state between tabs

Update local state, then send one message from the same handler. Apply incoming messages with `onMessage`.

```tsx
import { useState } from 'react';
import { useBroadcastChannel } from 'react-broadcast-sync';

function Dashboard() {
  const [filters, setFilters] = useState({ status: 'all' });

  const { postMessage } = useBroadcastChannel('dashboard', {
    onMessage: {
      'filters-update': msg => setFilters(msg.message),
    },
  });

  const updateFilters = (next: typeof filters) => {
    setFilters(next);
    postMessage('filters-update', next);
  };

  return <FilterBar value={filters} onChange={updateFilters} />;
}
```

Do NOT call `postMessage` from a `useEffect` that watches state which incoming messages also set. Tabs re-broadcast what they receive and ping-pong forever.

## Recipe 2: give a late-opened tab the current state

Because there is no replay, a new tab must ask and an existing tab must answer. Keep the current value in a ref so the handler does not read stale state.

```tsx
const filtersRef = useRef(filters);
filtersRef.current = filters;

const { postMessage } = useBroadcastChannel('dashboard', {
  onMessage: {
    'filters-update': msg => setFilters(msg.message),
    'state-request': () => postMessage('filters-update', filtersRef.current),
  },
});

useEffect(() => {
  postMessage('state-request', null);
}, []);
```

If no other tab is open, nobody answers. Start from sensible defaults.

## Recipe 3: latest value only

`keepLatestMessage: true` keeps ONE slot across all types. A later message of any type replaces the earlier one. It does not replay to late tabs. For latest-per-type, use separate channels or `namespace`, or read with `getLatestMessage({ type })` without `keepLatestMessage`.

## Recipe 4: stable sourceName

Leave `sourceName` unset unless you need a stable name. A unique one is generated per tab. If you set it:

- It must be unique per tab. A tab ignores messages whose `source` equals its own `sourceName`, so two tabs with the same name never hear each other.
- Do not build it inline (for example `crypto.randomUUID()` in the options). It would change every render. Create it once with `useRef` or `useState`.

## Recipe 5: several topics

Use one channel per topic (or `namespace`) so each listener only gets its own messages. `registeredTypes` limits accepted message types.

## Common mistakes

- Treating `messages` as state. Use `useState` plus `onMessage`.
- Sending from `useEffect` on synced state (loop, see Recipe 1).
- Expecting a new tab to get past messages (see Recipe 2).
- Using the same `sourceName` in every tab.
- `cleanupDebounceMs` larger than `cleaningInterval`, which can stop expired messages from being removed.
- Expecting cross-origin delivery. `BroadcastChannel` is same origin only.
- Enabling telemetry without being asked.

## More

Full docs: https://github.com/IdanShalem/react-broadcast-sync#readme
