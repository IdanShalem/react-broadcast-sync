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

  /** Debounce time for messages cleanup in milliseconds (default: 1000) */
  cleanupDebounceMs?: number;
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
 * Actions and state provided by the broadcast channel hook
 */
export interface BroadcastActions {
  /** The resolved channel name including namespace */
  channelName: string;

  /** Array of received messages */
  messages: BroadcastMessage[];

  /** Array of sent messages */
  sentMessages: BroadcastMessage[];

  /** Function to send a message */
  postMessage: (messageType: string, messageContent: any, options?: SendMessageOptions) => void;

  /** Function to clear received messages */
  clearReceivedMessages: (options?: ClearReceivedMessagesOptions) => void;

  /** Function to clear sent messages */
  clearSentMessages: (options?: ClearSentMessagesOptions) => void;

  /** Function to get the latest message by source and type */
  getLatestMessage: (options?: GetLatestMessageOptions) => BroadcastMessage | null;

  /** Explicitly close the broadcast channel and remove listeners */
  closeChannel: () => void;

  /** Current error state */
  error: string | null;
}

export type ClearMessage = 'CLEAR_SENT_MESSAGES';
