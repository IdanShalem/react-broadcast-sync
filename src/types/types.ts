/**
 * Options for configuring the broadcast channel
 */
export interface BroadcastOptions {
  /** Custom source name for this instance */
  sourceName?: string;

  /** Interval in milliseconds for cleaning expired messages (default: 1000) */
  cleaningInterval?: number;

  /** If true, only the latest message is kept */
  keepLatestMessage?: boolean;

  /** Array of allowed message types */
  registeredTypes?: string[];

  /** Channel namespace for isolation */
  namespace?: string;

  /** TTL for deduplication in milliseconds (default: 5 minutes) */
  deduplicationTTL?: number;

  /** Debounce time for messages cleanup in milliseconds (default: 0, no debounce) */
  cleanupDebounceMs?: number;

  /** Delay in milliseconds for batching messages (default: 20) */
  batchingDelayMs?: number;

  /** Array of message types that should not be batched and sent immediately (default: []) */
  excludedBatchMessageTypes?: string[];

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
  onMessage?: MessageCallback | OnMessageMap;

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
export interface ClearOptions {
  ids?: string[];
  types?: string[];
}

export interface ClearReceivedMessagesOptions extends ClearOptions {
  sources?: string[];
}

export interface ClearSentMessagesOptions extends ClearOptions {
  sync?: boolean;
}

export interface GetLatestMessageOptions {
  source?: string;
  type?: string;
}

/**
 * Options for requesting the recent messages history from other open tabs
 */
export interface RequestMessagesHistoryOptions {
  /** Only request messages of these types (default: all types) */
  types?: string[];

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
export interface BroadcastActions {
  /** The resolved channel name including namespace */
  channelName: string;

  /** Array of received messages */
  messages: BroadcastMessage[];

  /** Array of sent messages */
  sentMessages: BroadcastMessage[];

  /** Whether a ping operation is currently in progress */
  isPingInProgress: boolean;

  /** Function to ping the channel and get active sources */
  ping: (timeoutMs?: number) => Promise<string[]>;

  /** Function to send a message */
  postMessage: (messageType: string, messageContent: any, options?: SendMessageOptions) => void;

  /** Function to clear received messages */
  clearReceivedMessages: (options?: ClearReceivedMessagesOptions) => void;

  /** Function to clear sent messages */
  clearSentMessages: (options?: ClearSentMessagesOptions) => void;

  /** Function to get the latest message by source and type */
  getLatestMessage: (options?: GetLatestMessageOptions) => BroadcastMessage | null;

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
  requestMessagesHistory: (options?: RequestMessagesHistoryOptions) => void;

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
