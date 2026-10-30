/**
 * The default message map: any string message type with any payload. Used as
 * the generic default so omitting the type argument keeps the loose,
 * pre-typed-channels behavior.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LooseMessageMap = Record<string, any>;

/**
 * A channel's declared message map: message type name -> payload type.
 * Pass it as the generic of `useBroadcastChannel` / `BroadcastProvider` /
 * `useBroadcastProvider` to get type-safe `postMessage`, `onMessage`,
 * `getLatestMessage` and the clear/history options. Types only - no runtime
 * validation, and no change when the generic is omitted.
 *
 * ```ts
 * type DashboardEvents = {
 *   filter: { range: string; team: string };
 *   logout: undefined;
 * };
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BroadcastMessageMap = Record<string, any>;

type EventKeys<TMap extends BroadcastMessageMap> = Extract<keyof TMap, string>;

/**
 * Prevents `TMap` from being inferred from `options`: the map only comes from
 * an explicit generic, so omitting it always yields the loose default.
 */
export type NoInferMessageMap<TMap> = [TMap][TMap extends any ? 0 : never];

/** Message types whose declared payload includes `undefined`. */
type OptionalPayloadKeys<TMap extends BroadcastMessageMap> = {
  [K in EventKeys<TMap>]: undefined extends TMap[K] ? K : never;
}[EventKeys<TMap>];

/** Message types that require a payload argument on `postMessage`. */
type RequiredPayloadKeys<TMap extends BroadcastMessageMap> = Exclude<
  EventKeys<TMap>,
  OptionalPayloadKeys<TMap>
>;

/**
 * A broadcast message narrowed to a declared message map. Distributes over
 * `TType`, so `TypedBroadcastMessage<Map>` is a discriminated union of one
 * message shape per declared type. With the default loose map it is
 * structurally identical to `BroadcastMessage`.
 */
export type TypedBroadcastMessage<
  TMap extends BroadcastMessageMap,
  TType extends EventKeys<TMap> = EventKeys<TMap>,
> = TType extends string
  ? Omit<BroadcastMessage, 'type' | 'message'> & { type: TType; message: TMap[TType] }
  : never;

/**
 * `postMessage` typed against a declared message map: only declared message
 * types are accepted, each with its declared payload. The payload argument is
 * optional for types declared with an `undefined` payload.
 */
export type TypedPostMessage<TMap extends BroadcastMessageMap> = {
  <TType extends RequiredPayloadKeys<TMap>>(
    messageType: TType,
    messageContent: TMap[TType],
    options?: SendMessageOptions
  ): void;
  <TType extends OptionalPayloadKeys<TMap>>(
    messageType: TType,
    messageContent?: TMap[TType],
    options?: SendMessageOptions
  ): void;
};

/**
 * `onMessage` map typed against a declared message map. With the loose
 * default map it is exactly the classic `OnMessageMap` shape, so existing
 * untyped handlers keep compiling unchanged.
 */
export type TypedOnMessageMap<TMap extends BroadcastMessageMap> =
  string extends EventKeys<TMap>
    ? { [type: string]: MessageCallback }
    : { [K in EventKeys<TMap>]?: (msg: TypedBroadcastMessage<TMap, K>) => void };

/** Single `onMessage` callback receiving the union of a map's messages. */
export type TypedMessageCallback<TMap extends BroadcastMessageMap = LooseMessageMap> = (
  msg: TypedBroadcastMessage<TMap>
) => void;

/**
 * `getLatestMessage` typed against a declared message map: the returned
 * message payload matches the requested `type`.
 */
export type TypedGetLatestMessage<TMap extends BroadcastMessageMap> = <
  TType extends EventKeys<TMap> = EventKeys<TMap>,
>(options?: {
  source?: string;
  type?: TType;
}) => TypedBroadcastMessage<TMap, TType> | null;

/**
 * Options for configuring the broadcast channel
 */
export interface BroadcastOptions<TMap extends BroadcastMessageMap = LooseMessageMap> {
  /** Custom source name for this instance */
  sourceName?: string;

  /** Interval in milliseconds for cleaning expired messages (default: 1000) */
  cleaningInterval?: number;

  /** If true, only the latest message is kept */
  keepLatestMessage?: boolean;

  /** Array of allowed message types */
  registeredTypes?: EventKeys<TMap>[];

  /** Channel namespace for isolation */
  namespace?: string;

  /** TTL for deduplication in milliseconds (default: 5 minutes) */
  deduplicationTTL?: number;

  /** Debounce time for messages cleanup in milliseconds (default: 0, no debounce) */
  cleanupDebounceMs?: number;

  /** Delay in milliseconds for batching messages (default: 20) */
  batchingDelayMs?: number;

  /** Array of message types that should not be batched and sent immediately (default: []) */
  excludedBatchMessageTypes?: EventKeys<TMap>[];

  /**
   * Callback(s) fired when an incoming message passes all filters
   * (registeredTypes, expiry, deduplication, self-filter).
   *
   * - Pass a single function to handle all incoming message types.
   * - Pass a type-keyed map `{ error: fn, success: fn }` for per-type handling.
   *
   * The callback fires after the message is added to state.
   * Internal messages (PING, PONG, CLEAR_SENT_MESSAGES) never trigger this.
   */
  onMessage?: TypedMessageCallback<TMap> | TypedOnMessageMap<TMap>;

  /**
   * Transport recovery policy (default: 'auto').
   *
   * - 'auto': when a send fails with `InvalidStateError` - proof the held
   *   channel object was closed outside the library - the channel is
   *   recreated automatically and that send is retried once. The failed send
   *   provably never left this channel, so the retry cannot duplicate
   *   delivery. Recovery is bounded by `maxRecoveryAttempts` consecutive
   *   failures; after that the channel stays down and `error` is reported
   *   until an explicit `reconnect()`. Explicit `closeChannel()` and unmount
   *   never auto-recover. Payload errors (`DataCloneError`) and silent
   *   receive failures never trigger recovery - silence is not detectable
   *   as death. Missed messages are never replayed; use `onChannelRecovered`
   *   to resync (requestMessagesHistory/useSyncedState).
   * - 'manual': opt out; the library never recreates the channel on its own
   *   and you call `reconnect()` yourself after a creation failure or
   *   `closeChannel()`.
   */
  recovery?: 'manual' | 'auto';

  /** Max consecutive automatic recovery attempts before giving up (default: 3). */
  maxRecoveryAttempts?: number;

  /**
   * Fired after an automatic recovery succeeded. Use it to resynchronize
   * data missed while the channel was down; the library never replays.
   */
  onChannelRecovered?: () => void;

  /**
   * @deprecated No-op. The package no longer collects telemetry. The option is still
   * accepted so existing code that passes `telemetry` keeps compiling; it will be removed
   * in the next major version.
   */
  telemetry?: boolean;
}

/**
 * Options for sending messages
 */
export interface SendMessageOptions {
  /** Message expiration duration in milliseconds */
  expirationDuration?: number;

  /** Specific expiration timestamp */
  expirationDate?: number;
}

/**
 * Structure of a broadcast message
 */
export interface BroadcastMessage {
  /** Unique message identifier */
  id: string;

  /** Message type for categorization */
  type: string;

  /** Message content */
  message: any;

  /** Creation timestamp */
  timestamp: number;

  /** Source identifier */
  source: string;

  /** Optional expiration timestamp */
  expirationDate?: number;

  /**
   * True when this entry arrived through requestMessagesHistory() replay
   * rather than live delivery. Replayed entries never trigger onMessage.
   */
  isHistory?: boolean;
}
export interface ClearOptions<TMap extends BroadcastMessageMap = LooseMessageMap> {
  ids?: string[];
  types?: EventKeys<TMap>[];
}

export interface ClearReceivedMessagesOptions<TMap extends BroadcastMessageMap = LooseMessageMap>
  extends ClearOptions<TMap> {
  sources?: string[];
}

export interface ClearSentMessagesOptions<TMap extends BroadcastMessageMap = LooseMessageMap>
  extends ClearOptions<TMap> {
  sync?: boolean;
}

export interface GetLatestMessageOptions<TMap extends BroadcastMessageMap = LooseMessageMap> {
  source?: string;
  type?: EventKeys<TMap>;
}

/**
 * Options for requesting the recent messages history from other open tabs
 */
export interface RequestMessagesHistoryOptions<TMap extends BroadcastMessageMap = LooseMessageMap> {
  /** Only request messages of these types (default: all types) */
  types?: EventKeys<TMap>[];

  /**
   * Maximum number of recent messages kept from one request (default: 50,
   * max: 500). Every open tab answers with ITS newest messages (at most this
   * many); the requester unions all answers, deduplicates by message ID, and
   * keeps the newest `limit` unique messages, appended oldest-to-newest.
   * No tab gets priority for answering first.
   */
  limit?: number;
}

/** Callback invoked when a received message passes all filters */
export type MessageCallback = (msg: BroadcastMessage) => void;

/** Map from message type string to a single handler callback */
export type OnMessageMap = { [type: string]: MessageCallback };

/**
 * Actions and state provided by the broadcast channel hook
 */
export interface BroadcastActions<TMap extends BroadcastMessageMap = LooseMessageMap> {
  /** The resolved channel name including namespace */
  channelName: string;

  /** Array of received messages */
  messages: TypedBroadcastMessage<TMap>[];

  /** Array of sent messages */
  sentMessages: TypedBroadcastMessage<TMap>[];

  /** Whether a ping operation is currently in progress */
  isPingInProgress: boolean;

  /** Function to ping the channel and get active sources */
  ping: (timeoutMs?: number) => Promise<string[]>;

  /** Function to send a message */
  postMessage: TypedPostMessage<TMap>;

  /** Function to clear received messages */
  clearReceivedMessages: (options?: ClearReceivedMessagesOptions<TMap>) => void;

  /** Function to clear sent messages */
  clearSentMessages: (options?: ClearSentMessagesOptions<TMap>) => void;

  /** Function to get the latest message by source and type */
  getLatestMessage: TypedGetLatestMessage<TMap>;

  /**
   * Ask other open tabs to replay recent messages into this tab's `messages`.
   *
   * Every open tab that holds matching messages answers; the requester merges
   * all answers and deduplicates by message ID, so with 3 tabs open you still
   * get each message once (the union of what the open tabs hold).
   *
   * Replayed entries are appended with `isHistory: true` and never trigger
   * `onMessage`, so replay cannot re-run side effects (toasts, logout, ...).
   * Messages cleared locally via clearReceivedMessages() before the request
   * are not resurrected: replay only accepts entries newer than this tab's
   * latest local clear. The clear itself stays session-local and is not
   * propagated to other tabs.
   */
  requestMessagesHistory: (options?: RequestMessagesHistoryOptions<TMap>) => void;

  /** Explicitly close the broadcast channel and remove listeners */
  closeChannel: () => void;

  /**
   * Explicitly recreate the channel after a creation failure or a deliberate
   * closeChannel(). Returns false (no-op) while a connection is open. The
   * library never reconnects automatically. Keeps this tab's source identity
   * and message logs; does not resend or replay missed messages - use
   * requestMessagesHistory() or useSyncedState to resynchronize data.
   */
  reconnect: () => boolean;

  /** Current error state */
  error: string | null;
}

export type ClearMessage = 'CLEAR_SENT_MESSAGES';

export type InternalMessage =
  | ClearMessage
  | 'PING'
  | 'PONG'
  | 'REQUEST_MESSAGES_HISTORY'
  | 'MESSAGES_HISTORY_RESPONSE';
