# Channel failure qualification (#2)

Checked against 2.2.0 and `channelFailureContract.test.tsx` on October 15, 2026.

The old issue says a disconnected channel loses all messages. It has no reproduction or definition of disconnection. Do not treat this as a network socket with an automatic disconnect event.

| Scenario                                      | Current behavior                                                                        | Next decision                                                                                                                   |
| --------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Constructor throws                            | Error reported; ordinary rerender does not retry                                        | An explicit retry API could help a transient creation failure, but needs a reproducible application need and lifecycle contract |
| Immediate send throws (mocked DataCloneError) | Error reported; next valid immediate send uses the same connection; no automatic replay | A payload failure is not proof the connection is dead                                                                           |
| Explicit close                                | Channel stays closed through rerender/send                                              | Never reconnect automatically after deliberate close                                                                            |
| Channel name changes                          | Old connection closes, new one opens                                                    | Preserve isolation; do not carry queued messages into new identity                                                              |
| messageerror                                  | No listener currently                                                                   | Possible narrow error-reporting improvement; this means deserialization failed, not disconnection                               |

`sentMessages` currently records attempts, including a failed immediate send and messages queued before a batching failure. It is not delivery acknowledgement. A send with no error still does not prove peer delivery. This qualification does not change that API behavior.

Existing tests already cover batch flush/cleanup, queue failure and ping failure. New tests cover the matrix above. Constructor and send failures here are injected tests, not evidence of a browser spontaneously disconnecting.

## Proposed direction

Keep #2 open until its target failure is explicit. First separate error visibility, deliberate lifecycle, transport recreation and resynchronizing data. If adding recovery later, preserve source identity policy, listener/timer cleanup and explicit-close semantics. Never blindly resend an operation that may already have reached peers. Restoring a transport cannot recover missed messages; current-value bootstrap and history replay are distinct.

No reconnect API or automatic retry added by this PR. #11 remains separate history design. #19 is shipped current-value sync.

Sources:

- https://github.com/IdanShalem/react-broadcast-sync/issues/2
- https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel
- https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel/messageerror_event
