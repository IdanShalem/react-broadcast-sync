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
   * True when this entry arrived through requestHistory() replay rather than
   * live delivery. Replayed entries never trigger onMessage.
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
 * Options for requesting message history from other open tabs
 */
export interface RequestHistoryOptions {
  /** Only request messages of these types (default: all types) */
  types?: string[];

  /** Maximum messages each responding tab may return (default: 50, max: 500) */
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
   * Replayed entries are appended with `isHistory: true` and never trigger
   * `onMessage`, so replay cannot re-run side effects (toasts, logout, ...).
   * Duplicates (already received live, or sent by several responding tabs) are
   * dropped by message ID. Messages cleared locally via clearReceivedMessages()
   * before the request are not resurrected: replay only accepts entries newer
   * than this tab's latest local clear. The clear itself stays session-local
   * and is not propagated to other tabs.
   */
  requestHistory: (options?: RequestHistoryOptions) => void;

  /** Explicitly close the broadcast channel and remove listeners */
  closeChannel: () => void;

  /** Current error state */
  error: string | null;
}

export type ClearMessage = 'CLEAR_SENT_MESSAGES';

export type InternalMessage =
  | ClearMessage
  | 'PING'
  | 'PONG'
  | 'REQUEST_HISTORY'
  | 'HISTORY_RESPONSE';
