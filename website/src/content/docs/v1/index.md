---
title: v1 archive (1.11.2)
description: Read-only documentation reconstructed from react-broadcast-sync 1.11.2 sources.
---

:::caution[Read-only v1.11.2 archive]
Reconstructed from the published **1.11.2** tag, not copied from v2 documentation. This is a fixed historical snapshot, not coverage of every v1 minor release or a promise of ongoing v1 maintenance. New projects should use [current v2 docs](/getting-started/). [Version scope and migration](/changelog/).
:::

This edition documents the last published v1 release, **1.11.2**. Its npm metadata points to commit `9d1a9a92148054cd2b7073974d36069dc7f17ef5`, matching tag `v1.11.2`. There was no documentation-site tree at that tag, so these pages reconstruct a focused reference from its README, TypeScript declarations and runtime.

- [Install and send a message](/v1/getting-started/)
- [Options, actions and message semantics](/v1/api/)
- [React context provider](/v1/provider/)
- [Historical telemetry and opt-out](/v1/telemetry/)

## What belongs to v1

The public exports are `useBroadcastChannel`, `BroadcastProvider` and `useBroadcastProvider`, plus their types. **`useSyncedState` is not available in v1**. It was introduced in v2.2.0. V1's message log is not shared state, history replay, persistence or a conflict-resolution algorithm. An app must supply its own request/reply and concurrency policy.

## No equivalent page

If the version chooser brought you here, that v2 page has no direct equivalent in this archive. Start with the links above. The v2 state-hook guide, newer recipes and current demos are not historical v1 documentation. No v1 live demo is provided; its historical demo source remains in the tagged repository.

## Corrections to the historical README

The tagged README is preserved as a source, not treated as infallible. The runtime shows:

- Deduplication uses message **ID**, not matching content and type. Two distinct messages with identical content can both be accepted.
- `clearReceivedMessages` removes a message when **any** supplied filter matches. `clearSentMessages` combines nonempty ID/type filters with **AND**. The old prose incorrectly implied a single matching rule.
- A channel does not deliver a sender's message back to that same channel instance. The old one-hook receive test was not a valid native-browser test.
- `keepLatestMessage` retains the last accepted arrival, not the highest timestamp or one message per type.
- The original callback wording does not promise that React's next render has finished when `onMessage` runs.
- The old "Coming Soon" section is not a current roadmap. No recovery/history API is added by this archive.

## Snapshot limits

Earlier v1 versions can have different APIs or defaults. Match your installed release to its tag rather than assuming 1.11.2 describes all v1 releases. Archived code may retain behavior and telemetry removed in v2. This site does not run the v1 package merely because you read these pages.

## Historical sources

- [Tagged README](https://github.com/IdanShalem/react-broadcast-sync/blob/9d1a9a92148054cd2b7073974d36069dc7f17ef5/README.md)
- [Tagged runtime](https://github.com/IdanShalem/react-broadcast-sync/blob/9d1a9a92148054cd2b7073974d36069dc7f17ef5/src/hooks/useBroadcastChannel.ts) and [types](https://github.com/IdanShalem/react-broadcast-sync/blob/9d1a9a92148054cd2b7073974d36069dc7f17ef5/src/types/types.ts)

The archive keeps version-specific behavior but corrects misleading prose against that version's code. It is not a verbatim reproduction of the historical README.
