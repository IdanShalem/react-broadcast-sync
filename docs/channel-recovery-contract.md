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

Existing tests already cover batch flush/cleanup, queue failure and ping failure. New tests cover the matrix above. Injected unit tests are not evidence of a browser spontaneously disconnecting; the auto policy below is additionally covered by native Playwright integration tests (`integration/tests/auto-recovery.spec.ts`).

## Status after the reconnect PR

The first two decisions are implemented: explicit `reconnect()` for transport recreation (creation failure or deliberate close; never automatic; no-op while open) and `messageerror` reporting. The implementation preserves source identity policy, listener/timer cleanup and explicit-close semantics, and never blindly resends an operation that may already have reached peers. Restoring a transport cannot recover missed messages; current-value bootstrap (`useSyncedState`, shipped) and history replay (`requestMessagesHistory`, #11 shipped) remain the distinct resync paths.

#19 is shipped current-value sync.

## Status after the auto-recovery release

#2 is now answered: one failure class deserves automatic retry, and only one. Per the HTML standard's `postMessage` algorithm, `InvalidStateError` is thrown only when the channel object's closed flag is set (step 2, before serialization and before any delivery step), and the closed flag is set only by `close()`. So when a send throws `InvalidStateError` while the hook believes the channel is open, the object was closed outside the library and that message provably never left the tab. `recovery: 'auto'` - the default policy - recreates the channel and retries exactly that send once: no duplicate is possible, nothing is replayed, explicit `closeChannel()` and unmount never trigger it, and the policy is bounded by `maxRecoveryAttempts` consecutive failed attempts with an explicit `reconnect()` as the only escape. `recovery: 'manual'` opts out and keeps every recovery an explicit application decision.

The other class stays manual forever: a channel that sends but silently stops receiving produces no signal, and no heartbeat can distinguish "dead" from "quiet". Automatic recreation on suspicion would churn healthy channels, so the library never guesses. Two further qualifications from the standard: a `postMessage` from a not-fully-active document returns silently with no delivery (sender-side silent drop, e.g. while frozen in the back/forward cache), and receivers that are not fully active are skipped at broadcast time. `onChannelRecovered`, `requestMessagesHistory()` and `useSyncedState` remain the resync paths after any downtime.

Sources:

- https://github.com/IdanShalem/react-broadcast-sync/issues/2
- https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel
- https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel/messageerror_event
- https://html.spec.whatwg.org/multipage/web-messaging.html#broadcasting-to-other-browsing-contexts
