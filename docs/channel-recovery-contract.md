# Channel failure qualification (#2)

Checked against 2.2.0 and `channelFailureContract.test.tsx` on October 15, 2026.

The old issue says a disconnected channel loses all messages. It has no reproduction or definition of disconnection. Do not treat this as a network socket with an automatic disconnect event.

| Scenario                                      | Current behavior                                                                        | Next decision                                                                                      |
| --------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Constructor throws                            | Error reported; ordinary rerender does not retry                                        | Implemented: explicit `reconnect()` recreates the transport on the app's decision; never automatic |
| Immediate send throws (mocked DataCloneError) | Error reported; next valid immediate send uses the same connection; no automatic replay | A payload failure is not proof the connection is dead                                              |
| Explicit close                                | Channel stays closed through rerender/send                                              | Never reconnect automatically after deliberate close; an explicit `reconnect()` call may reopen it |
| Channel name changes                          | Old connection closes, new one opens                                                    | Preserve isolation; do not carry queued messages into new identity                                 |
| messageerror                                  | Listened to and reported through `error` as a read failure                              | Reporting implemented; it means deserialization failed, not disconnection                          |

`sentMessages` currently records attempts, including a failed immediate send and messages queued before a batching failure. It is not delivery acknowledgement. A send with no error still does not prove peer delivery. This qualification does not change that API behavior.

Existing tests already cover batch flush/cleanup, queue failure and ping failure. New tests cover the matrix above. Constructor and send failures here are injected tests, not evidence of a browser spontaneously disconnecting.

## Status after the reconnect PR

The first two decisions are implemented: explicit `reconnect()` for transport recreation (creation failure or deliberate close; never automatic; no-op while open) and `messageerror` reporting. The implementation preserves source identity policy, listener/timer cleanup and explicit-close semantics, and never blindly resends an operation that may already have reached peers. Restoring a transport cannot recover missed messages; current-value bootstrap (`useSyncedState`, shipped) and history replay (`requestMessagesHistory`, #11 shipped) remain the distinct resync paths.

Still open for #2: whether any failure deserves _automatic_ retry, which would need a reproducible application need and a lifecycle contract. #19 is shipped current-value sync.

Sources:

- https://github.com/IdanShalem/react-broadcast-sync/issues/2
- https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel
- https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel/messageerror_event
